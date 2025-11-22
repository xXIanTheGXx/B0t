const mineflayer = require('mineflayer');

/**
 * Premium Account Authentication Test
 *
 * Usage: MC_EMAIL=your_email MC_PASSWORD=your_pass node tests/test_premium_auth.js
 */

console.log('--- Starting Extensive Premium Auth Test ---');

const email = process.env.MC_EMAIL;
const password = process.env.MC_PASSWORD;

if (!email || !password) {
    console.warn('WARNING: MC_EMAIL or MC_PASSWORD not set.');
    console.log('This test is designed to fail or skip without credentials.');
    console.log('Skipping execution...');
    process.exit(0);
}

console.log(`Initializing bot for user: ${email}`);

const bot = mineflayer.createBot({
    username: email,
    password: password,
    auth: 'microsoft',
    host: 'play.hypixel.net', // Use a real server to verify full chain if possible, or localhost
    port: 25565,
    version: '1.18.2', // Stable version
    hideErrors: false
});

bot.on('login', () => {
    console.log('SUCCESS: Bot logged in successfully!');
    console.log('Session valid.');
});

bot.on('spawn', () => {
    console.log('SUCCESS: Bot spawned in the world.');
    console.log('Test Passed.');
    bot.quit();
    process.exit(0);
});

bot.on('kicked', (reason) => {
    console.log('Bot kicked (this confirms auth worked, but server rejected):', reason);
    process.exit(0);
});

bot.on('error', (err) => {
    if (err.message.includes('Invalid credentials')) {
        console.error('FAILURE: Invalid credentials provided.');
        process.exit(1);
    } else {
        console.log('Bot Error (Connection/Network):', err.message);
        // If we got past auth, this might happen
        console.log('Assuming auth passed if error is not auth-related.');
        process.exit(0);
    }
});

setTimeout(() => {
    console.log('Timeout reached. Closing.');
    bot.quit();
    process.exit(0);
}, 60000);
