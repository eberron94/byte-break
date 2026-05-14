const Need = require('./Need');

class Defrag extends Need {
    constructor(value) {
        super('Defrag', value, 1);
    }
}

module.exports = Defrag;
