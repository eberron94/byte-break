const Item = require('../models/Item');
const itemsData = require('../../data/items.json');

/**
 * Loads and handles the catalog of items available within the game.
 */
class ItemManager {
    constructor() {
        this.items = new Map();
        this.load();
    }

    // Ingests items from the JSON configuration file
    load() {
        if (!Array.isArray(itemsData)) {
            console.error(
                '[ItemManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        itemsData.forEach((data, index) => {
            if (!data.name) {
                console.warn(
                    `[ItemManager] Skipping invalid item at index ${index}: Missing required 'name'`,
                );
                return;
            }
            const item = new Item(data);
            this.items.set(item.id, item);
        });
    }

    // Finds a specific item model by ID
    getItem(id) {
        return this.items.get(id);
    }

    // Returns all loaded items as an array
    getAllItems() {
        return Array.from(this.items.values());
    }
}
module.exports = new ItemManager();
