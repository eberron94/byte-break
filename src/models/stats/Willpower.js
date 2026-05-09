const Stat = require('./Stat');

class Willpower extends Stat {
    constructor(value) {
        super('Willpower', value !== undefined ? value : 5.0);
    }
}

module.exports = Willpower;
