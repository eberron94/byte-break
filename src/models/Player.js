/**
 * Represents a Telegram user, tracking their id and personal inventory.
 */
class Player {
    constructor(data) {
        this.id = data.id.toString();
        // Ensure inventory is safely parsed from JSON strings out of the database
        this.inventory =
            typeof data.inventory === 'string'
                ? JSON.parse(data.inventory)
                : data.inventory || {};
    }

    // Checks if the player holds at least the requested amount of an item
    hasItem(itemId, amount = 1) {
        return (this.inventory[itemId] || 0) >= amount;
    }

    // Safely increments an item's quantity in the inventory, abiding by max count limits
    addItem(itemId, amount = 1, itemManager = null) {
        if (!this.inventory[itemId]) {
            this.inventory[itemId] = 0;
        }
        this.inventory[itemId] += amount;

        if (itemManager) {
            const item = itemManager.getItem(itemId);
            if (item && item.maxCount !== undefined) {
                this.inventory[itemId] = Math.min(
                    this.inventory[itemId],
                    item.maxCount,
                );
            }
        }
    }

    // Removes an item quantity, fully deleting the key if empty
    removeItem(itemId, amount = 1) {
        if (!this.hasItem(itemId, amount)) return false;
        this.inventory[itemId] -= amount;
        if (this.inventory[itemId] <= 0) {
            delete this.inventory[itemId];
        }
        return true;
    }

    // Prepares the player object to be saved directly to the database
    serialize() {
        return {
            id: this.id,
            inventory: JSON.stringify(this.inventory),
        };
    }
}

module.exports = Player;
