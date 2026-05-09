const Stat = require('./Stat');

class Strength extends Stat {
    constructor(value) {
        super('Strength', value !== undefined ? value : 5.0);
    }
}

module.exports = Strength;
