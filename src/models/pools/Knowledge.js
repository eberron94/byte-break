/**
 * Base class representing accumulated knowledge or learned proficiencies.
 */
class Knowledge {
    constructor(name, data, byte = null) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        const value = typeof data === 'object' && data !== null ? data.value : (data !== undefined ? data : 0);
        this.value = value;
        this._byte = byte;
    }

    get maxValue() {
        return 10 * (this._byte ? this._byte.level : 1);
    }

    increase(amount) {
        this.value = Math.min(this.maxValue, this.value + amount);
    }

    decrease(amount) {
        this.value = Math.max(0, this.value - amount);
    }
}

module.exports = Knowledge;
