const { calculateEffects } = require('../util/effects');

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
    use(byte, player = null) {
        const calculatedEffects = calculateEffects(this.effects, byte, player);
        const success = byte.applyEffects(calculatedEffects);
        if (success && player && calculatedEffects.energy) {
            if (calculatedEffects.energy > 0) {
                player.energy.increase(calculatedEffects.energy);
            } else if (calculatedEffects.energy < 0) {
                player.energy.decrease(Math.abs(calculatedEffects.energy));
            }
        }
        return success;
    }
}

module.exports = Item;
