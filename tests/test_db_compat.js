const mongoose = require('mongoose');

console.log(`Mongoose Version: ${mongoose.version}`);

try {
    const { Server, Blacklist } = require('../src/database');
    console.log('Database models loaded successfully.');

    if (mongoose.models.Server && mongoose.models.Blacklist) {
        console.log('Models registered.');
    } else {
        console.error('Models NOT registered.');
        process.exit(1);
    }

    console.log('Database compatibility test: PASS');
} catch (e) {
    console.error('Database compatibility test FAILED:', e);
    process.exit(1);
}
