const Stat = require('./Stat');

class Syntax extends Stat {
    constructor(data, byte = null) {
        super('Syntax', data, byte);
    }
}

module.exports = Syntax;
