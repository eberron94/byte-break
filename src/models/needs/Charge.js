const Need = require('./Need');

class Charge extends Need {
    constructor(value) {
        super('Charge', value, 2); // Decays by 2 per tick
    }
}

module.exports = Charge;