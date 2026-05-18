const Need = require('./Need');

class Defrag extends Need {
    constructor(value) {
        super('Defrag', value, 1);
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
