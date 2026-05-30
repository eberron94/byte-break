const GameContext = require('./GameContext');
const LootManager = require('../managers/LootManager');

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
        this.equipLabel = data.equipLabel || null; // Cosmetic label (e.g., "Payload", "Daemon", "Processor")
        this.modifiers = data.modifiers || []; // Array of passive stat/skill boosts
        this.tickEffects = data.tickEffects || []; // Effects run during global tick while equipped
        this.useEffects = data.useEffects || [];
        this.cost = data.cost;
        this.isConsumed =
            data.isConsumed !== undefined
                ? data.isConsumed
                : this.type === 'consumable';
        this.cooldown = data.cooldown || 0;
    }

    isOnCooldown(player) {
        if (this.cooldown <= 0 || !player) return false;
        const lastUsedStr = player.history[`item_used_${this.id}`];
        if (!lastUsedStr) return false;
        const lastUsed = new Date(lastUsedStr).getTime();
        const now = Date.now();
        const diffMins = (now - lastUsed) / (1000 * 60);
        return diffMins < this.cooldown;
    }

    getCooldownRemaining(player) {
        if (this.cooldown <= 0 || !player) return 0;
        const lastUsedStr = player.history[`item_used_${this.id}`];
        if (!lastUsedStr) return 0;
        const lastUsed = new Date(lastUsedStr).getTime();
        const now = Date.now();
        const diffMins = (now - lastUsed) / (1000 * 60);
        if (diffMins >= this.cooldown) return 0;
        return Math.ceil(this.cooldown - diffMins);
    }

    // Applies the item's configured effects to the byte and player
    use(context) {
        const { calculateEffects, applyEffects } = require('../util/effects');
        if (this.isOnCooldown(context.player)) {
            throw new Error(
                `Item is on cooldown. Wait ${this.getCooldownRemaining(context.player)} minute(s).`,
            );
        }
        const calculatedEffects = calculateEffects(this.useEffects, context);

        // Pre-process any loot so it can be extracted and reported to the UI
        let grantedLoot = null;
        if (
            calculatedEffects.loot ||
            calculatedEffects.bits ||
            (calculatedEffects.inventory &&
                Object.keys(calculatedEffects.inventory).length > 0)
        ) {
            grantedLoot = LootManager.processLoot(
                calculatedEffects,
                context,
            );
        }

        const success = applyEffects(calculatedEffects, context);

        if (success && this.cooldown > 0 && context.player) {
            context.player.history[`item_used_${this.id}`] =
                new Date().toISOString();
        }

        return { success, grantedLoot, calculatedEffects };
    }
}

module.exports = Item;
