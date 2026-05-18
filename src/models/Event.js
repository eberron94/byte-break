const { calculateEffects, applyEffects } = require('../util/effects');
const { checkRequirements } = require('../util/requirements');

/**
 * Represents a random occurrence that can trigger during the game loop.
 */
class Event {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.probability = data.probability || 0;
        this.requirements = data.requirements || [];
        this.effects = data.effects || {};
    }

    /**
     * Evaluates the current state (byte stats, player inventory, time of day)
     * against the event's configured requirements.
     */
    canOccur(context = {}) {
        return checkRequirements(
            this.requirements,
            context.byte,
            context.player,
            context.itemManager,
            context,
        );
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
        const success = applyEffects(
            calculatedEffects,
            byte,
            player,
            itemManager,
        );
        if (success) {
            // Log successful event occurrence
            byte.recordHistory(this.id);
        }
        return success;
    }
}

module.exports = Event;
