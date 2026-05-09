/**
 * Dynamic skill object. Its total value is derived from a linked Core Stat + invested points.
 */
class Skill {
    constructor(config, dbData = {}, petStats = {}) {
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

        this._petStats = petStats; // Internal reference to evaluate value dynamically
    }

    /**
     * Calculates the total skill competency on demand.
     */
    get value() {
        // Extract the value from the linked core stat (e.g. Strength -> Athletics)
        const statValue = this._petStats[this.stat]
            ? this._petStats[this.stat].value
            : 0;
        return statValue + this.investedValue + this.innateValue;
    }
}

module.exports = Skill;
