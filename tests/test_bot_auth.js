const mock = require('mock-require');
const assert = require('assert');

console.log('Running Bot Auth Tests...');

let createBotOptions = null;
let quitCalled = false;

// Mock mineflayer
mock('mineflayer', {
    createBot: (options) => {
        createBotOptions = options;
        return {
            on: (event, cb) => {},
            once: (event, cb) => {
                // Do nothing, we just check options
            },
            quit: () => { quitCalled = true; },
            version: '1.20.1',
            game: { gameMode: 'survival' },
            waitForChunksToLoad: () => Promise.resolve()
        };
    }
});

const { analyzeServer } = require('../src/bot');

async function run() {
    // Test 1: Default offline
    createBotOptions = null;
    analyzeServer('1.2.3.4', {});
    assert.strictEqual(createBotOptions.auth, 'offline');
    assert.ok(createBotOptions.username.startsWith('Scanner'));

    // Test 2: Microsoft via auth field
    createBotOptions = null;
    analyzeServer('1.2.3.4', { auth: 'microsoft', email: 'test@example.com' });
    assert.strictEqual(createBotOptions.auth, 'microsoft');
    assert.strictEqual(createBotOptions.username, 'test@example.com');

    // Test 3: Microsoft via type field (Fix I made)
    createBotOptions = null;
    analyzeServer('1.2.3.4', { type: 'microsoft', email: 'test2@example.com' });
    assert.strictEqual(createBotOptions.auth, 'microsoft');
    assert.strictEqual(createBotOptions.username, 'test2@example.com');

    console.log('Bot Auth Tests: PASS');
}

run().catch(e => {
    console.error('Bot Auth Tests FAILED:', e);
    process.exit(1);
});
