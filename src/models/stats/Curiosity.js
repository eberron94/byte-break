const Stat = require('./Stat');

class Curiosity extends Stat {
    constructor(data, byte = null) {
        super('Curiosity', data, byte);
    }
}

module.exports = Curiosity;
