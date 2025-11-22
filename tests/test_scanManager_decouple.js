const mock = require('mock-require');
const EventEmitter = require('events');
const assert = require('assert');

console.log('Setting up mocks...');

// Mock scanner
let portScanCount = 0;
mock('../src/scanner', {
    checkPort: async (ip) => {
        portScanCount++;
        return { status: 'OPEN' }; // Always open
    },
    STATUS: { OPEN: 'OPEN', CLOSED: 'CLOSED', TIMEOUT: 'TIMEOUT', ERROR: 'ERROR' }
});

// Mock bot
let botScanCount = 0;
mock('../src/bot', {
    analyzeServer: async (ip, opts) => {
        // Simulate slow bot
        await new Promise(resolve => setTimeout(resolve, 100));
        botScanCount++;
        return { online: true };
    }
});

// Mock config
mock('../src/config', {
    DEFAULTS: {
        scan: { startIp: '0.0.0.0', endIp: '0.0.0.10', portConcurrency: 5, botConcurrency: 2 },
        auth: {},
        bot: { features: {} },
        vpn: { enabled: false },
        proxies: []
    }
});

// Mock child_process for VPN
mock('child_process', { exec: () => {} });

const ScanManager = require('../src/scanManager');

async function runTest() {
    console.log('Starting decoupled ScanManager test...');
    const scanner = new ScanManager();

    const startTime = Date.now();

    // 10 IPs
    try {
        await scanner.startScan({
            scan: { startIp: '1.1.1.1', endIp: '1.1.1.10' }
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    const duration = Date.now() - startTime;
    console.log(`Scan finished in ${duration}ms`);
    console.log(`Port scans: ${portScanCount}, Bot scans: ${botScanCount}`);

    assert.strictEqual(portScanCount, 10, 'Port scan count mismatch');
    assert.strictEqual(botScanCount, 10, 'Bot scan count mismatch');

    console.log('Test passed!');
}

runTest();
