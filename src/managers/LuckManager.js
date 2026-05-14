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

    // --- Combat Checks ---

    static checkCombatCompile(attacker) {
        return this.roll(0.2, attacker);
    }

    static checkCombatOverride(attacker) {
        return this.roll(0.15, attacker);
    }

    static checkCombatDodge(attacker, defender) {
        const dodgeChance = Math.max(
            0,
            (defender.skills.spoof - attacker.skills.scan) * 0.04,
        );
        return this.roll(dodgeChance, defender);
    }

    static checkCombatShred(attacker) {
        return this.roll(0.2, attacker);
    }

    static checkCombatCompression(attacker, activeFirewall) {
        if (attacker.skills.compression <= activeFirewall * 0.5) return false;
        return this.roll(0.15, attacker);
    }

    static checkCombatCrit(attacker, defender) {
        const critChance = Math.max(
            0.05,
            (attacker.skills.scan - defender.skills.spoof) * 0.05,
        );
        return this.roll(critChance, attacker);
    }

    static checkCombatParse(defender) {
        const parseChance = defender.skills.parse * 0.05;
        return this.roll(parseChance, defender);
    }

    static checkCombatSync(attacker) {
        const syncChance = (attacker.skills.sync || 0) * 0.02;
        return this.roll(syncChance, attacker);
    }
}

module.exports = LuckManager;
