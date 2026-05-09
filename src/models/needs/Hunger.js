const Need = require('./Need');

class Hunger extends Need {
    constructor(value) {
        super('Hunger', value, 2); // Decays by 2 per tick
    }
}

module.exports = Hunger;
