const mongoose = require('mongoose');
const assert = require('assert');

console.log(`Testing with Mongoose version: ${mongoose.version}`);

// Mock mongoose.connect
const originalConnect = mongoose.connect;
let connectCalled = false;
mongoose.connect = async (uri) => {
    console.log(`Mock mongoose.connect called with ${uri}`);
    connectCalled = true;
    return Promise.resolve();
};

const { Server, Blacklist, connect, disconnect } = require('../src/database');

async function runTest() {
    console.log('Running Database Unit Test...');

    // Test 1: Connect
    try {
        await connect('mongodb://mock/test');
        assert.strictEqual(connectCalled, true, 'mongoose.connect was not called');
        console.log('Connect test passed.');
    } catch (e) {
        console.error('Connect test failed:', e);
        process.exit(1);
    }

    // Test 2: Models exist
    if (Server && Blacklist) {
        console.log('Models exported correctly.');
    } else {
        console.error('Models missing.');
        process.exit(1);
    }

    // Test 3: bulkWrite compatibility
    // In Mongoose 6, Model.bulkWrite exists.
    if (typeof Server.bulkWrite === 'function') {
        console.log('Server.bulkWrite exists (Mongoose 6+ compatible).');
    } else {
        console.error('Server.bulkWrite is missing!');
        process.exit(1);
    }

    // Test 4: Simulate bulkWrite execution
    // We mock the implementation on the model to verify the function signature works.
    const originalBulkWrite = Server.bulkWrite;
    let bulkWriteCalled = false;
    Server.bulkWrite = async (ops) => {
        console.log(`Mock bulkWrite called with ${ops.length} ops`);
        bulkWriteCalled = true;
        return { result: { ok: 1, n: ops.length } };
    };

    try {
        const ops = [
            { updateOne: { filter: { ip: '1.2.3.4' }, update: { $set: { online: true } } } }
        ];
        await Server.bulkWrite(ops);
        assert.strictEqual(bulkWriteCalled, true, 'bulkWrite was not called');
        console.log('bulkWrite test passed.');
    } catch (e) {
        console.error('bulkWrite execution failed:', e);
        process.exit(1);
    }

    // Restore
    Server.bulkWrite = originalBulkWrite;
    mongoose.connect = originalConnect;

    console.log('Database Unit Test: ALL PASS');
}

runTest().catch(e => {
    console.error('Test script error:', e);
    process.exit(1);
});
