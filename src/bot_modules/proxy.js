const { SocksClient } = require('socks');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { URL } = require('url');

function parseProxy(proxyString) {
    // Expected format: socks5://user:pass@ip:port
    try {
        const parsed = new URL(proxyString);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port, 10),
            userId: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            type: 5
        };
    } catch (e) {
        console.error('Invalid proxy string:', proxyString);
        return null;
    }
}

function setupProxy(botOptions, proxyString) {
    if (!proxyString) return;

    // 1. HTTP Agent for Microsoft Auth / Skins
    botOptions.agent = new SocksProxyAgent(proxyString);

    // 2. TCP Connection for Minecraft Protocol
    const proxyConf = parseProxy(proxyString);
    if (!proxyConf) return;

    botOptions.connect = (client) => {
        SocksClient.createConnection({
            proxy: proxyConf,
            command: 'connect',
            destination: {
                host: botOptions.host,
                port: botOptions.port
            }
        }, (err, info) => {
            if (err) {
                // console.error('Proxy connection failed:', err.message);
                client.emit('error', err);
                return;
            }
            client.setSocket(info.socket);
            client.emit('connect');
        });
    };
}

module.exports = { setupProxy };
