const Stat = require('./Stat');

class Aptitude extends Stat {
    constructor(value) {
        super('Aptitude', value !== undefined ? value : 5.0);
    }
}

module.exports = Aptitude;
