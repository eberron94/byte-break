const Need = require('./Need');

class Enrichment extends Need {
    constructor(value) {
        super('Enrichment', value, 1);
    }
}

module.exports = Enrichment;
