const ByteClassManager = require('../../managers/ByteClassManager');

/**
 * Base representation for expandable capacities and cumulative trackers.
 */
class Pool {
    constructor(name, data, byte = null) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.baseValue =
            typeof data === 'object' && data !== null
                ? data.baseValue !== undefined ? data.baseValue : 100
                : data !== undefined
                  ? data
                  : 100;

        this.investedValue =
            typeof data === 'object' && data !== null
                ? data.investedValue !== undefined
                    ? data.investedValue
                    : Math.max(0, (data.maxValue || 100) - 100)
                : 0;

        this._value =
            typeof data === 'object' && data !== null
                ? data.value !== undefined
                    ? data.value
                    : this.baseValue
                : data !== undefined
                  ? data
                  : this.baseValue;
                  
        this._byte = byte;
    }

    get maxValue() {
        let val = this.baseValue + this.investedValue;

        const byteClass = this._byte ? ByteClassManager.getClass(this._byte.byteClass) : null;
        const innateValue =
            byteClass && byteClass.innatePointsPerLevel[this.id]
                ? byteClass.innatePointsPerLevel[this.id]
                : 0;
                
        if (this._byte) {
            val += innateValue * this._byte.level;
        }

        if (this._byte && typeof this._byte.getHediffModifier === 'function') {
            val += this._byte.getHediffModifier('pool', this.id);
        }
        return val;
    }

    get value() {
        return Math.max(0, Math.min(this._value, this.maxValue));
    }

    set value(v) {
        this._value = Math.max(0, Math.min(this.maxValue, v));
    }

    increase(amount) {
        this.value = this.value + amount;
    }

    decrease(amount) {
        this.value = this.value - amount;
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
