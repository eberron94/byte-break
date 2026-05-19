const Knowledge = require('./Knowledge');

/**
 * The core progression pool for ranking up a byte.
 */
class Bits extends Knowledge {
    constructor(data, byte = null) {
        super('Bits', data, byte);
    }

    get maxValue() {
        let max = 10 * Math.pow(2, this._byte ? this._byte.level + 2 : 3);
        if (this._byte && typeof this._byte.getHediffModifier === 'function') {
            max += this._byte.getHediffModifier('pool', this.id);
        }
        return max;
    }
}

module.exports = Bits;
