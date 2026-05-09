const Pool = require('./Pool');

// Potential pool
class Potential extends Pool {
    constructor(value) {
        super('Potential', value !== undefined ? value : 100);
    }
}

module.exports = Potential;
