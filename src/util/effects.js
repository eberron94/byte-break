const LootManager = require('../managers/LootManager');
const exprCache = new Map();

/**
 * Evaluates a mathematical expression string using byte and player data.
 */
function evaluateExpression(expr, context) {
    if (typeof expr === 'number' || typeof expr === 'boolean') return expr;
    if (typeof expr === 'string') {
        try {
            const localKeys = Object.keys(context.locals).sort();
            const cacheKey = expr + '|' + localKeys.join(',');
            let func = exprCache.get(cacheKey);
            if (!func) {
                const args = ['byte', 'player', ...localKeys];
                func = new Function(...args, `return ${expr};`);
                exprCache.set(cacheKey, func);
            }
            const localValues = localKeys.map((k) => context.locals[k]);
            const result = func(context.byte, context.player, ...localValues);
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
function calculateEffects(effects, context) {
    if (!Array.isArray(effects)) {
        console.warn('`effects` is not an array. Please update JSON format.');
        return {};
    }

    const { byte, player } = context;
    const calculated = { inventory: {} };

    for (const effect of effects) {
        const key = effect.type;
        if (!key) continue;

        let shouldApply = true;

        if (effect.die !== undefined) {
            const dieSize = evaluateExpression(effect.die, context);
            if (dieSize < 1 || Math.floor(Math.random() * dieSize) + 1 !== 1) {
                shouldApply = false;
            }
        }

        if (shouldApply) {
            if (key === 'inventory') {
                if (effect.id && effect.amount !== undefined) {
                    const currentAmount = calculated.inventory[effect.id] || 0;
                    calculated.inventory[effect.id] =
                        currentAmount + evaluateExpression(effect.amount, context);
                }
            } else if (key === 'loot') {
                if (effect.table) {
                    if (!calculated.loot) calculated.loot = [];
                    calculated.loot.push(effect.table);
                }
            } else if (key === 'hediff') {
                if (!calculated.hediffs) calculated.hediffs = [];
                calculated.hediffs.push({
                    id: effect.id,
                    action: effect.action || 'escalate',
                });
            } else {
                if (effect.amount !== undefined) {
                    let value = evaluateExpression(effect.amount, context);
                    if (typeof value === 'number') {
                        const originalValue = value;
                        let currentAmount = calculated[key] || 0;

                        if (byte) {
                            let currentVal = 0;
                            if (byte.needs && byte.needs[key])
                                currentVal = byte.needs[key].value;
                            else if (byte.pools && byte.pools[key])
                                currentVal = byte.pools[key].value;
                            else if (byte.stats && byte.stats[key])
                                currentVal = byte.stats[key].baseValue;
                            else if (byte.skills && byte.skills[key])
                                currentVal = byte.skills[key].investedValue;
                            else if (
                                key === 'energy' &&
                                player &&
                                player.energy
                            )
                                currentVal = player.energy.value;

                            if (effect.maxLimit !== undefined) {
                                const maxLimit = evaluateExpression(
                                    effect.maxLimit, context,
                                );
                                if (
                                    value > 0 &&
                                    currentVal + currentAmount + value >
                                        maxLimit
                                ) {
                                    value = Math.max(
                                        0,
                                        maxLimit - (currentVal + currentAmount),
                                    );
                                }
                            }
                            if (effect.minLimit !== undefined) {
                                const minLimit = evaluateExpression(
                                    effect.minLimit, context,
                                );
                                if (
                                    value < 0 &&
                                    currentVal + currentAmount + value <
                                        minLimit
                                ) {
                                    value = Math.min(
                                        0,
                                        minLimit - (currentVal + currentAmount),
                                    );
                                }
                            }
                        }

                        // If limits squashed the delta to 0 or reversed its intended sign, clamp it tightly
                        if (
                            (originalValue > 0 && value < 0) ||
                            (originalValue < 0 && value > 0)
                        ) {
                            value = 0;
                        }

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
function applyEffects(calculatedEffects, context) {
    const { byte, player } = context;
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
                    player.addItem(itemId, amount);
                } else if (amount < 0) {
                    player.removeItem(itemId, Math.abs(amount));
                }
            }
        }
    }

    if (
        success &&
        calculatedEffects.loot &&
        Array.isArray(calculatedEffects.loot)
    ) {
        for (const tableId of calculatedEffects.loot) {
            const lootResults = LootManager.rollLoot(tableId);
            if (lootResults.bits && byte) {
                byte.pools.bits.increase(lootResults.bits);
            }
            if (lootResults.items && player) {
                lootResults.items.forEach((itemLoot) => {
                    player.addItem(itemLoot.id, itemLoot.amount);
                });
            }
        }
    }

    return success;
}

module.exports = { evaluateExpression, calculateEffects, applyEffects };
