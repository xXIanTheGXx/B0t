const mock = require('mock-require');
const assert = require('assert');
const EventEmitter = require('events');

console.log('Running Pipeline Logic Tests...');

// 1. Mock Database
class MockServer {
    static bulkWrite(ops) {
        MockServer.ops.push(...ops);
        return Promise.resolve();
    }
}
MockServer.ops = [];

class MockBlacklist {
    static exists() { return Promise.resolve(false); }
    static create() { return Promise.resolve(); }
}

mock('../src/database', {
    Server: MockServer,
    Blacklist: MockBlacklist,
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve()
});

// 2. Mock Masscan
class MockMasscan extends EventEmitter {
    constructor() {
        super();
        this.process = { stdout: { pause: () => {}, resume: () => {}, isPaused: () => false } };
    }
    start() {
        // Emit some IPs
        process.nextTick(() => {
             this.emit('ip', { ip: '1.1.1.1', port: 25565 });
             this.emit('ip', { ip: '2.2.2.2', port: 25565 });
             setTimeout(() => this.emit('complete'), 100);
        });
    }
}
mock('../src/masscan', MockMasscan);

// 3. Mock Pinger
mock('../src/pinger', {
    pingServer: async (ip, port) => {
        return {
            ip, port,
            version: { name: '1.20' },
            motd: { clean: 'Test Server' },
            players: { online: 5 }
        };
    }
});

// Re-require pipeline to apply mocks
const { ScanPipeline } = require('../src/pipeline');

async function run() {
    const config = {
        masscanPath: 'mock',
        rate: 100,
        excludeFile: 'none',
        dbUri: 'mock://uri',
        range: '1.0.0.0/24',
        concurrency: 2
    };

    const pipeline = new ScanPipeline(config);

    await pipeline.start();

    // Verify DB writes
    assert.strictEqual(MockServer.ops.length, 2, `Expected 2 ops, got ${MockServer.ops.length}`);
    assert.strictEqual(MockServer.ops[0].updateOne.filter.ip, '1.1.1.1');
    assert.strictEqual(MockServer.ops[1].updateOne.filter.ip, '2.2.2.2');

    console.log('Pipeline Logic Tests: PASS');
}

run().catch(e => {
    console.error('Pipeline Tests FAILED:', e);
    process.exit(1);
});
