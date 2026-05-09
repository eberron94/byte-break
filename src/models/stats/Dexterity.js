const Stat = require('./Stat');

class Dexterity extends Stat {
    constructor(value) {
        super('Dexterity', value !== undefined ? value : 5.0);
    }
}

module.exports = Dexterity;
