const { calculateEffects, applyEffects } = require('../util/effects');
const { getTimeContext } = require('../util/time');

/**
 * Represents a distinct object that can be stored in a Player's inventory.
 */
class Item {
    constructor(data) {
        // Fallback to snake_case if an explicit ID is omitted
        this.id = data.id || data.name.toLowerCase().replace(/\s+/g, '_');
        this.name = data.name;
        this.shortname = data.shortname || data.name;
        this.description = data.description;
        this.type = data.type || 'general';
        // Safely set a huge cap if maxCount is not provided
        this.maxCount =
            data.maxCount !== undefined
                ? data.maxCount
                : Number.MAX_SAFE_INTEGER;
        this.effects = data.effects || {};
        this.cost = data.cost;
    }

    // Applies the item's configured effects to the byte and player
    use(byte, player = null, itemManager = null) {
        const locals = getTimeContext();
        const calculatedEffects = calculateEffects(this.effects, byte, player, locals);
        return applyEffects(calculatedEffects, byte, player, itemManager);
    }
}

module.exports = Item;
