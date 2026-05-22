const { calculateEffects, applyEffects } = require('../util/effects');
const { checkRequirements } = require('../util/requirements');
const LootManager = require('../managers/LootManager');

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
        this.effects = data.effects || [];
        this.ticksPerCheck = data.ticksPerCheck;
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
            context,
        );
    }

    /**
     * Triggers the event if prerequisites are met, applying its effects to the byte
     * and potentially giving/taking items from the player's inventory.
     */
    occur(context = {}) {
        if (!this.canOccur(context)) return false;

        const { byte, player } = context;
        if (!byte) return false;

        // Safely extract environment variables for effect evaluation
        const locals = { ...context, ...(context.locals || {}) };
        delete locals.byte;
        delete locals.player;

        const calculatedEffects = calculateEffects(
            this.effects,
            byte,
            player,
            locals,
        );

        let grantedLoot = null;
        if (
            calculatedEffects.loot ||
            calculatedEffects.bits ||
            (calculatedEffects.inventory &&
                Object.keys(calculatedEffects.inventory).length > 0)
        ) {
            grantedLoot = LootManager.processLoot(calculatedEffects, player);
        }

        const success = applyEffects(calculatedEffects, byte, player);
        if (success) {
            // Log successful event occurrence
            byte.recordHistory(this.id);
        }
        return { success, grantedLoot };
    }
}

module.exports = Event;
