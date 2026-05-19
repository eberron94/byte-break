const Stat = require('./Stat');

class Aptitude extends Stat {
    constructor(data, byte = null) {
        super('Aptitude', data, byte);
    }
}

module.exports = Aptitude;
