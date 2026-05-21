const Energy = require('./Energy');
const AchievementPoints = require('./pools/AchievementPoints');
const ItemManager = require('../managers/ItemManager');

/**
 * Represents a Telegram user, tracking their id and personal inventory.
 */
class Player {
    constructor(data) {
        this.id = data.id.toString();
        this.inventory = data.inventory || {};
        const energyData = typeof data.energy === 'object' && data.energy !== null ? data.energy : { value: data.energy !== undefined ? data.energy : 100, maxValue: 100 };
        this.energy = new Energy(energyData.value, energyData.maxValue);
        
        this.joinDate = data.joinDate ? new Date(data.joinDate) : new Date();
        
        this.history = data.history || {};
        this.maxBytes = data.maxBytes || 2;
        this.lastAction = data.lastAction
            ? new Date(data.lastAction)
            : new Date();
        this.achievementPoints = new AchievementPoints(
            {
                progress: data.achievements || {},
            },
            this,
        );
        this.talents = data.talents || {};
        this.settings = data.settings || {};

        // Handle daily resets (resets shop stock at UTC midnight)
        const today = new Date().toISOString().split('T')[0];
        if (this.history['last_login_date'] !== today) {
            for (const key of Object.keys(this.history)) {
                if (key.startsWith('shop_')) {
                    delete this.history[key];
                }
            }
            this.history['last_login_date'] = today;
        }
    }

    // Restores energy over time
    tick(byte = null) {
        this.energy.increase(1);
    }

    // Checks if the player holds at least the requested amount of an item
    hasItem(itemId, amount = 1) {
        return (this.inventory[itemId] || 0) >= amount;
    }

    // Safely increments an item's quantity in the inventory, abiding by max count limits
    addItem(itemId, amount = 1) {
        if (!this.inventory[itemId]) {
            this.inventory[itemId] = 0;
        }
        this.inventory[itemId] += amount;

        const item = ItemManager.getItem(itemId);
        if (item && item.maxCount !== undefined) {
            this.inventory[itemId] = Math.min(
                this.inventory[itemId],
                item.maxCount,
            );
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

    // Logs an activity or event occurrence to the player's historical record
    recordHistory(id) {
        if (!this.history[id]) {
            this.history[id] = 0;
        }
        this.history[id]++;
    }

    /**
     * Refunds all invested achievement points from Talents.
     * @returns {boolean} True if talents were refunded, false if there were none to refund.
     */
    refundAchievementPoints() {
        let hasInvestments = false;
        for (const key of Object.keys(this.talents)) {
            if (this.talents[key] > 0) {
                hasInvestments = true;
                break;
            }
        }

        if (!hasInvestments) return false;

        this.talents = {};
        return true;
    }

    // Prepares the player object to be saved directly to the database
    serialize() {
        return {
            id: this.id,
            inventory: this.inventory,
            energy: { value: this.energy.value, maxValue: this.energy.maxValue },
            joinDate: this.joinDate.toISOString(),
            history: this.history,
            maxBytes: this.maxBytes,
            lastAction: this.lastAction.toISOString(),
            talents: this.talents,
            settings: this.settings,
            achievements: this.achievementPoints.progress,
        };
    }

    // Prepares the player object with additional calculated properties for the Web API
    toWeb() {
        const data = this.serialize();
        data.availableAchievementPoints = this.achievementPoints.available;
        data.achievementPoints = this.achievementPoints.value;
        return data;
    }
}

module.exports = Player;
