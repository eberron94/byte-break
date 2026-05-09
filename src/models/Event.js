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
     * Evaluates the current state (pet stats, player inventory, time of day)
     * against the event's configured requirements.
     */
    canOccur(context = {}) {
        const { pet, player, timePhase, dayOfWeek } = context;
        const req = this.requirements;

        if (!req || Object.keys(req).length === 0) return true;

        // 1. Room check
        if (req.room) {
            const roomAllowed = Array.isArray(req.room)
                ? req.room.includes(pet?.room)
                : pet?.room === req.room;
            if (!roomAllowed) return false;
        }

        // 2. Time Phase check (e.g., 'sunrise', 'day', 'sunset', 'night')
        if (req.timePhase && !req.timePhase.includes(timePhase)) return false;

        // 3. Day of Week check (0 = Sunday, 6 = Saturday)
        if (req.daysOfWeek && !req.daysOfWeek.includes(dayOfWeek)) return false;

        // 4. Categories check (min and max ranges)
        const categories = ['needs', 'stats', 'skills', 'pools'];
        for (const category of categories) {
            if (req[category] && pet && pet[category]) {
                for (const [key, range] of Object.entries(req[category])) {
                    const itemValue = pet[category][key]?.value;
                    if (itemValue === undefined) continue;
                    if (range.min !== undefined && itemValue < range.min)
                        return false;
                    if (range.max !== undefined && itemValue > range.max)
                        return false;
                }
            }
        }

        // 5. Energy check
        if (req.energy && pet && pet.energy) {
            if (
                req.energy.min !== undefined &&
                pet.energy.value < req.energy.min
            )
                return false;
            if (
                req.energy.max !== undefined &&
                pet.energy.value > req.energy.max
            )
                return false;
        }

        if (req.history && pet && pet.history) {
            for (const [key, range] of Object.entries(req.history)) {
                const historyValue = pet.history[key] || 0;
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
     * Triggers the event if prerequisites are met, applying its effects to the pet
     * and potentially giving/taking items from the player's inventory.
     */
    occur(context = {}) {
        if (!this.canOccur(context)) return false;

        const { pet, player, itemManager } = context;
        if (!pet) return false;

        const success = pet.applyEffects(this.effects);
        if (success) {
            // Log successful event occurrence
            pet.recordHistory(this.id);

            if (this.effects.inventory && player) {
                for (const [itemId, amount] of Object.entries(
                    this.effects.inventory,
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
