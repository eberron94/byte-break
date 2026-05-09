const Pool = require('./Pool');

// Mana pool
class Mana extends Pool {
    constructor(value) {
        super('Mana', value !== undefined ? value : 100);
    }
}

module.exports = Mana;
