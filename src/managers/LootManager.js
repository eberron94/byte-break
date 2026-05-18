const lootData = require('../../data/loot.json');

class LootManager {
    constructor() {
        this.lootTables = new Map();
        this.load();
    }

    load() {
        if (typeof lootData !== 'object') {
            console.error('[LootManager] Invalid JSON structure: Expected an object.');
            return;
        }
        Object.entries(lootData).forEach(([id, table]) => {
            this.lootTables.set(id, table);
        });
    }

    getLoot(tableId) {
        return this.lootTables.get(tableId);
    }

    rollLoot(tableId) {
        const table = this.getLoot(tableId);
        if (!table) return { bits: 0, items: [] };

        const result = { bits: table.bits || 0, items: [] };
        if (table.items) {
            table.items.forEach(item => {
                const chance = item.chance !== undefined ? item.chance : 1.0;
                if (Math.random() <= chance) {
                    result.items.push({ id: item.id, amount: item.amount || 1 });
                }
            });
        }
        return result;
    }
}
module.exports = new LootManager();