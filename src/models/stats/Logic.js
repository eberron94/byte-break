const Stat = require('./Stat');

class Logic extends Stat {
    constructor(data, byte = null) {
        super('Logic', data, byte);
    }
}

module.exports = Logic;
