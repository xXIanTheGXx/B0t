const net = require('net');

function checkPort(ip, port = 25565, timeout = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let status = false;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            status = true;
            socket.destroy();
        });

        socket.on('timeout', () => {
            socket.destroy();
        });

        socket.on('error', (err) => {
            socket.destroy();
        });

        socket.on('close', () => {
            resolve(status);
        });

        socket.connect(port, ip);
    });
}

module.exports = { checkPort };
