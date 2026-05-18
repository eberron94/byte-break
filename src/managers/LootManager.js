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

    processLoot(effectsObj) {
        const result = {
            bits: effectsObj.bits || 0,
            items: Object.entries(effectsObj.inventory || {}).map(([id, amount]) => ({ id, amount }))
        };
        if (effectsObj.loot) {
            for (const tableId of effectsObj.loot) {
                const lootResults = this.rollLoot(tableId);
                if (lootResults.bits) {
                    result.bits += lootResults.bits;
                    effectsObj.bits = (effectsObj.bits || 0) + lootResults.bits;
                }
                if (lootResults.items) {
                    lootResults.items.forEach(itemLoot => {
                        const existing = result.items.find(i => i.id === itemLoot.id);
                        if (existing) existing.amount += itemLoot.amount;
                        else result.items.push({ id: itemLoot.id, amount: itemLoot.amount });

                        effectsObj.inventory = effectsObj.inventory || {};
                        effectsObj.inventory[itemLoot.id] = (effectsObj.inventory[itemLoot.id] || 0) + itemLoot.amount;
                    });
                }
            }
            delete effectsObj.loot; // Delete so applyEffects doesn't double-roll
        }
        return result;
    }
}
module.exports = new LootManager();