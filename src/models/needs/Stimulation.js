const Need = require('./Need');

class Stimulation extends Need {
    constructor(value) {
        super('Stimulation', value, 1);
    }
}

module.exports = Stimulation;
