const Need = require('./Need');

class Thermal extends Need {
    constructor(value, byte = null) {
        super('Thermal', value, 3, 100, byte); // Decays a bit faster than charge
    }

    tick(byte = null, player = null) {
        if (byte && byte.isAsleep) {
            return; // Thermals do not decay while in stasis
        }
        super.tick(byte, player);
    }
}

module.exports = Thermal;
