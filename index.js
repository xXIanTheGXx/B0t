const readline = require('readline');
const fs = require('fs');
const ScanManager = require('./src/scanManager');

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

    const startIpInput = await askQuestion("Enter Start IP (e.g., 1.0.0.0): ");
    const endIpInput = await askQuestion("Enter End IP (e.g., 1.0.0.5): ");
    
    const useAuth = await askQuestion("Do you want to use a Microsoft Account? (y/n): ");
    let authOptions = { auth: 'offline' };
    if (useAuth.toLowerCase().startsWith('y')) {
        const email = await askQuestion("Email: ");
        authOptions.username = email;
        authOptions.auth = 'microsoft';
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
         console.error(`Error scanning ${err.ip}:`, err.error);
    });

    try {
        await scanner.startScan(startIpInput, endIpInput, authOptions);
        console.log("Scan complete. Results saved to servers.jsonl");
    } catch (error) {
        console.error(error.message);
    } finally {
        outputStream.end();
        rl.close();
    }
}

main();
