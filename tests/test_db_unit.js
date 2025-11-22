const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock fs to avoid writing real files during this test, or clean up after.
// For simplicity, we will let it write to a test directory and clean it up.
const TEST_DATA_DIR = path.resolve(process.cwd(), 'data_test');
if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// We need to override the path in src/database.js, but it's hardcoded.
// So we'll just test the interface and clean up the 'data' directory if it gets polluted,
// OR we can rely on the fact that src/database checks process.cwd().
// Actually, let's just mock 'fs' logic if possible? No, that's hard.

// Let's just run the test. It will write to 'data/servers.json'.
// We can back it up and restore it.
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');

let serverBackup = null;
let blacklistBackup = null;

if (fs.existsSync(SERVERS_FILE)) serverBackup = fs.readFileSync(SERVERS_FILE);
if (fs.existsSync(BLACKLIST_FILE)) blacklistBackup = fs.readFileSync(BLACKLIST_FILE);

const { Server, Blacklist, connect, disconnect } = require('../src/database');

async function runTest() {
    console.log('Running Database Unit Test (Filesystem Implementation)...');

    // Test 1: Connect (Just loads files)
    try {
        await connect('dummy-uri'); // URI is ignored
        console.log('Connect test passed.');
    } catch (e) {
        console.error('Connect test failed:', e);
        process.exit(1);
    }

    // Test 2: Models exist and have methods
    if (Server && Blacklist && typeof Server.find === 'function') {
        console.log('Models exported correctly and have FS methods.');
    } else {
        console.error('Models missing or invalid interface.');
        process.exit(1);
    }

    // Test 3: bulkWrite
    console.log('Testing bulkWrite...');
    try {
        // Clear existing data for test isolation
        Server.data = [];

        const ops = [
            {
                updateOne: {
                    filter: { ip: '1.2.3.4' },
                    update: { $set: { online: true, version: { name: '1.20' } } },
                    upsert: true
                }
            },
             {
                updateOne: {
                    filter: { ip: '5.6.7.8' },
                    update: { $set: { online: false } },
                    upsert: true
                }
            }
        ];
        await Server.bulkWrite(ops);

        assert.strictEqual(Server.data.length, 2, 'Should have 2 documents');
        assert.strictEqual(Server.data[0].ip, '1.2.3.4');
        assert.strictEqual(Server.data[0].online, true);

        console.log('bulkWrite test passed.');
    } catch (e) {
        console.error('bulkWrite execution failed:', e);
        process.exit(1);
    }

    // Test 4: Querying
    console.log('Testing Querying (find/findOne)...');
    try {
        const found = await Server.findOne({ ip: '1.2.3.4' });
        assert(found, 'Should find the document');
        assert.strictEqual(found.version.name, '1.20');

        const notFound = await Server.findOne({ ip: '9.9.9.9' });
        assert(!notFound, 'Should not find missing document');

        const list = await Server.find({ online: true });

        // Correction: My `QueryCursor` needs to be awaitable.
        // If it has a `.then` method, `await` calls it.
        const listResults = await list;

        assert.strictEqual(listResults.length, 1);
        assert.strictEqual(listResults[0].ip, '1.2.3.4');

        console.log('Querying test passed.');
    } catch (e) {
        console.error('Querying test failed:', e);
        process.exit(1);
    }

    // Test 5: Advanced Query Operators ($gte, $exists)
    console.log('Testing Operators...');
    try {
        // Add more data
        await Server.create({ ip: '10.0.0.1', players: { online: 5 } });
        await Server.create({ ip: '10.0.0.2', players: { online: 10 } });

        const gte = await Server.find({ 'players.online': { $gte: 6 } });
        assert.strictEqual(gte.length, 1);
        assert.strictEqual(gte[0].ip, '10.0.0.2');

        const exists = await Server.find({ 'players.online': { $exists: true } });
        assert.strictEqual(exists.length, 2);

        console.log('Operators test passed.');
    } catch (e) {
        console.error('Operators test failed:', e);
        process.exit(1);
    }

    // Test 6: findOneAndUpdate
    console.log('Testing findOneAndUpdate...');
    try {
        const result = await Server.findOneAndUpdate(
            { ip: '10.0.0.1' },
            { $set: { 'players.online': 20, newField: 'test' } },
            { upsert: true, new: true }
        );

        assert.strictEqual(result.ip, '10.0.0.1');
        assert.strictEqual(result.players.online, 20);
        assert.strictEqual(result.newField, 'test');

        // Verify persistence
        const check = await Server.findOne({ ip: '10.0.0.1' });
        assert.strictEqual(check.players.online, 20);

        // Test upsert
        const upserted = await Server.findOneAndUpdate(
            { ip: '99.99.99.99' },
            { $set: { created: true } },
            { upsert: true }
        );
        assert.strictEqual(upserted.ip, '99.99.99.99');
        assert.strictEqual(upserted.created, true);

        console.log('findOneAndUpdate test passed.');
    } catch (e) {
        console.error('findOneAndUpdate test failed:', e);
        process.exit(1);
    }

    // Cleanup: Restore backups
    if (serverBackup) fs.writeFileSync(SERVERS_FILE, serverBackup);
    else if (fs.existsSync(SERVERS_FILE)) fs.unlinkSync(SERVERS_FILE); // Delete if it didn't exist before

    if (blacklistBackup) fs.writeFileSync(BLACKLIST_FILE, blacklistBackup);
    else if (fs.existsSync(BLACKLIST_FILE)) fs.unlinkSync(BLACKLIST_FILE);

    console.log('Database Unit Test: ALL PASS');
}

runTest().catch(e => {
    console.error('Test script error:', e);
    process.exit(1);
});
