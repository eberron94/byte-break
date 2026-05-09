/**
 * Specific tracker representing pet fatigue. Restored manually rather than decaying continuously.
 */
class Energy {
    constructor(value = 100, maxValue = 100) {
        this.id = 'energy';
        this.name = 'Energy';
        this.value = value;
        this.maxValue = maxValue;
    }

    // Restores energy up to the cap
    increase(amount) {
        this.value = Math.min(this.maxValue, this.value + amount);
    }

    // Drains energy down to 0
    decrease(amount) {
        this.value = Math.max(0, this.value - amount);
    }
}

module.exports = Energy;
