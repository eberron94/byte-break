/**
 * Evaluates a mathematical expression string using byte and player data.
 */
function evaluateExpression(expr, byte, player) {
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'string') {
        try {
            const func = new Function('byte', 'player', `return ${expr};`);
            const result = func(byte, player);
            return isNaN(result) ? 0 : Math.floor(result);
        } catch (err) {
            console.error(`Failed to evaluate expression: ${expr}`, err);
            return 0;
        }
    }
    return expr;
}

/**
 * Calculates the effects based on static values or expressions.
 */
function calculateEffects(effects, byte, player) {
    const calculated = {};
    for (const [key, value] of Object.entries(effects)) {
        if (key === 'inventory') {
            calculated[key] = {};
            for (const [itemId, amt] of Object.entries(value)) {
                calculated[key][itemId] = evaluateExpression(amt, byte, player);
            }
        } else {
            calculated[key] = evaluateExpression(value, byte, player);
        }
    }
    return calculated;
}

module.exports = { evaluateExpression, calculateEffects };
