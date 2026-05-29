/**
 * Centralizes random chance calculations, allowing for future 'Luck' stats
 * to easily manipulate the odds of events and combat interactions.
 */
class LuckManager {
    /**
     * Calculates the effective probability based on an entity's luck.
     * Modifiers can be easily wired in here later!
     */
    static roll(baseProbability, entity = null) {
        let luckModifier = 1.0;
        // TODO: Extract luck from entity (Byte or Player) once the stat is implemented

        const finalChance = baseProbability * luckModifier;
        return Math.random() < finalChance;
    }

    // --- Event Checks ---

    static checkEvent(probability, context) {
        return this.roll(probability, context.byte || context.player);
    }

    // --- Dice Pool Mechanics ---
    
    static rollCustomDice(poolSize, sides = 6) {
        const rolls = [];
        for (let i = 0; i < poolSize; i++) {
            rolls.push(Math.floor(Math.random() * sides) + 1);
        }
        return rolls;
    }

    static countSuccesses(rolls, threshold = 4) {
        return rolls.filter(r => r >= threshold).length;
    }

    static opposedRoll(attackPool, defendPool, sides = 6, threshold = 4) {
        const atkRolls = this.rollCustomDice(attackPool, sides);
        const defRolls = this.rollCustomDice(defendPool, sides);
        const atkSuccesses = this.countSuccesses(atkRolls, threshold);
        const defSuccesses = this.countSuccesses(defRolls, threshold);
        return {
            atkRolls, defRolls, atkSuccesses, defSuccesses,
            netSuccesses: atkSuccesses - defSuccesses
        };
    }
}

module.exports = LuckManager;
