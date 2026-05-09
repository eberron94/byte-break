const Stat = require('./Stat');

class Constitution extends Stat {
    constructor(value) {
        super('Constitution', value !== undefined ? value : 5.0);
    }
}

module.exports = Constitution;
