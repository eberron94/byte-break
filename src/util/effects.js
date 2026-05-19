const LootManager = require('../managers/LootManager');
const exprCache = new Map();

/**
 * Evaluates a mathematical expression string using byte and player data.
 */
function evaluateExpression(expr, byte, player, locals = {}) {
    if (typeof expr === 'number' || typeof expr === 'boolean') return expr;
    if (typeof expr === 'string') {
        try {
            const localKeys = Object.keys(locals).sort();
            const cacheKey = expr + '|' + localKeys.join(',');
            let func = exprCache.get(cacheKey);
            if (!func) {
                const args = ['byte', 'player', ...localKeys];
                func = new Function(...args, `return ${expr};`);
                exprCache.set(cacheKey, func);
            }
            const localValues = localKeys.map(k => locals[k]);
            const result = func(byte, player, ...localValues);
            if (typeof result === 'number')
                return isNaN(result) ? 0 : Math.floor(result);
            return result;
        } catch (err) {
            console.error(`Failed to evaluate expression: ${expr}`, err);
            return 0;
        }
    }
    return expr;
}

/**
 * Calculates the effects based on an array of effect objects.
 */
function calculateEffects(effects, byte, player, locals = {}) {
    if (!Array.isArray(effects)) {
        console.warn('`effects` is not an array. Please update JSON format.');
        return {};
    }

    const calculated = { inventory: {} };

    for (const effect of effects) {
        const key = effect.type;
        if (!key) continue;

        let shouldApply = true;

        if (effect.die !== undefined) {
            const dieSize = evaluateExpression(effect.die, byte, player, locals);
            if (dieSize < 1 || Math.floor(Math.random() * dieSize) + 1 !== 1) {
                shouldApply = false;
            }
        }

        if (shouldApply) {
            if (key === 'inventory') {
                if (effect.id && effect.amount !== undefined) {
                    const currentAmount = calculated.inventory[effect.id] || 0;
                    calculated.inventory[effect.id] =
                        currentAmount +
                        evaluateExpression(effect.amount, byte, player, locals);
                }
            } else if (key === 'loot') {
                if (effect.table) {
                    if (!calculated.loot) calculated.loot = [];
                    calculated.loot.push(effect.table);
                }
            } else if (key === 'hediff') {
                if (!calculated.hediffs) calculated.hediffs = [];
                calculated.hediffs.push({ id: effect.id, action: effect.action || 'escalate' });
            } else {
                if (effect.amount !== undefined) {
                    const value = evaluateExpression(effect.amount, byte, player, locals);
                    if (typeof value === 'number') {
                        const currentAmount = calculated[key] || 0;
                        calculated[key] = currentAmount + value;
                    } else {
                        calculated[key] = value;
                    }
                }
            }
        }
    }
    return calculated;
}

/**
 * Safely routes and applies calculated effect deltas to the respective objects.
 */
function applyEffects(
    calculatedEffects,
    byte,
    player = null,
    itemManager = null,
) {
    let success = true;
    if (byte) {
        success = byte.applyEffects(calculatedEffects);
    }
    if (success && player) {
        if (calculatedEffects.energy) {
            if (calculatedEffects.energy > 0) {
                player.energy.increase(calculatedEffects.energy);
            } else if (calculatedEffects.energy < 0) {
                player.energy.decrease(Math.abs(calculatedEffects.energy));
            }
        }
        if (calculatedEffects.inventory) {
            for (const [itemId, amount] of Object.entries(
                calculatedEffects.inventory,
            )) {
                if (amount > 0) {
                    player.addItem(itemId, amount, itemManager);
                } else if (amount < 0) {
                    player.removeItem(itemId, Math.abs(amount));
                }
            }
        }
    }

    if (success && calculatedEffects.loot && Array.isArray(calculatedEffects.loot)) {
        for (const tableId of calculatedEffects.loot) {
            const lootResults = LootManager.rollLoot(tableId);
            if (lootResults.bits && byte) {
                byte.pools.bits.increase(lootResults.bits);
            }
            if (lootResults.items && player && itemManager) {
                lootResults.items.forEach((itemLoot) => {
                    player.addItem(itemLoot.id, itemLoot.amount, itemManager);
                });
            }
        }
    }

    return success;
}

module.exports = { evaluateExpression, calculateEffects, applyEffects };
