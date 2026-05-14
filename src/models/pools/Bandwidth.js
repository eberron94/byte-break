const Pool = require('./Pool');

// Bandwidth pool (formerly Potential)
class Bandwidth extends Pool {
    constructor(data, byte = null) {
        const value =
            typeof data === 'object' && data !== null
                ? data.value
                : data !== undefined
                  ? data
                  : 100;
        const maxValue =
            typeof data === 'object' && data !== null ? data.maxValue : 100;
        const investedValue = typeof data === 'object' && data !== null ? (data.investedValue !== undefined ? data.investedValue : Math.max(0, maxValue - 100)) : 0;
        super('Bandwidth', value, maxValue, investedValue, byte);
    }
}

module.exports = Bandwidth;
