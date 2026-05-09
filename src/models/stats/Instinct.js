const Stat = require('./Stat');

class Instinct extends Stat {
    constructor(value) {
        super('Instinct', value !== undefined ? value : 5.0);
    }
}

module.exports = Instinct;
