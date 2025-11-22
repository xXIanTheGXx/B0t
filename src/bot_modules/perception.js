const UNNATURAL_BLOCKS = [
    'chest', 'trapped_chest', 'ender_chest', 'shulker_box',
    'furnace', 'blast_furnace', 'smoker',
    'crafting_table', 'anvil', 'enchanting_table', 'brewing_stand',
    'beacon', 'bed', 'cake', 'bell', 'jukebox', 'noteblock',
    'skeleton_skull', 'wither_skeleton_skull', 'player_head', 'dragon_head', 'creeper_head', 'zombie_head',
    'dragon_egg', 'spawner'
];

const RARE_BLOCKS = [
    'beacon', 'shulker_box', 'dragon_egg', 'conduit', 'end_portal_frame', 'command_block', 'structure_block', 'spawner'
];

function scanEnvironment(bot, radius = 32) {
    const result = {
        structures: [], // List of found types
        density: {},    // Count of each type
        rare: []        // Coordinates of rare blocks
    };

    if (!bot.findBlocks) return result;

    const blocks = bot.findBlocks({
        matching: (block) => {
            if (!block || !block.name) return false;
            return UNNATURAL_BLOCKS.some(name => block.name.includes(name));
        },
        maxDistance: radius,
        count: 100
    });

    const foundTypes = new Set();

    blocks.forEach(vec => {
        const block = bot.blockAt(vec);
        if (!block) return;

        let name = block.name;
        // Normalize names
        if (name.includes('shulker_box')) name = 'shulker_box';
        if (name.includes('bed') && !name.includes('bedrock')) name = 'bed';
        if (name.includes('banner')) name = 'banner';

        foundTypes.add(name);
        result.density[name] = (result.density[name] || 0) + 1;

        // Check for rare
        if (RARE_BLOCKS.some(r => block.name.includes(r))) {
            result.rare.push({ name: block.name, pos: vec });
        }
    });

    result.structures = Array.from(foundTypes);
    return result;
}

module.exports = {
    scanEnvironment,
    UNNATURAL_BLOCKS,
    RARE_BLOCKS
};
