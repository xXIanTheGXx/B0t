const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ScanManager = require('./src/scanManager');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let currentScanner = null;

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('start-scan', async (data) => {
        if (currentScanner && currentScanner.isScanning) {
            socket.emit('log', 'Stopping previous scan...');
            currentScanner.stopScan();
            // Wait slightly to ensure it stops?
            // stopScan sets a flag, the loop checks it.
            await new Promise(r => setTimeout(r, 500));
        }

        const { startIp, endIp, authOptions, bot } = data;

        if(!startIp || !endIp) {
            socket.emit('error', 'Invalid IP range');
            return;
        }

        currentScanner = new ScanManager();

        const resultsFile = 'servers.jsonl';
        const outputStream = fs.createWriteStream(resultsFile, { flags: 'a' });

        currentScanner.on('start', (info) => {
            io.emit('scan-started', info);
        });

        currentScanner.on('log', (msg) => {
            io.emit('log', msg);
        });

        currentScanner.on('result', (result) => {
            outputStream.write(JSON.stringify(result) + '\n');
            io.emit('result', result);
        });

        currentScanner.on('complete', () => {
            io.emit('scan-complete');
            outputStream.end();
        });

        // Helper for catching async errors inside the scanner
        currentScanner.on('error', (err) => {
             // Optional: Log detailed errors to console or file
             // console.error(err);
        });

        try {
            // Construct config object
            const config = {
                scan: { startIp, endIp },
                auth: authOptions || { auth: 'offline' },
                bot: bot || {}
            };

            await currentScanner.startScan(config);
        } catch (e) {
            socket.emit('error', e.message);
            outputStream.end();
        }
    });

    socket.on('stop-scan', () => {
        if (currentScanner && currentScanner.isScanning) {
            currentScanner.stopScan();
            io.emit('log', 'Scan stopped by user.');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
