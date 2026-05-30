const lootData = require('../../data/loot.json');
const ItemManager = require('./ItemManager');
const LuckManager = require('./LuckManager');

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

    rollLoot(tableId, context = { locals: {} }) {
        const table = this.getLoot(tableId);
        if (!table) return { bits: 0, items: [] };

        const { evaluateExpression } = require('../util/effects');
        const result = { bits: table.bits || 0, items: [] };

        if (typeof result.bits === 'string') {
            result.bits = evaluateExpression(result.bits, context);
        }

        if (table.items) {
            table.items.forEach(item => {
                let shouldDrop = true;

                if (item.die !== undefined) {
                    const dieSize = evaluateExpression(item.die, context);
                    if (dieSize < 1 || Math.floor(Math.random() * dieSize) + 1 !== 1) {
                        shouldDrop = false;
                    }
                } else if (item.diceCheck) {
                    const poolSize = evaluateExpression(item.diceCheck.pool || 1, context);
                    const requiredSuccesses = evaluateExpression(item.diceCheck.successes || 1, context);
                    const threshold = evaluateExpression(item.diceCheck.threshold || 3, context);
                    const sides = evaluateExpression(item.diceCheck.sides || 6, context);
                    if (poolSize > 0) {
                        const rolls = LuckManager.rollCustomDice(poolSize, sides);
                        const successes = LuckManager.countSuccesses(rolls, threshold);
                        if (successes < requiredSuccesses) {
                            shouldDrop = false;
                        }
                    } else {
                        shouldDrop = false;
                    }
                } else if (item.chance !== undefined) {
                    const chance = typeof item.chance === 'string' ? evaluateExpression(item.chance, context) : item.chance;
                    if (Math.random() > chance) {
                        shouldDrop = false;
                    }
                }

                if (shouldDrop) {
                    let amount = 1;
                    if (item.dicePool !== undefined) {
                        const poolSize = evaluateExpression(item.dicePool, context);
                        const sides = item.diceSides !== undefined ? evaluateExpression(item.diceSides, context) : 6;
                        const threshold = item.diceThreshold !== undefined ? evaluateExpression(item.diceThreshold, context) : 3;
                        const rolls = LuckManager.rollCustomDice(poolSize, sides);
                        const successes = LuckManager.countSuccesses(rolls, threshold);
                        
                        // Inject successCount for the amount evaluation
                        const tempContext = { 
                            byte: context.byte, 
                            player: context.player, 
                            locals: { ...(context.locals || {}), successCount: successes } 
                        };
                        amount = item.amount !== undefined ? evaluateExpression(item.amount, tempContext) : successes;
                    } else if (item.amount !== undefined) {
                        amount = evaluateExpression(item.amount, context);
                    }
                    
                    if (amount > 0) {
                        result.items.push({ id: item.id, amount });
                    }
                }
            });
        }
        return result;
    }

    processLoot(effectsObj, context = { locals: {} }) {
        const player = context.player || null;
        const result = {
            bits: effectsObj.bits || 0,
            items: []
        };

        // Helper to check the inventory maximum constraint
        const getActualAmount = (id, amount) => {
            let actual = amount;
            if (player) {
                const itemDef = ItemManager.getItem(id);
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
                const lootResults = this.rollLoot(tableId, context);
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