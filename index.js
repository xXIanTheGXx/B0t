const readline = require('readline');
const fs = require('fs');
const ScanManager = require('./src/scanManager');
const { loadConfig } = require('./src/config');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log("Minecraft Server Scanner");
    console.log("------------------------");

    // Load config
    const config = loadConfig();
    console.log(`Loaded configuration from config.json`);
    console.log(`Range: ${config.scan.startIp} - ${config.scan.endIp}`);
    console.log(`Auth: ${config.auth.type} (${config.auth.email || 'N/A'})`);
    console.log(`VPN Rotation: ${config.vpn.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`Bot Features: Structure Scan (${config.bot.features.structureScan}), Block Break (${config.bot.features.blockBreaking})`);

    const useConfig = await askQuestion("Start scan with these settings? (Y/n): ");

    if (useConfig.trim().toLowerCase().startsWith('n')) {
        const startIpInput = await askQuestion(`Enter Start IP [${config.scan.startIp}]: `);
        if (startIpInput) config.scan.startIp = startIpInput;

        const endIpInput = await askQuestion(`Enter End IP [${config.scan.endIp}]: `);
        if (endIpInput) config.scan.endIp = endIpInput;

        const useAuth = await askQuestion("Do you want to use a Microsoft Account? (y/n): ");
        if (useAuth.toLowerCase().startsWith('y')) {
            const email = await askQuestion("Email: ");
            config.auth.email = email;
            config.auth.username = email;
            config.auth.auth = 'microsoft';
            // Not asking for password in CLI for simplicity/security unless needed
        } else {
            config.auth.auth = 'offline';
        }
    }

    // Use a write stream for safe appending (NDJSON format)
    const resultsFile = 'servers.jsonl';
    const outputStream = fs.createWriteStream(resultsFile, { flags: 'a' });

    const scanner = new ScanManager();

    scanner.on('start', (info) => {
         console.log(`Scanning range: ${info.startIp} - ${info.endIp} (${info.total} IPs)`);
    });

    scanner.on('log', (msg) => {
        console.log(msg);
    });

    scanner.on('result', (data) => {
        outputStream.write(JSON.stringify(data) + '\n');
        console.log(`[FOUND] ${data.ip} - Players: ${data.players.online}`);
    });

    scanner.on('error', (err) => {
         // console.error(`Error scanning ${err.ip}:`, err.error);
         // Suppress verbose errors in CLI usually
    });

    try {
        await scanner.startScan(config);
        console.log("Scan complete. Results saved to servers.jsonl");
    } catch (error) {
        console.error(error.message);
    } finally {
        outputStream.end();
        rl.close();
    }
}

main();
