const Pool = require('./Pool');

// Ki pool
class Ki extends Pool {
    constructor(value) {
        super('Ki', value !== undefined ? value : 100);
    }
}

module.exports = Ki;
