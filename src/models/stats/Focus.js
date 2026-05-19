const Stat = require('./Stat');

class Focus extends Stat {
    constructor(data, byte = null) {
        super('Focus', data, byte);
    }
}

module.exports = Focus;
