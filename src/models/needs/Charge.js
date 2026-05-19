const Need = require('./Need');

class Charge extends Need {
    constructor(value, byte = null) {
        super('Charge', value, 2, 100, byte); // Decays by 2 per tick
    }

    tick(byte = null, player = null) {
        if (byte && byte.isAsleep) {
            this.satisfy(this.decayRate * 5); // Regenerate charge while asleep
        } else {
            super.tick(byte, player);
        }
    }
}

module.exports = Charge;
