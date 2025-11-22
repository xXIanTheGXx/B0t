const EventEmitter = require('events');
const { ip2long, long2ip } = require('./ipUtils');
const { checkPort, STATUS } = require('./scanner');
const { analyzeServer } = require('./bot');
const pLimit = require('p-limit');
const { exec } = require('child_process');
const { DEFAULTS } = require('./config');

class ScanManager extends EventEmitter {
    constructor() {
        super();
        this.isScanning = false;
        this.isPaused = false;
        this.consecutiveTimeouts = 0;
    }

    async startScan(arg1, arg2, arg3) {
        if (this.isScanning) {
            throw new Error('Scan already in progress');
        }

        // Resolve Config
        let config = JSON.parse(JSON.stringify(DEFAULTS)); // Clone defaults

        if (typeof arg1 === 'object') {
            // Merge provided config
            if (arg1.scan) config.scan = { ...config.scan, ...arg1.scan };
            if (arg1.auth) config.auth = { ...config.auth, ...arg1.auth };
            if (arg1.bot) {
                 config.bot = { ...config.bot, ...arg1.bot };
                 if(arg1.bot.features) config.bot.features = { ...DEFAULTS.bot.features, ...arg1.bot.features };
            }
            if (arg1.discord) config.discord = { ...config.discord, ...arg1.discord };
            if (arg1.agent) config.agent = { ...config.agent, ...arg1.agent };
            if (arg1.proxies) config.proxies = arg1.proxies;
            if (arg1.looting) config.looting = { ...config.looting, ...arg1.looting };
            if (arg1.vpn) config.vpn = { ...config.vpn, ...arg1.vpn };
        } else {
            // Legacy arguments: startIp, endIp, authOptions
            config.scan.startIp = arg1;
            config.scan.endIp = arg2;
            if (arg3) config.auth = { ...config.auth, ...arg3 };
        }

        this.isScanning = true;
        this.isPaused = false;
        this.consecutiveTimeouts = 0;

        const startIp = config.scan.startIp;
        const endIp = config.scan.endIp;
        const startLong = ip2long(startIp);
        const endLong = ip2long(endIp);

        if (startLong === -1 || endLong === -1 || startLong > endLong) {
            this.isScanning = false;
            throw new Error('Invalid IP range');
        }

        this.emit('start', { startIp, endIp, total: endLong - startLong + 1 });

        const portScanConcurrency = config.scan.portConcurrency || 200;
        const botAnalysisConcurrency = config.scan.botConcurrency || 5;

        const portLimit = pLimit(portScanConcurrency);
        const botLimit = pLimit(botAnalysisConcurrency);

        let currentLong = startLong;
        const activePromises = new Set();

        const rotateVPN = async () => {
            this.isPaused = true;
            this.emit('log', `[VPN] Consecutive timeouts (${this.consecutiveTimeouts}) reached threshold. Rotating IP...`);

            try {
                await new Promise((resolve, reject) => {
                    exec(config.vpn.command, (error, stdout, stderr) => {
                        if (error) {
                            this.emit('log', `[VPN] Error: ${error.message}`);
                        } else {
                            this.emit('log', `[VPN] Command output: ${stdout.trim()}`);
                        }
                        resolve();
                    });
                });

                // Wait a bit for network to settle
                await new Promise(r => setTimeout(r, 5000));

                // Rewind
                const rewind = config.vpn.rewindAmount || 500;
                const oldLong = currentLong;
                // Don't rewind below start
                const newLong = Math.max(startLong, currentLong - rewind);
                currentLong = newLong;

                this.emit('log', `[VPN] Rewinding scan from ${long2ip(oldLong)} to ${long2ip(currentLong)}`);

                this.consecutiveTimeouts = 0;
            } catch (e) {
                this.emit('log', `[VPN] Exception during rotation: ${e.message}`);
            }

            this.isPaused = false;
            processNext();
        };

        const processNext = () => {
            if (!this.isScanning) return;
            if (this.isPaused) return;

            // Check VPN Threshold
            if (config.vpn.enabled && this.consecutiveTimeouts >= config.vpn.rotateThreshold) {
                rotateVPN();
                return;
            }

            while (currentLong <= endLong && activePromises.size < portScanConcurrency + 50 && !this.isPaused) {
                const ipToScan = long2ip(currentLong);
                currentLong++;

                const promise = portLimit(async () => {
                    if (this.isPaused || !this.isScanning) return;
                    try {
                        const result = await checkPort(ipToScan);

                        if (result.status === STATUS.OPEN) {
                            this.consecutiveTimeouts = 0; // Reset on success

                             await botLimit(async () => {
                                if (this.isPaused || !this.isScanning) return;

                                this.emit('log', `[ANALYZING] ${ipToScan}...`);

                                let proxy = null;
                                if (config.proxies && Array.isArray(config.proxies) && config.proxies.length > 0) {
                                    proxy = config.proxies[Math.floor(Math.random() * config.proxies.length)];
                                }

                                // Pass full config or relevant parts
                                const botOpts = {
                                    ...config.auth,
                                    ...config.bot,
                                    discord: config.discord,
                                    agent: config.agent,
                                    looting: config.looting,
                                    proxy: proxy
                                };

                                const data = await analyzeServer(ipToScan, botOpts);
                                if (data.online) {
                                    this.emit('result', data);
                                } else {
                                    this.emit('log', `[FAILED] ${ipToScan} (Could not join)`);
                                }
                             });
                        } else if (result.status === STATUS.TIMEOUT || result.status === STATUS.ERROR) {
                            if (config.vpn.enabled) {
                                this.consecutiveTimeouts++;
                            }
                        } else {
                            // ECONNREFUSED means we reached the host, so not a network block.
                            this.consecutiveTimeouts = 0;
                        }
                    } catch (err) {
                        this.emit('error', { ip: ipToScan, error: err });
                    }
                }).then(() => {
                    activePromises.delete(promise);
                    if (!this.isPaused) processNext();
                });

                activePromises.add(promise);
            }
        };

        processNext();

        const waitForCompletion = async () => {
            while (this.isScanning) {
                if (activePromises.size === 0 && currentLong > endLong && !this.isPaused) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        };

        await waitForCompletion();
        this.isScanning = false;
        this.emit('complete');
    }

    stopScan() {
        this.isScanning = false;
        this.isPaused = false;
    }
}

module.exports = ScanManager;
