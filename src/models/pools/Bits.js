const Knowledge = require('./Knowledge');

/**
 * The core progression pool for ranking up a byte.
 */
class Bits extends Knowledge {
    constructor(data, byte = null) {
        super('Bits', data, byte);
    }
}

module.exports = Bits;
