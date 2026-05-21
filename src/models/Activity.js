const { calculateEffects, applyEffects } = require('../util/effects');
const { checkRequirements } = require('../util/requirements');
const { getTimeContext } = require('../util/time');
const ItemManager = require('../managers/ItemManager');

/**
 * Represents an action that a byte can perform, potentially consuming items or altering stats.
 */
class Activity {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.requirements = data.requirements || [];
        this.effects = data.effects || {};
        this.itemSelect = data.itemSelect || null;
        this.isWebView = data.isWebView || false;
        this.isMinigame = data.isMinigame || false;
        this.isCombat = data.isCombat || false;
        this.combat = data.combat || null;

        if (data.minigame) {
            this.minigameId = data.minigame.id || this.id;
            this.difficulty = data.minigame.difficulty || null;
            this.winEffects = data.minigame.winEffects || [];
            this.loseEffects = data.minigame.loseEffects || [];
        } else {
            this.minigameId = data.minigameId || this.id;
            this.difficulty = data.difficulty || null;
        }
    }

    /**
     * Checks if the byte and player meet all prerequisites to perform this activity.
     */
    canPerform(byte, player = null) {
        const context = getTimeContext();

        if (!checkRequirements(this.requirements, byte, player, context)) {
            return false;
        }

        // 6. If the activity requires an item selection, verify they have at least one valid item
        if (this.itemSelect && player) {
            let hasValidItem = false;
            for (const [itemId, amount] of Object.entries(player.inventory)) {
                if (amount > 0) {
                    const item = ItemManager.getItem(itemId);
                    if (item && !item.isOnCooldown(player)) {
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
    perform(byte, player = null, selectedItemId = null, override = false) {
        // Enforce prerequisites unless override is true
        if (!this.canPerform(byte, player) && !override) return false;

        const locals = getTimeContext();
        const calculatedEffects = calculateEffects(
            this.effects,
            byte,
            player,
            locals,
        );
        const success = applyEffects(calculatedEffects, byte, player);
        if (success) {
            byte.recordHistory(this.id);

            // Handle consumption of a user-selected item
            if (this.itemSelect && selectedItemId && player) {
                const item = ItemManager.getItem(selectedItemId);
                if (item && player.hasItem(selectedItemId, 1)) {
                    try {
                        item.use(byte, player);
                        // Only remove the item if it's consumed
                        if (item.isConsumed) {
                            player.removeItem(selectedItemId, 1);
                        }
                    } catch (err) {
                        console.error(
                            'Failed to use item during activity:',
                            err,
                        );
                    }
                }
            }
        }
        return success;
    }
}

module.exports = Activity;
