const net = require('net');

const STATUS = {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
    TIMEOUT: 'TIMEOUT',
    ERROR: 'ERROR'
};

function checkPort(ip, port = 25565, timeout = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let status = STATUS.CLOSED;
        let error = null;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            status = STATUS.OPEN;
            socket.destroy();
        });

        socket.on('timeout', () => {
            status = STATUS.TIMEOUT;
            socket.destroy();
        });

        socket.on('error', (err) => {
            // Check error code to distinguish closed vs other errors
            if (err.code === 'ECONNREFUSED') {
                status = STATUS.CLOSED;
            } else {
                // ETIMEDOUT is handled by timeout event usually, but sometimes here
                status = STATUS.ERROR;
                error = err;
            }
            socket.destroy();
        });

        socket.on('close', () => {
            resolve({ status, error });
        });

        socket.connect(port, ip);
    });
}

module.exports = { checkPort, STATUS };
