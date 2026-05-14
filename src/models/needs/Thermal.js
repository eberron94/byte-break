const Need = require('./Need');

class Thermal extends Need {
    constructor(value) {
        super('Thermal', value, 3); // Decays a bit faster than charge
    }
}

module.exports = Thermal;
