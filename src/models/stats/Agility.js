const Stat = require('./Stat');

class Agility extends Stat {
    constructor(value) {
        super('Agility', value !== undefined ? value : 5.0);
    }
}

module.exports = Agility;
