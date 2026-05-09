const Pool = require('./Pool');

// Lifepoints pool
class Lifepoints extends Pool {
    constructor(value) {
        super('Lifepoints', value !== undefined ? value : 100);
    }
}

module.exports = Lifepoints;
