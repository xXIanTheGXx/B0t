const readline = require('readline');
const fs = require('fs');
const { ip2long, long2ip } = require('./src/ipUtils');
const { checkPort } = require('./src/scanner');
const { analyzeServer } = require('./src/bot');
const pLimit = require('p-limit');

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

    const startLong = ip2long(startIpInput);
    const endLong = ip2long(endIpInput);

    if (startLong === -1 || endLong === -1 || startLong > endLong) {
        console.error("Invalid IP range.");
        rl.close();
        return;
    }

    console.log(`Scanning range: ${startIpInput} - ${endIpInput} (${endLong - startLong + 1} IPs)`);

    // Use a write stream for safe appending (NDJSON format)
    const resultsFile = 'servers.jsonl'; // Changed to .jsonl for correctness
    const outputStream = fs.createWriteStream(resultsFile, { flags: 'a' });

    const saveResult = (data) => {
        outputStream.write(JSON.stringify(data) + '\n');
        console.log(`[FOUND] ${data.ip} - Players: ${data.players.online}`);
    };

    // Concurrency Limits
    const portScanConcurrency = 200;
    const botAnalysisConcurrency = 5;
    
    const portLimit = pLimit(portScanConcurrency);
    const botLimit = pLimit(botAnalysisConcurrency);

    // We process IPs in chunks to avoid memory exhaustion
    // However, pLimit manages the active promises. 
    // The main issue with the previous loop was creating *all* promises at once.
    // We need to feed the promises into pLimit as we go.
    
    let currentLong = startLong;
    const activePromises = new Set();

    // Function to fill the queue
    const processNext = () => {
        while (currentLong <= endLong && activePromises.size < portScanConcurrency + 50) {
            const ipToScan = long2ip(currentLong);
            currentLong++;

            const promise = portLimit(async () => {
                try {
                    const isOpen = await checkPort(ipToScan);
                    if (isOpen) {
                         // Limit bot concurrency separately
                         await botLimit(async () => {
                            console.log(`[ANALYZING] ${ipToScan}...`);
                            const data = await analyzeServer(ipToScan, authOptions);
                            if (data.online) {
                                saveResult(data);
                            } else {
                                console.log(`[FAILED] ${ipToScan} (Could not join)`);
                            }
                         });
                    }
                } catch (err) {
                    console.error(`Error scanning ${ipToScan}:`, err);
                }
            }).then(() => {
                activePromises.delete(promise);
                processNext(); // Trigger next when one finishes
            });

            activePromises.add(promise);
        }
    };

    // Initial fill
    processNext();

    // Wait loop
    const waitForCompletion = async () => {
        while (activePromises.size > 0 || currentLong <= endLong) {
            await new Promise(resolve => setTimeout(resolve, 100));
            // processNext is triggered by promise completion, 
            // but we need to keep the script alive.
            // The while loop condition checks if we are done.
            if (activePromises.size === 0 && currentLong > endLong) {
                break;
            }
        }
    };

    await waitForCompletion();

    console.log("Scan complete. Results saved to servers.jsonl");
    outputStream.end();
    rl.close();
}

main();
