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
    }

    // Applies the item's configured effects to the pet
    use(pet) {
        return pet.applyEffects(this.effects);
    }
}

module.exports = Item;
