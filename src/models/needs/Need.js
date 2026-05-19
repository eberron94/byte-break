/**
 * Base class for essential pet needs (e.g. Hunger, Thirst) that naturally decay over time.
 */
class Need {
    constructor(name, value = 50, decayRate = 1, maxValue = 100, byte = null) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.baseDecayRate = decayRate;
        this.baseMaxValue = maxValue;
        this._byte = byte;

        this._value = value;
    }

    get maxValue() {
        let max = this.baseMaxValue;
        if (this._byte && typeof this._byte.getHediffModifier === 'function') {
            max += this._byte.getHediffModifier('need_max', this.id);
        }
        return Math.max(1, max);
    }

    get decayRate() {
        let rate = this.baseDecayRate;
        if (this._byte && typeof this._byte.getHediffModifier === 'function') {
            rate += this._byte.getHediffModifier('need_decay', this.id);
        }
        return rate;
    }

    get value() {
        return Math.max(0, Math.min(this._value, this.maxValue));
    }

    set value(v) {
        this._value = Math.max(0, Math.min(this.maxValue, v));
    }

    // Restores the need towards its maximum capacity
    satisfy(amount) {
        this.value = this.value + amount;
    }

    // Lowers the need towards 0
    deplete(amount) {
        this.value = this.value - amount;
    }

    // Processes the automatic loss of satisfaction caused by the passage of time
    tick(byte = null, player = null) {
        // Naturally depletes over time
        this.deplete(this.decayRate);
    }
}

module.exports = Need;
