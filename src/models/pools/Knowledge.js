/**
 * Base class representing accumulated knowledge or learned proficiencies.
 */
class Knowledge {
    constructor(name, data, byte = null) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        const value =
            typeof data === 'object' && data !== null
                ? data.value
                : data !== undefined
                  ? data
                  : 0;
        this._value = value;
        this._byte = byte;
    }

    get maxValue() {
        let max = 10 * (this._byte ? this._byte.level : 1);
        if (this._byte && typeof this._byte.getHediffModifier === 'function') {
            max += this._byte.getHediffModifier('pool', this.id);
        }
        return max;
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
}

module.exports = Knowledge;
