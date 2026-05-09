const Pool = require('./Pool');

/**
 * Base class representing accumulated knowledge or learned proficiencies.
 */
class Knowledge extends Pool {
    constructor(name, value = 0) {
        super(name, value);
    }
}

module.exports = Knowledge;
