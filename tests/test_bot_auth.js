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

// Mock bot modules that might fail if dependencies are missing
mock('./bot_modules/navigation', { setupPathfinder: () => {}, configureMovements: () => {} });
mock('./bot_modules/behavior', { createAgent: () => {} });
mock('./bot_modules/perception', { scanEnvironment: () => ({ structures: [], density: {}, rare: [] }) });
mock('./bot_modules/looting', { ChestStealer: class {} });
mock('./bot_modules/proxy', { setupProxy: () => {} });
mock('./notifications', class DiscordNotifier {});
mock('mineflayer-web-inventory', () => {});


const { analyzeServer } = require('../src/bot');

async function run() {
    // Test 1: Default offline
    createBotOptions = null;
    analyzeServer('1.2.3.4', {});
    // Wait for createBot to be called (it's synchronous in mock but called in promise)
    // Since the promise won't resolve immediately without events firing, we inspect the side effect directly.
    // However, createBot is called synchronously inside the promise.
    // We need to wait a tick for the promise executor to run? No, it runs synchronously.

    assert.strictEqual(createBotOptions.auth, 'offline');
    assert.ok(createBotOptions.username.startsWith('Scanner'));

    // Test 2: Microsoft Auth (Explicit credentials)
    createBotOptions = null;
    analyzeServer('1.2.3.4', { email: 'test@example.com', password: 'password123' });
    assert.strictEqual(createBotOptions.auth, 'microsoft');
    assert.strictEqual(createBotOptions.username, 'test@example.com');
    assert.strictEqual(createBotOptions.password, 'password123');

    // Test 3: Explicit Auth type override
    createBotOptions = null;
    analyzeServer('1.2.3.4', { auth: 'microsoft', username: 'User1' });
    assert.strictEqual(createBotOptions.auth, 'microsoft');
    assert.strictEqual(createBotOptions.username, 'User1');

    console.log('Bot Auth Tests: PASS');
}

run().catch(e => {
    console.error('Bot Auth Tests FAILED:', e);
    process.exit(1);
});
