const Need = require('./Need');

class Defrag extends Need {
    constructor(value, byte = null) {
        super('Defrag', value, 1, 100, byte);
    }

    tick(byte = null, player = null) {
        if (byte && byte.isAsleep) {
            this.deplete(this.decayRate * 1.5);
        } else {
            super.tick(byte, player);
        }
    }
}

module.exports = Defrag;
