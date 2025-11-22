const fs = require('fs');
const path = require('path');

// Check process.cwd() for config first (for standalone), then fallback to relative (for dev/internal)
let CONFIG_PATH = path.resolve(process.cwd(), 'config.json');
if (!fs.existsSync(CONFIG_PATH)) {
    CONFIG_PATH = path.resolve(__dirname, '../config.json');
}

const DEFAULTS = {
    scan: {
        startIp: '1.0.0.0',
        endIp: '1.0.0.255',
        portConcurrency: 1000,
        botConcurrency: 5
    },
    masscan: {
        enabled: true,
        bin: 'masscan',
        rate: 1000,
        excludeFile: 'exclude.txt'
    },
    database: {
        uri: 'fs://data' // Changed default to reflect filesystem DB usage
    },
    auth: {
        type: 'offline',
        // Removed default email/password for premium auth as it's no longer the primary focus
        // User can still add them to config.json if they want to use 'microsoft' auth
    },
    bot: {
        features: {
            structureScan: true,
            blockBreaking: true
        },
        structureBlocks: [
            'planks', 'cobblestone', 'bricks', 'glass', 'stone_bricks', 'bookshelf',
            'wool', 'concrete', 'terracotta', 'chest', 'furnace', 'crafting_table',
            'door', 'fence', 'stairs', 'slab', 'bed', 'torch', 'lantern'
        ]
    },
    vpn: {
        enabled: false,
        command: 'nordvpn connect',
        rotateThreshold: 500,
        rewindAmount: 500
    }
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            return mergeDeep(DEFAULTS, parsed);
        }
    } catch (e) {
        console.error('Error loading config.json, using defaults:', e.message);
    }
    return DEFAULTS;
}

function saveConfig(newConfig) {
    try {
        const configToSave = mergeDeep(loadConfig(), newConfig);
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(configToSave, null, 2), 'utf8');
        console.log('Config saved to', CONFIG_PATH);
        return true;
    } catch (e) {
        console.error('Error saving config:', e.message);
        return false;
    }
}

// Simple deep merge
function mergeDeep(target, source) {
    if (typeof target !== 'object' || target === null) {
        return source;
    }

    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = mergeDeep(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

module.exports = { loadConfig, saveConfig, DEFAULTS };
