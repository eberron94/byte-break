const ByteClassManager = require('../../managers/ByteClassManager'); // Now imports the singleton instance

/**
 * Dynamic skill object. Its total value is derived from a linked Core Stat + invested points.
 */
class Skill {
    constructor(config, dbData = {}, byte = null) {
        // Assign base configurations, falling back to ID if omitted
        this.id = config.id || config.name.toLowerCase().replace(/\s+/g, '_');
        this.name = config.name;
        this.description = config.description;
        this.stat = config.stat;

        this.investedValue = dbData.investedValue || 0;

        this._byte = byte; // Internal reference to the parent byte
    }

    /**
     * Calculates the total skill competency on demand.
     */
    get value() {
        // Extract the value from the linked core stat (e.g. Strength -> Athletics)
        const statValue = this._byte.stats[this.stat]
            ? this._byte.stats[this.stat].value
            : 0;

        const byteClass = ByteClassManager.getClass(this._byte.byteClass);
        const innateValue =
            byteClass && byteClass.innatePointsPerLevel[this.id]
                ? byteClass.innatePointsPerLevel[this.id]
                : 0;

        let val =
            statValue + this.investedValue + innateValue * this._byte.level;
        if (typeof this._byte.getHediffModifier === 'function') {
            val += this._byte.getHediffModifier('skill', this.id);
        }
        return val;
    }

    get bitsInvested() {
        if (!this._byte) return 0;
        const byteClass = ByteClassManager.getClass(this._byte.byteClass);
        const rate =
            byteClass && byteClass.investmentRates[this.id]
                ? byteClass.investmentRates[this.id]
                : 0;
        return this.investedValue * rate;
    }
}

module.exports = Skill;
