const mineflayer = require('mineflayer');
const vec3 = require('vec3');
const { setupPathfinder, configureMovements } = require('./bot_modules/navigation');
const { createAgent } = require('./bot_modules/behavior');
const { scanEnvironment } = require('./bot_modules/perception');
const { ChestStealer } = require('./bot_modules/looting');
const { setupProxy } = require('./bot_modules/proxy');
const DiscordNotifier = require('./notifications');

function analyzeServer(ip, options = {}) {
    return new Promise((resolve) => {
        // Default auth to offline for scanning unless specified
        const botOptions = {
            host: ip,
            port: options.port || 25565,
            username: options.username || options.email || `Scanner${Math.floor(Math.random() * 1000)}`,
            auth: options.auth || options.type || 'offline',
            version: false, // Auto detect
            hideErrors: true
        };

        if (options.password) {
            botOptions.password = options.password;
        }

        // Setup Proxy
        if (options.proxy) {
            setupProxy(botOptions, options.proxy);
        }

        const features = options.features || { structureScan: true, blockBreaking: true };

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
            density: {},
            rare: [],
            canBreakBlocks: false,
            spawnProtection: false
        };

        const bot = mineflayer.createBot(botOptions);
        let resolveCalled = false;
        let notifier = null;

        if (options.discord && options.discord.webhookUrl) {
            notifier = new DiscordNotifier(options.discord.webhookUrl);
        }

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
        }, 20000); // 20 seconds max per server

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

            // Setup Navigation & Agent
            try {
                setupPathfinder(bot);
                const moves = configureMovements(bot);
                if (moves) bot.pathfinder.setMovements(moves);

                if (options.agent && options.agent.enabled) {
                    createAgent(bot);
                }
            } catch (e) {
                // Ignore agent setup errors
            }
            
            // Wait a bit for chunks to load, but don't hang forever
            try {
                await Promise.race([
                    bot.waitForChunksToLoad(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Chunk load timeout')), 5000))
                ]);
            } catch (e) {
                // Continue even if chunks didn't fully load
            }
            
            // Collect Player Info
            if (bot.players) {
                 data.players.online = Object.keys(bot.players).length;
                 data.players.sample = Object.keys(bot.players).map(name => ({
                     name: name,
                     uuid: bot.players[name].uuid // if available
                 }));
            }

            // Looting / Chest Stealer
            if (options.looting && options.looting.enabled) {
                const stealer = new ChestStealer(bot, options.looting.wishlist);
                bot.on('windowOpen', (window) => {
                    stealer.steal(window);
                });
            }

            // Structure Detection
            if (features.structureScan !== false) {
                const env = scanEnvironment(bot);
                data.structures = env.structures;
                data.density = env.density;
                data.rare = env.rare;

                if (data.structures.length > 0 && notifier) {
                    const rareText = data.rare.map(r => `${r.name} at ${r.pos}`).join('\n');
                    notifier.send(
                        'Structures Found',
                        `Found ${data.structures.length} types of structures on ${ip}`,
                        0x00FF00,
                        [
                            { name: 'Structures', value: data.structures.join(', '), inline: false },
                            { name: 'Rare Blocks', value: rareText || 'None', inline: false },
                            { name: 'Version', value: bot.version, inline: true }
                        ]
                    );
                }
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
