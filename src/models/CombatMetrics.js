/**
 * Tracks statistics and averages for combat encounters.
 */
class CombatMetrics {
    constructor(data = {}) {
        this.matches = data.matches || 0;
        this.turns = data.turns || 0;
        this.playerDamageDealt = data.playerDamageDealt || 0;
        this.enemyDamageDealt = data.enemyDamageDealt || 0;
        this.playerAttacks = data.playerAttacks || 0;
        this.enemyAttacks = data.enemyAttacks || 0;
        this.playerHits = data.playerHits || 0;
        this.enemyHits = data.enemyHits || 0;
        this.playerDodges = data.playerDodges || 0;
        this.enemyDodges = data.enemyDodges || 0;
        this.playerHealing = data.playerHealing || 0;
        this.enemyHealing = data.enemyHealing || 0;
        this.playerTfSpent = data.playerTfSpent || 0;
        this.enemyTfSpent = data.enemyTfSpent || 0;
        this.playerCrits = data.playerCrits || 0;
        this.enemyCrits = data.enemyCrits || 0;
        this.earnedBits = data.earnedBits || 0;
        this.earnedItems = data.earnedItems ? { ...data.earnedItems } : {};
    }

    add(other) {
        this.matches += other.matches;
        this.turns += other.turns;
        this.playerDamageDealt += other.playerDamageDealt;
        this.enemyDamageDealt += other.enemyDamageDealt;
        this.playerAttacks += other.playerAttacks;
        this.enemyAttacks += other.enemyAttacks;
        this.playerHits += other.playerHits;
        this.enemyHits += other.enemyHits;
        this.playerDodges += other.playerDodges;
        this.enemyDodges += other.enemyDodges;
        this.playerHealing += other.playerHealing;
        this.enemyHealing += other.enemyHealing;
        this.playerTfSpent += other.playerTfSpent || 0;
        this.enemyTfSpent += other.enemyTfSpent || 0;
        this.playerCrits += other.playerCrits;
        this.enemyCrits += other.enemyCrits;
        this.earnedBits += other.earnedBits || 0;
        if (other.earnedItems) {
            for (const [id, amount] of Object.entries(other.earnedItems)) {
                this.earnedItems[id] = (this.earnedItems[id] || 0) + amount;
            }
        }
    }

    addLoot(bits, items = []) {
        this.earnedBits += bits || 0;
        items.forEach(item => {
            this.earnedItems[item.id] = (this.earnedItems[item.id] || 0) + item.amount;
        });
    }

    get avgPlayerDamagePerTurn() {
        return this.turns > 0 ? (this.playerDamageDealt / this.turns).toFixed(2) : 0;
    }

    get avgEnemyDamagePerTurn() {
        return this.turns > 0 ? (this.enemyDamageDealt / this.turns).toFixed(2) : 0;
    }

    get playerAccuracy() {
        return this.playerAttacks > 0 ? ((this.playerHits / this.playerAttacks) * 100).toFixed(1) : 0;
    }

    get enemyDodgeRate() {
        return this.playerAttacks > 0 ? ((this.enemyDodges / this.playerAttacks) * 100).toFixed(1) : 0;
    }

    get enemyAccuracy() {
        return this.enemyAttacks > 0 ? ((this.enemyHits / this.enemyAttacks) * 100).toFixed(1) : 0;
    }

    get playerDodgeRate() {
        return this.enemyAttacks > 0 ? ((this.playerDodges / this.enemyAttacks) * 100).toFixed(1) : 0;
    }

    get avgBitsPerMatch() {
        return this.matches > 0 ? (this.earnedBits / this.matches).toFixed(2) : 0;
    }

    toString(contextName = 'Encounter') {
        const GameObjectManager = require('../managers/GameObjectManager');
        let output = `\n--- Combat Metrics: ${contextName} ---\n`;
        output += `Total Matches: ${this.matches}\n`;
        output += `Total Turns: ${this.turns}\n`;
        output += `Player Damage Dealt: ${this.playerDamageDealt} (${this.avgPlayerDamagePerTurn} avg/turn)\n`;
        output += `Enemy Damage Dealt: ${this.enemyDamageDealt} (${this.avgEnemyDamagePerTurn} avg/turn)\n`;
        output += `Player Healing Compiled: ${this.playerHealing}\n`;
        output += `Enemy Healing Compiled: ${this.enemyHealing}\n`;
        output += `Player TF Spent: ${this.playerTfSpent}\n`;
        output += `Enemy TF Spent: ${this.enemyTfSpent}\n`;
        
        output += `Player Offense: ${this.playerAttacks} attacks | ${this.playerAccuracy}% Hit | ${this.enemyDodgeRate}% Dodged by Enemy | ${this.playerCrits} Crits\n`;
        output += `Enemy Offense: ${this.enemyAttacks} attacks | ${this.enemyAccuracy}% Hit | ${this.playerDodgeRate}% Dodged by Player | ${this.enemyCrits} Crits\n`;
        
        output += `\nLoot Earned:\n`;
        output += `- Bits: ${this.earnedBits} (${this.avgBitsPerMatch} avg/match)\n`;
        
        const itemsArr = Object.entries(this.earnedItems).map(([id, amount]) => {
            const name = GameObjectManager.getObjectName(id, id);
            return `${name} (x${amount})`;
        });
        if (itemsArr.length > 0) output += `- Items: ${itemsArr.join(', ')}\n`;
        else output += `- Items: None\n`;

        return output;
    }

    toWeb() {
        return {
            matches: this.matches,
            turns: this.turns,
            playerDamageDealt: this.playerDamageDealt,
            enemyDamageDealt: this.enemyDamageDealt,
            playerAttacks: this.playerAttacks,
            enemyAttacks: this.enemyAttacks,
            playerHits: this.playerHits,
            enemyHits: this.enemyHits,
            playerDodges: this.playerDodges,
            enemyDodges: this.enemyDodges,
            playerHealing: this.playerHealing,
            enemyHealing: this.enemyHealing,
            playerTfSpent: this.playerTfSpent,
            enemyTfSpent: this.enemyTfSpent,
            playerCrits: this.playerCrits,
            enemyCrits: this.enemyCrits,
            earnedBits: this.earnedBits,
            avgPlayerDamagePerTurn: this.avgPlayerDamagePerTurn,
            avgEnemyDamagePerTurn: this.avgEnemyDamagePerTurn,
            playerAccuracy: this.playerAccuracy,
            enemyDodgeRate: this.enemyDodgeRate,
            enemyAccuracy: this.enemyAccuracy,
            playerDodgeRate: this.playerDodgeRate,
            avgBitsPerMatch: this.avgBitsPerMatch
        };
    }
}

module.exports = CombatMetrics;