const Knowledge = require('./Knowledge');

/**
 * The core progression pool for ranking up a byte.
 */
class Bits extends Knowledge {
    constructor(data, byte = null) {
        super('Bits', data, byte);
    }

    get maxValue() {
        return 10 * Math.pow(2, this._byte ? this._byte.level + 2 : 3);
    }
}

module.exports = Bits;
