const EventEmitter = require('events');
const { ip2long, long2ip } = require('./ipUtils');
const { checkPort } = require('./scanner');
const { analyzeServer } = require('./bot');
const pLimit = require('p-limit');

class ScanManager extends EventEmitter {
    constructor() {
        super();
        this.isScanning = false;
    }

    async startScan(startIp, endIp, authOptions) {
        if (this.isScanning) {
            throw new Error('Scan already in progress');
        }
        this.isScanning = true;

        const startLong = ip2long(startIp);
        const endLong = ip2long(endIp);

        if (startLong === -1 || endLong === -1 || startLong > endLong) {
            this.isScanning = false;
            throw new Error('Invalid IP range');
        }

        this.emit('start', { startIp, endIp, total: endLong - startLong + 1 });

        // Concurrency Limits
        const portScanConcurrency = 200;
        const botAnalysisConcurrency = 5;

        const portLimit = pLimit(portScanConcurrency);
        const botLimit = pLimit(botAnalysisConcurrency);

        let currentLong = startLong;
        const activePromises = new Set();

        const processNext = () => {
            if (!this.isScanning) return;

            while (currentLong <= endLong && activePromises.size < portScanConcurrency + 50) {
                const ipToScan = long2ip(currentLong);
                currentLong++;

                const promise = portLimit(async () => {
                    try {
                        const isOpen = await checkPort(ipToScan);
                        if (isOpen) {
                             await botLimit(async () => {
                                this.emit('log', `[ANALYZING] ${ipToScan}...`);
                                const data = await analyzeServer(ipToScan, authOptions);
                                if (data.online) {
                                    this.emit('result', data);
                                } else {
                                    this.emit('log', `[FAILED] ${ipToScan} (Could not join)`);
                                }
                             });
                        }
                    } catch (err) {
                        this.emit('error', { ip: ipToScan, error: err });
                    }
                }).then(() => {
                    activePromises.delete(promise);
                    processNext();
                });

                activePromises.add(promise);
            }
        };

        processNext();

        const waitForCompletion = async () => {
            while (activePromises.size > 0 || (currentLong <= endLong && this.isScanning)) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        };

        await waitForCompletion();
        this.isScanning = false;
        this.emit('complete');
    }

    stopScan() {
        this.isScanning = false;
    }
}

module.exports = ScanManager;
