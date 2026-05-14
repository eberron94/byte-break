const ByteClassManager = require('../../managers/ByteClassManager');

/**
 * Base representation for expandable capacities and cumulative trackers
 * like Lifepoints, Mana, and XP.
 */
class Pool {
    constructor(name, value = 100, maxValue = 100, investedValue = 0, byte = null) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.value = value;
        this.maxValue = maxValue;
        this.investedValue = investedValue;
        this._byte = byte;
    }

    increase(amount) {
        if (this.maxValue !== null) {
            this.value = Math.min(this.maxValue, this.value + amount);
        } else {
            this.value += amount;
        }
    }

    decrease(amount) {
        this.value = Math.max(0, this.value - amount);
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

module.exports = Pool;
