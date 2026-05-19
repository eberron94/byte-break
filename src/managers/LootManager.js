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

    processLoot(effectsObj, player = null, itemManager = null) {
        const result = {
            bits: effectsObj.bits || 0,
            items: []
        };

        // Helper to check the inventory maximum constraint
        const getActualAmount = (id, amount) => {
            let actual = amount;
            if (player && itemManager) {
                const itemDef = itemManager.getItem(id);
                if (itemDef && itemDef.maxCount !== undefined) {
                    const currentCount = player.inventory[id] || 0;
                    const pendingCount = result.items.find(i => i.id === id)?.amount || 0;
                    const maxAddable = Math.max(0, itemDef.maxCount - (currentCount + pendingCount));
                    actual = Math.min(actual, maxAddable);
                }
            }
            return actual;
        };

        // Pre-process any explicit inventory drops in the payload
        if (effectsObj.inventory) {
            Object.entries(effectsObj.inventory).forEach(([id, amount]) => {
                if (amount > 0) {
                    const actualAmount = getActualAmount(id, amount);
                    if (actualAmount > 0) {
                        result.items.push({ id, amount: actualAmount });
                    }
                    effectsObj.inventory[id] = actualAmount; // Clamp the payload
                }
            });
        }

        if (effectsObj.loot) {
            for (const tableId of effectsObj.loot) {
                const lootResults = this.rollLoot(tableId);
                if (lootResults.bits) {
                    result.bits += lootResults.bits;
                    effectsObj.bits = (effectsObj.bits || 0) + lootResults.bits;
                }
                if (lootResults.items) {
                    lootResults.items.forEach(itemLoot => {
                        const actualAmount = getActualAmount(itemLoot.id, itemLoot.amount);
                        
                        if (actualAmount > 0) {
                            const existing = result.items.find(i => i.id === itemLoot.id);
                            if (existing) existing.amount += actualAmount;
                            else result.items.push({ id: itemLoot.id, amount: actualAmount });

                            effectsObj.inventory = effectsObj.inventory || {};
                            effectsObj.inventory[itemLoot.id] = (effectsObj.inventory[itemLoot.id] || 0) + actualAmount;
                        }
                    });
                }
            }
            delete effectsObj.loot; // Delete so applyEffects doesn't double-roll
        }
        return result;
    }
}
module.exports = new LootManager();