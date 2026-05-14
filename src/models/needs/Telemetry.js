const Need = require('./Need');

class Telemetry extends Need {
    constructor(value) {
        super('Telemetry', value, 1);
    }
}

module.exports = Telemetry;
