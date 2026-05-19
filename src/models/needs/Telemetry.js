const Need = require('./Need');

class Telemetry extends Need {
    constructor(value, byte = null) {
        super('Telemetry', value, 1, 100, byte);
    }

    tick(byte = null, player = null) {
        if (byte && byte.isAsleep) {
            this.deplete(this.decayRate * 1.5);
        } else {
            super.tick(byte, player);
        }
    }
}

module.exports = Telemetry;
