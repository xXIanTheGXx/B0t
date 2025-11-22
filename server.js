const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ScanManager = require('./src/scanManager');
const { connect, Server: ServerModel } = require('./src/database');
const { loadConfig, saveConfig } = require('./src/config');
const apiRouter = require('./src/api');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to Database
const config = loadConfig();
const dbUri = config.database ? config.database.uri : 'mongodb://127.0.0.1:27017/minecraft_scanner';
connect(dbUri).catch(err => {
    console.error('Database connection failed:', err.message);
    console.log('You can still run the scanner, but results will not be saved to the database (only JSON file).');
    console.log('To fix this, ensure MongoDB is installed and running.');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

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

        const { startIp, endIp, authOptions, bot, ...rest } = data;

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

        currentScanner.on('progress', (data) => {
            io.emit('progress', data);
        });

        currentScanner.on('result', async (result) => {
            outputStream.write(JSON.stringify(result) + '\n');
            io.emit('result', result);

            // Save to MongoDB
            try {
                await ServerModel.findOneAndUpdate(
                    { ip: result.ip, port: result.port },
                    {
                        ...result,
                        lastSeen: new Date(),
                        // Ensure location structure if missing
                        location: result.location || { type: 'Point', coordinates: [0, 0] }
                    },
                    { upsert: true, new: true }
                );
            } catch (err) {
                // console.error('Failed to save to DB:', err.message);
                // Silent fail to avoid spamming logs if DB is down
            }
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
                bot: bot || {},
                ...rest
            };

            // Save config to file
            saveConfig(config);

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
