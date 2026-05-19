/**
 * Base representation of a Core Stat (e.g. Strength, Dexterity).
 */
class Stat {
    constructor(name, data, byte = null) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.baseValue =
            typeof data === 'object' && data !== null
                ? data.baseValue !== undefined ? data.baseValue : 5
                : data !== undefined
                  ? data
                  : 5;
        this._byte = byte;
    }

    get value() {
        let val = this.baseValue;
        if (this._byte && typeof this._byte.getHediffModifier === 'function') {
            val += this._byte.getHediffModifier('stat', this.id);
        }
        return val;
    }
}

module.exports = Stat;
