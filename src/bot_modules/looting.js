class ChestStealer {
    constructor(bot, wishlist = []) {
        this.bot = bot;
        this.wishlist = new Set(wishlist.length > 0 ? wishlist : [
            'diamond', 'emerald', 'gold_ingot', 'iron_ingot',
            'enchanted_book', 'totem_of_undying', 'golden_apple', 'enchanted_golden_apple',
            'beacon', 'shulker_shell', 'elytra', 'netherite_ingot', 'netherite_scrap',
            'diamond_block', 'gold_block', 'emerald_block', 'tnt'
        ]);
    }

    async steal(window) {
        if (!window) return;

        // Chest slots are from 0 to window.inventoryStart (exclusive)
        // But window.inventoryStart is sometimes just the number of slots?
        // Actually window.inventoryStart is the index where player inventory starts.
        // So 0 to inventoryStart-1 are chest slots.

        const chestEnd = window.inventoryStart;

        for (let i = 0; i < chestEnd; i++) {
            const item = window.slots[i];
            if (!item) continue;

            if (this.isValuable(item.name)) {
                try {
                    // Stochastic delay: 50ms to 150ms
                    const delay = Math.floor(Math.random() * 100) + 50;
                    await new Promise(r => setTimeout(r, delay));

                    // Shift click (mode 1, button 0)
                    await this.bot.clickWindow(i, 0, 1);
                } catch (e) {
                    // Ignore click errors
                }
            }
        }
    }

    isValuable(itemName) {
        // Check exact match or includes (e.g. 'diamond_sword')
        if (this.wishlist.has(itemName)) return true;
        // Heuristic: "diamond_", "netherite_"
        if (itemName.startsWith('diamond_') || itemName.startsWith('netherite_')) return true;
        if (itemName.endsWith('_shulker_box')) return true;
        return false;
    }
}

module.exports = { ChestStealer };
