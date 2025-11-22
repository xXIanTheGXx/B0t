const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const minecraftData = require('minecraft-data');

function setupPathfinder(bot) {
    if (!bot.pathfinder) {
        bot.loadPlugin(pathfinder);
    }
}

function configureMovements(bot) {
    if (!bot.version) return null;

    const mcData = minecraftData(bot.version);
    const movements = new Movements(bot, mcData);

    // Safety & Anarchy Heuristics

    // Don't break blocks unless necessary (stealth)
    movements.canDig = false;

    // Avoid towering (unsafe in pvp)
    movements.allow1by1towers = false;

    // Enable Parkour for rugged terrain
    movements.allowParkour = true;

    // High cost for liquids (Lava/Water)
    movements.liquidCost = 50;

    // Infinite cost for lava specifically if possible, but liquidCost covers it.
    // We can also set specific block costs if needed.

    return movements;
}

module.exports = {
    setupPathfinder,
    configureMovements,
    goals
};
