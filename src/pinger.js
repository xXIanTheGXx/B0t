const mc = require('minecraft-protocol');

// Regex for detecting server software
const SOFTWARE_REGEX = /(Paper|Spigot|Forge|Fabric|BungeeCord|Velocity|Waterfall)\s*v?(\d+\.\d+(\.\d+)?)/i;

// Opt-out pattern (Color codes: Aqua, Light Purple, White, Light Purple, Aqua)
// §b§d§f§d§b
const OPT_OUT_PATTERN = /\u00A7b\u00A7d\u00A7f\u00A7d\u00A7b/;

const COLOR_MAP = {
    '0': 'color:#000000',
    '1': 'color:#0000AA',
    '2': 'color:#00AA00',
    '3': 'color:#00AAAA',
    '4': 'color:#AA0000',
    '5': 'color:#AA00AA',
    '6': 'color:#FFAA00',
    '7': 'color:#AAAAAA',
    '8': 'color:#555555',
    '9': 'color:#5555FF',
    'a': 'color:#55FF55',
    'b': 'color:#55FFFF',
    'c': 'color:#FF5555',
    'd': 'color:#FF55FF',
    'e': 'color:#FFFF55',
    'f': 'color:#FFFFFF',
};

function parseVersion(versionName) {
    if (!versionName) return { name: 'Unknown', software: 'Vanilla' };

    const match = versionName.match(SOFTWARE_REGEX);
    let software = 'Vanilla';
    if (match) {
        software = match[1];
    } else if (versionName.toLowerCase().includes('bukkit')) {
        software = 'Bukkit';
    }

    return {
        name: versionName,
        software: software
    };
}

function getTextFromDescription(description) {
    if (typeof description === 'string') return description;
    if (!description) return '';

    if (description.text) {
        let text = description.text;
        if (description.extra) {
            text += description.extra.map(x => getTextFromDescription(x)).join('');
        }
        return text;
    }
    // Fallback for odd objects
    return JSON.stringify(description);
}

function parseMotd(description) {
    // Get raw string with color codes
    let raw = getTextFromDescription(description);
    if (!raw && typeof description === 'string') raw = description;
    if (!raw) raw = "";

    // Clean (strip codes)
    const clean = raw.replace(/\u00A7[0-9a-fklmnor]/g, '');

    // HTML (simple)
    let html = '';

    // Split by section sign
    const parts = raw.split('\u00A7');
    html += parts[0]; // Text before first code

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const code = part.charAt(0);
        const text = part.substring(1);

        if (COLOR_MAP[code]) {
            html += `<span style="${COLOR_MAP[code]}">${text}</span>`;
        } else {
            // Formatting codes like bold/obfuscated ignored for now
            html += text;
        }
    }

    return { raw, html, clean };
}

function pingServer(ip, port = 25565, timeout = 5000) {
    return new Promise((resolve, reject) => {
        mc.ping({ host: ip, port: port, closeTimeout: timeout }, (err, result) => {
            if (err) return reject(err);
            if (!result) return reject(new Error('No response'));

            // Check opt-out in raw text
            const rawMotd = getTextFromDescription(result.description);
            if (OPT_OUT_PATTERN.test(rawMotd)) {
                return resolve({ optedOut: true, ip, port });
            }

            const versionInfo = parseVersion(result.version.name);
            const motdInfo = parseMotd(result.description);

            resolve({
                ip,
                port,
                version: {
                    name: result.version.name,
                    protocol: result.version.protocol,
                    software: versionInfo.software
                },
                motd: motdInfo,
                players: {
                    online: result.players.online,
                    max: result.players.max,
                    sample: result.players.sample || []
                },
                favicon: result.favicon,
                latency: result.latency
            });
        });
    });
}

module.exports = {
    pingServer,
    parseVersion,
    parseMotd
};
