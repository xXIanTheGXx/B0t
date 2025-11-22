const mineflayer = require('mineflayer');
const vec3 = require('vec3');

const DEFAULT_ARTIFICIAL_BLOCKS = [
    'planks', 'cobblestone', 'bricks', 'glass', 'stone_bricks', 'bookshelf',
    'wool', 'concrete', 'terracotta', 'chest', 'furnace', 'crafting_table',
    'door', 'fence', 'stairs', 'slab', 'bed', 'torch', 'lantern'
];

function analyzeServer(ip, options = {}) {
    return new Promise((resolve) => {
        // Default auth to offline for scanning unless specified
        const botOptions = {
            host: ip,
            port: options.port || 25565,
            username: options.username || options.email || `Scanner${Math.floor(Math.random() * 1000)}`,
            auth: options.auth || 'offline',
            version: false, // Auto detect
            hideErrors: true
        };

        if (options.password) {
            botOptions.password = options.password;
        }

        const features = options.features || { structureScan: true, blockBreaking: true };
        const structureBlocks = options.structureBlocks || DEFAULT_ARTIFICIAL_BLOCKS;

        let data = {
            ip: ip,
            port: botOptions.port,
            online: false,
            version: null,
            motd: null,
            players: {
                max: 0,
                online: 0,
                sample: []
            },
            gamemode: null,
            structures: [],
            canBreakBlocks: false,
            spawnProtection: false
        };

        const bot = mineflayer.createBot(botOptions);
        let resolveCalled = false;

        const finish = () => {
            if (resolveCalled) return;
            resolveCalled = true;
            try {
                bot.quit();
            } catch (e) {}
            resolve(data);
        };

        // Timeout to prevent hanging
        const timeout = setTimeout(() => {
            finish();
        }, 30000); // 30 seconds max per server

        bot.on('error', (err) => {
           finish();
        });

        bot.on('end', () => {
            finish();
        });

        bot.on('kicked', (reason) => {
            data.kickReason = reason;
            finish();
        });

        bot.once('login', () => {
            data.online = true;
            data.version = bot.version;
        });
        
        bot.once('spawn', async () => {
            // Collect Game Info
            data.gamemode = bot.game.gameMode;
            
            // Wait a bit for chunks to load
            await bot.waitForChunksToLoad();
            
            // Collect Player Info
            if (bot.players) {
                 data.players.online = Object.keys(bot.players).length;
                 data.players.sample = Object.keys(bot.players).map(name => ({
                     name: name,
                     uuid: bot.players[name].uuid // if available
                 }));
            }

            // Structure Detection
            if (features.structureScan !== false) {
                scanForStructures(bot, data, structureBlocks);
            }

            // Block Breaking Test
            if (features.blockBreaking !== false) {
                try {
                    await testBlockBreaking(bot, data);
                } catch (e) {
                    // Ignore errors during testing
                }
            }

            finish();
        });
    });
}

function scanForStructures(bot, data, structureBlocks) {
    const range = 32;
    const position = bot.entity.position;

    // Find blocks in a cubic area around the player
    const blocks = bot.findBlocks({
        matching: (block) => {
            if (!block || !block.name) return false;
            // Check if any part of the name matches our artificial list
            return structureBlocks.some(art => block.name.includes(art));
        },
        maxDistance: range,
        count: 50 // Don't need thousands, just presence
    });

    // Map block positions to names, unique list
    const foundNames = new Set();
    blocks.forEach(vec => {
        const block = bot.blockAt(vec);
        if (block) foundNames.add(block.name);
    });

    data.structures = Array.from(foundNames);
}

async function testBlockBreaking(bot, data) {
    // Try to break the block below
    const target = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    
    if (!target || target.name === 'air' || target.name === 'bedrock') {
        // Can't really test here
        return;
    }

    try {
        await bot.dig(target);
        data.canBreakBlocks = true;
    } catch (err) {
        // Likely spawn protection or adventure mode
        data.spawnProtection = true;
        
        // Try to move away
        bot.setControlState('forward', true);
        bot.setControlState('sprint', true);
        // Jump occasionally
        const jumpInterval = setInterval(() => bot.setControlState('jump', true), 1000);
        
        await new Promise(r => setTimeout(r, 5000)); // Run for 5 seconds
        
        clearInterval(jumpInterval);
        bot.setControlState('forward', false);
        bot.setControlState('sprint', false);
        bot.setControlState('jump', false);

        // Try digging again at new location
        const newTarget = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (newTarget && newTarget.name !== 'air' && newTarget.name !== 'bedrock') {
             try {
                await bot.dig(newTarget);
                data.canBreakBlocks = true;
             } catch (e) {
                 // Still failed
             }
        }
    }
}

module.exports = { analyzeServer };
