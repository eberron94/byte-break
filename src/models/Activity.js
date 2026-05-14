const { calculateEffects } = require('../util/effects');

/**
 * Represents an action that a byte can perform, potentially consuming items or altering stats.
 */
class Activity {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.prereq = data.prereq || {};
        this.effects = data.effects || {};
        this.itemSelect = data.itemSelect || null;
        this.isWebView = data.isWebView || false;
    }

    /**
     * Checks if the byte and player meet all prerequisites to perform this activity.
     */
    canPerform(byte, player = null, itemManager = null) {
        const req = this.prereq;
        if (!req || Object.keys(req).length === 0) return true;

        // 1. Check if the byte is in the correct room
        if (req.room && byte) {
            const roomAllowed = Array.isArray(req.room)
                ? req.room.includes(byte.room)
                : byte.room === req.room;
            if (!roomAllowed) return false;
        }

        // 2. Check all stat/skill/need/pool thresholds
        const categories = ['needs', 'stats', 'skills', 'pools'];
        for (const category of categories) {
            if (req[category] && byte && byte[category]) {
                for (const [key, range] of Object.entries(req[category])) {
                    const item = byte[category][key];
                    if (!item) continue;

                    // Value checks
                    if (item.value !== undefined) {
                        // Legacy flat range checks (applies to current value)
                        if (range.min !== undefined && item.value < range.min)
                            return false;
                        if (range.max !== undefined && item.value > range.max)
                            return false;

                        // Explicit current value checks
                        if (range.value) {
                            if (
                                range.value.min !== undefined &&
                                item.value < range.value.min
                            )
                                return false;
                            if (
                                range.value.max !== undefined &&
                                item.value > range.value.max
                            )
                                return false;
                        }
                    }

                    // Explicit max value checks
                    if (item.maxValue !== undefined && range.maxValue) {
                        if (
                            range.maxValue.min !== undefined &&
                            item.maxValue < range.maxValue.min
                        )
                            return false;
                        if (
                            range.maxValue.max !== undefined &&
                            item.maxValue > range.maxValue.max
                        )
                            return false;
                    }
                }
            }
        }

        // 3. Check energy thresholds separately since it's an isolated stat
        if (req.energy && player && player.energy) {
            if (
                req.energy.min !== undefined &&
                player.energy.value < req.energy.min
            )
                return false;
            if (
                req.energy.max !== undefined &&
                player.energy.value > req.energy.max
            )
                return false;
        }

        // 4. Check historical occurrences
        if (req.history && byte && byte.history) {
            for (const [key, range] of Object.entries(req.history)) {
                const historyValue = byte.history[key] || 0;
                if (range.min !== undefined && historyValue < range.min)
                    return false;
                if (range.max !== undefined && historyValue > range.max)
                    return false;
            }
        }

        // 5. Check if player has the required inventory items
        if (req.inventory && player && player.inventory) {
            for (const [itemId, range] of Object.entries(req.inventory)) {
                const itemAmount = player.inventory[itemId] || 0;
                if (range.min !== undefined && itemAmount < range.min)
                    return false;
                if (range.max !== undefined && itemAmount > range.max)
                    return false;
            }
        }

        // 6. If the activity requires an item selection, verify they have at least one valid item
        if (this.itemSelect && player && itemManager) {
            let hasValidItem = false;
            for (const [itemId, amount] of Object.entries(player.inventory)) {
                if (amount > 0) {
                    const item = itemManager.getItem(itemId);
                    if (item) {
                        if (
                            this.itemSelect.type &&
                            item.type === this.itemSelect.type
                        )
                            hasValidItem = true;
                        if (
                            this.itemSelect.ids &&
                            this.itemSelect.ids.includes(item.id)
                        )
                            hasValidItem = true;
                    }
                }
            }
            if (!hasValidItem) return false;
        }

        return true;
    }

    /**
     * Executes the activity, applies its effects, logs history, and consumes items.
     */
    perform(
        byte,
        player = null,
        itemManager = null,
        selectedItemId = null,
        override = false,
    ) {
        // Enforce prerequisites unless override is true
        if (!this.canPerform(byte, player, itemManager) && !override)
            return false;

        const calculatedEffects = calculateEffects(this.effects, byte, player);
        const success = byte.applyEffects(calculatedEffects);
        if (success) {
            byte.recordHistory(this.id);

            // Handle player energy
            if (calculatedEffects.energy && player) {
                if (calculatedEffects.energy > 0) {
                    player.energy.increase(calculatedEffects.energy);
                } else if (calculatedEffects.energy < 0) {
                    player.energy.decrease(Math.abs(calculatedEffects.energy));
                }
            }

            // Grant or remove items as a result of the activity
            if (calculatedEffects.inventory && player) {
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

            // Handle consumption of a user-selected item
            if (this.itemSelect && selectedItemId && itemManager && player) {
                const item = itemManager.getItem(selectedItemId);
                if (item && player.hasItem(selectedItemId, 1)) {
                    item.use(byte, player);
                    // Only remove the item if it's consumable
                    if (item.type === 'consumable') {
                        player.removeItem(selectedItemId, 1);
                    }
                }
            }
        }
        return success;
    }
}

module.exports = Activity;
