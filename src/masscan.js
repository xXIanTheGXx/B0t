const { spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');

class MasscanScanner extends EventEmitter {
    constructor(options = {}) {
        super();
        this.binaryPath = options.binaryPath || 'masscan';
        this.rate = options.rate || 1000;
        this.excludeFile = options.excludeFile || 'exclude.txt';
        this.process = null;
    }

    /**
     * Start scanning a range
     * @param {string} range - IP range (e.g. "1.2.3.4-1.2.3.55" or CIDR)
     * @param {string} ports - Ports to scan (default "25565")
     */
    start(range, ports = '25565') {
        if (this.process) {
            throw new Error('Scan already in progress');
        }

        const args = [
            '-p', ports,
            '--rate', this.rate.toString(),
            range
        ];

        // Add exclude file if it exists
        if (fs.existsSync(this.excludeFile)) {
            args.push('--excludefile', this.excludeFile);
        }

        // Note: Masscan requires root privileges usually.
        console.log(`Spawning masscan: ${this.binaryPath} ${args.join(' ')}`);

        try {
            this.process = spawn(this.binaryPath, args);
        } catch (err) {
            this.emit('error', err);
            return;
        }

        let buffer = '';

        this.process.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            // Process all complete lines
            while (lines.length > 1) {
                const line = lines.shift();
                this._parseLine(line);
            }
            // Keep the last partial line in buffer
            buffer = lines[0];
        });

        this.process.stderr.on('data', (data) => {
            // Masscan status updates go to stderr
            this.emit('status', data.toString());
        });

        this.process.on('close', (code) => {
            this.process = null;
            if (code !== 0 && code !== null) {
                this.emit('error', new Error(`Masscan exited with code ${code}`));
            }
            this.emit('complete');
        });

        this.process.on('error', (err) => {
            this.emit('error', err);
        });
    }

    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }

    _parseLine(line) {
        // Example: Discovered open port 25565/tcp on 1.2.3.4
        const regex = /Discovered open port (\d+)\/(tcp|udp) on (\d+\.\d+\.\d+\.\d+)/;
        const match = line.match(regex);
        if (match) {
            const port = parseInt(match[1], 10);
            // const type = match[2]; // tcp/udp
            const ip = match[3];
            this.emit('ip', { ip, port });
        }
    }
}

module.exports = MasscanScanner;
