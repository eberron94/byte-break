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

        let invested = 0;
        let innate = 0;

        if (typeof dbData === 'number') {
            invested = dbData; // Backwards compatibility for old raw numbers
        } else if (dbData !== null && typeof dbData === 'object') {
            invested = dbData.investedValue || 0;
            innate = dbData.innateValue || 0;
        }
        this.investedValue = invested;
        this.innateValue = innate;

        this._byte = byte; // Internal reference to the parent byte
    }

    /**
     * Calculates the total skill competency on demand.
     */
    get value() {
        if (!this._byte) {
            // Fallback for old logic if byte is not passed, though it always should be now
            return this.investedValue + this.innateValue;
        }

        // Extract the value from the linked core stat (e.g. Strength -> Athletics)
        const statValue = this._byte.stats[this.stat]
            ? this._byte.stats[this.stat].value
            : 0;

        const byteClass = ByteClassManager.getClass(this._byte.byteClass);
        const innatePoints =
            byteClass && byteClass.innatePointsPerLevel[this.id]
                ? byteClass.innatePointsPerLevel[this.id]
                : 0;

        return statValue + this.investedValue + innatePoints * this._byte.level;
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
