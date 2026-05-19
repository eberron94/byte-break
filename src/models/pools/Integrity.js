const Pool = require('./Pool');

// Integrity pool (formerly Lifepoints)
class Integrity extends Pool {
    constructor(data, byte = null) {
        super('Integrity', data, byte);
    }
}

module.exports = Integrity;
