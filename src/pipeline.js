const { Readable, Transform, Writable } = require('stream');
const { pingServer } = require('./pinger');
const { Server, Blacklist, connect, disconnect } = require('./database');
const MasscanScanner = require('./masscan');
const geo = require('./geo');

class MasscanSource extends Readable {
    constructor(scanner) {
        super({ objectMode: true });
        this.scanner = scanner;

        this.scanner.on('ip', (target) => {
            // If push returns false, we should stop reading (pause scanner)
            if (!this.push(target)) {
                if (this.scanner.process && this.scanner.process.stdout) {
                    this.scanner.process.stdout.pause();
                }
            }
        });

        this.scanner.on('complete', () => {
            this.push(null); // End of stream
        });

        this.scanner.on('error', (err) => {
            this.emit('error', err);
        });
    }

    _read() {
        // Downstream wants more data, resume scanner
        if (this.scanner.process && this.scanner.process.stdout && this.scanner.process.stdout.isPaused()) {
            this.scanner.process.stdout.resume();
        }
    }
}

class PingerTransform extends Transform {
    constructor(concurrency = 100) {
        super({ objectMode: true });
        this.concurrency = concurrency;
        this.active = 0;
        this.queuedTask = null;
        this.queuedCallback = null;
    }

    _transform(chunk, encoding, callback) {
        const startTask = () => {
            this.active++;
            this._processChunk(chunk).finally(() => {
                this.active--;
                this._processQueue();
            });
        };

        if (this.active < this.concurrency) {
            startTask();
            callback();
        } else {
            this.queuedTask = startTask;
            this.queuedCallback = callback;
        }
    }

    _processQueue() {
        if (this.queuedTask) {
            const task = this.queuedTask;
            const cb = this.queuedCallback;
            this.queuedTask = null;
            this.queuedCallback = null;
            task();
            cb();
        }
    }

    async _processChunk(chunk) {
        try {
            // Check blacklist locally if possible
            const isBlacklisted = await Blacklist.exists({ ip: chunk.ip });
            if (!isBlacklisted) {
                const result = await pingServer(chunk.ip, chunk.port);
                if (result.optedOut) {
                    await Blacklist.create({ ip: chunk.ip, reason: 'Opt-out via MOTD' }).catch(() => {});
                } else {
                    // Enrich with GeoIP
                    const location = geo.lookup(chunk.ip);
                    if (location && location.ll) {
                        result.location = {
                            type: 'Point',
                            coordinates: [location.ll[1], location.ll[0]] // lon, lat
                        };
                        result.geo = {
                            country: location.country,
                            city: location.city,
                            region: location.region
                        };
                    }
                    this.push(result);
                }
            }
        } catch (err) {
            // Offline or timeout, ignore
        }
    }
}

class DatabaseSink extends Writable {
    constructor(options = {}) {
        super({ objectMode: true });
        this.batchSize = options.batchSize || 100;
        this.buffer = [];
    }

    _write(chunk, encoding, callback) {
        this.buffer.push(chunk);
        if (this.buffer.length >= this.batchSize) {
            this._flush(callback);
        } else {
            callback();
        }
    }

    _flush(callback) {
        if (this.buffer.length === 0) return callback();

        const ops = this.buffer.map(server => ({
            updateOne: {
                filter: { ip: server.ip, port: server.port },
                update: { $set: { ...server, lastSeen: new Date() } },
                upsert: true
            }
        }));

        // Clear buffer
        this.buffer = [];

        Server.bulkWrite(ops)
            .then(() => callback())
            .catch(err => callback(err));
    }

    _final(callback) {
        this._flush(callback);
    }
}

class ScanPipeline {
    constructor(config) {
        this.config = config;
        this.scanner = new MasscanScanner({
            binaryPath: config.masscanPath,
            rate: config.rate,
            excludeFile: config.excludeFile
        });
    }

    async start() {
        console.log('Starting Scan Pipeline...');
        await connect(this.config.dbUri);

        const source = new MasscanSource(this.scanner);
        const pinger = new PingerTransform(this.config.concurrency);
        const sink = new DatabaseSink({ batchSize: 100 });

        // Connect streams
        source.pipe(pinger).pipe(sink);

        // Start scanning
        // Expecting config.range
        this.scanner.start(this.config.range, this.config.ports);

        return new Promise((resolve, reject) => {
            sink.on('finish', async () => {
                console.log('Scan pipeline finished.');
                await disconnect();
                resolve();
            });
            source.on('error', (err) => {
                console.error('Scan pipeline error:', err);
                reject(err);
            });
        });
    }
}

module.exports = {
    ScanPipeline,
    MasscanSource,
    PingerTransform,
    DatabaseSink
};
