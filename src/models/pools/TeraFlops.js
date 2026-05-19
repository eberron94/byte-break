const Pool = require('./Pool');

// TeraFlops pool (formerly Mana)
class TeraFlops extends Pool {
    constructor(data, byte = null) {
        super('TeraFlops', data, byte);
    }
}

module.exports = TeraFlops;
