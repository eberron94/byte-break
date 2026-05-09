const Need = require('./Need');

class Exertion extends Need {
    constructor(value) {
        super('Exertion', value, 1);
    }
}

module.exports = Exertion;
