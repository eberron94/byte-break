const { checkRequirements } = require('../util/requirements');
const ItemManager = require('../managers/ItemManager');

class CraftRecipe {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description || '';
        this.ingredients = data.ingredients || []; // [{ id, amount }]
        this.outcome = data.outcome || []; // [{ id, amount }]
        this.requirements = data.requirements || [];
        this.extraOutcome = data.extraOutcome || null;
    }

    isUnlocked(context) {
        return checkRequirements(this.requirements, context);
    }

    canCraft(context) {
        if (!this.isUnlocked(context)) return false;

        const { player } = context;
        if (!player) return false;

        for (const ingredient of this.ingredients) {
            if (!player.hasItem(ingredient.id, ingredient.amount)) {
                return false;
            }
        }

        for (const out of this.outcome) {
            const item = ItemManager.getItem(out.id);
            if (item && item.maxCount !== undefined) {
                const currentAmount = player.inventory[out.id] || 0;
                if (currentAmount + out.amount > item.maxCount) {
                    return false;
                }
            }
        }

        return true;
    }

    craft(context) {
        if (!this.canCraft(context)) {
            throw new Error('Cannot craft this recipe');
        }

        const { player } = context;
        for (const ing of this.ingredients) {
            player.removeItem(ing.id, ing.amount);
        }

        const grantedOutcomes = [];
        for (const out of this.outcome) {
            player.addItem(out.id, out.amount);
            grantedOutcomes.push(out);
        }

        if (this.extraOutcome && this.extraOutcome.diceCheck) {
            const { evaluateExpression } = require('../util/effects');
            const LuckManager = require('../managers/LuckManager');
            const poolSize = evaluateExpression(
                this.extraOutcome.diceCheck.pool || 1,
                context,
            );
            const requiredSuccesses = evaluateExpression(
                this.extraOutcome.diceCheck.successes || 1,
                context,
            );
            const threshold = evaluateExpression(
                this.extraOutcome.diceCheck.threshold || 3,
                context,
            );
            const sides = evaluateExpression(
                this.extraOutcome.diceCheck.sides || 6,
                context,
            );

            if (poolSize > 0) {
                const rolls = LuckManager.rollCustomDice(poolSize, sides);
                const successes = LuckManager.countSuccesses(rolls, threshold);
                if (successes >= requiredSuccesses) {
                    for (const extraOut of this.extraOutcome.outcome) {
                        player.addItem(extraOut.id, extraOut.amount);
                        grantedOutcomes.push(extraOut);
                    }
                }
            }
        }

        const consolidatedOutcomes = {};
        for (const out of grantedOutcomes) {
            if (!consolidatedOutcomes[out.id]) consolidatedOutcomes[out.id] = 0;
            consolidatedOutcomes[out.id] += out.amount;
        }

        return consolidatedOutcomes;
    }

    toWeb(context) {
        const GameObjectManager = require('../managers/GameObjectManager');

        const { player } = context;
        const canCraft = this.canCraft(context);
        const ingredients = this.ingredients.map((ing) => {
            const item = ItemManager.getItem(ing.id);
            return {
                ...ing,
                name: item ? item.name : ing.id,
                playerHas: player.inventory[ing.id] || 0,
            };
        });
        const outcome = this.outcome.map((out) => {
            const item = ItemManager.getItem(out.id);
            const formattedEffects =
                item && item.useEffects && item.useEffects.length > 0
                    ? GameObjectManager.formatEffectsList(item.useEffects)
                    : null;
            const formattedModifiers =
                item && item.modifiers && item.modifiers.length > 0
                    ? GameObjectManager.formatEffectsList(item.modifiers)
                    : null;
            return {
                ...out,
                name: item ? item.name : out.id,
                description: item ? item.description : '',
                formattedEffects,
                formattedModifiers,
                type: item ? item.type : 'unknown',
            };
        });

        let extraOutcome = null;
        if (this.extraOutcome) {
            extraOutcome = {
                diceCheck: this.extraOutcome.diceCheck,
                outcome: this.extraOutcome.outcome.map((out) => {
                    const item = ItemManager.getItem(out.id);
                    return {
                        ...out,
                        name: item ? item.name : out.id,
                    };
                }),
            };
        }

        return {
            id: this.id,
            name: this.name,
            description: this.description,
            canCraft,
            ingredients,
            outcome,
            extraOutcome,
        };
    }
}

module.exports = CraftRecipe;
