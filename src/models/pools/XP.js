const Knowledge = require('./Knowledge');

/**
 * The core progression pool for ranking up a pet.
 */
class XP extends Knowledge {
    constructor(value) {
        super('XP', value !== undefined ? value : 0);
    }
}

module.exports = XP;
