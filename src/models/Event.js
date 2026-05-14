const { calculateEffects } = require('../util/effects');

/**
 * Represents a random occurrence that can trigger during the game loop.
 */
class Event {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.probability = data.probability || 0;
        this.requirements = data.requirements || {};
        this.effects = data.effects || {};
    }

    /**
     * Evaluates the current state (byte stats, player inventory, time of day)
     * against the event's configured requirements.
     */
    canOccur(context = {}) {
        const { byte, player, timePhase, dayOfWeek } = context;
        const req = this.requirements;

        if (!req || Object.keys(req).length === 0) return true;

        // 1. Room check
        if (req.room) {
            const roomAllowed = Array.isArray(req.room)
                ? req.room.includes(byte?.room)
                : byte?.room === req.room;
            if (!roomAllowed) return false;
        }

        // 2. Time Phase check (e.g., 'sunrise', 'day', 'sunset', 'night')
        if (req.timePhase && !req.timePhase.includes(timePhase)) return false;

        // 3. Day of Week check (0 = Sunday, 6 = Saturday)
        if (req.daysOfWeek && !req.daysOfWeek.includes(dayOfWeek)) return false;

        // 4. Categories check (min and max ranges)
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

        // 5. Energy check
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

        if (req.history && byte && byte.history) {
            for (const [key, range] of Object.entries(req.history)) {
                const historyValue = byte.history[key] || 0;
                if (range.min !== undefined && historyValue < range.min)
                    return false;
                if (range.max !== undefined && historyValue > range.max)
                    return false;
            }
        }

        if (req.inventory && player && player.inventory) {
            for (const [itemId, range] of Object.entries(req.inventory)) {
                const itemAmount = player.inventory[itemId] || 0;
                if (range.min !== undefined && itemAmount < range.min)
                    return false;
                if (range.max !== undefined && itemAmount > range.max)
                    return false;
            }
        }

        return true;
    }

    /**
     * Triggers the event if prerequisites are met, applying its effects to the byte
     * and potentially giving/taking items from the player's inventory.
     */
    occur(context = {}) {
        if (!this.canOccur(context)) return false;

        const { byte, player, itemManager } = context;
        if (!byte) return false;

        const calculatedEffects = calculateEffects(this.effects, byte, player);
        const success = byte.applyEffects(calculatedEffects);
        if (success) {
            // Log successful event occurrence
            byte.recordHistory(this.id);

            // Handle player energy
            if (calculatedEffects.energy && player) {
                if (calculatedEffects.energy > 0) {
                    player.energy.increase(calculatedEffects.energy);
                } else if (calculatedEffects.energy < 0) {
                    player.energy.decrease(Math.abs(calculatedEffects.energy));
                }
            }

            if (calculatedEffects.inventory && player) {
                for (const [itemId, amount] of Object.entries(
                    calculatedEffects.inventory,
                )) {
                    // Grant or revoke items
                    if (amount > 0) {
                        player.addItem(itemId, amount, itemManager);
                    } else if (amount < 0) {
                        player.removeItem(itemId, Math.abs(amount));
                    }
                }
            }
        }
        return success;
    }
}

module.exports = Event;
