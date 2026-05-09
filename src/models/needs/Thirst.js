const Need = require('./Need');

class Thirst extends Need {
    constructor(value) {
        super('Thirst', value, 3); // Decays a bit faster than hunger
    }
}

module.exports = Thirst;
