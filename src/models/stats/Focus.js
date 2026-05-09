const Stat = require('./Stat');

class Focus extends Stat {
    constructor(value) {
        super('Focus', value !== undefined ? value : 5.0);
    }
}

module.exports = Focus;
