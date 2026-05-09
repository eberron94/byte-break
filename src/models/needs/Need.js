/**
 * Base class for essential pet needs (e.g. Hunger, Thirst) that naturally decay over time.
 */
class Need {
    constructor(name, value = 50, decayRate = 1, maxValue = 100) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.value = value;
        this.decayRate = decayRate;
        this.maxValue = maxValue;
    }

    // Restores the need towards its maximum capacity
    satisfy(amount) {
        this.value = Math.min(this.maxValue, this.value + amount);
    }

    // Lowers the need towards 0
    deplete(amount) {
        this.value = Math.max(0, this.value - amount);
    }

    // Processes the automatic loss of satisfaction caused by the passage of time
    tick() {
        // Naturally depletes over time
        this.deplete(this.decayRate);
    }
}

module.exports = Need;
