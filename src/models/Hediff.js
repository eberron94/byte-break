class Hediff {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description || '';
        this.maxStacks = data.maxStacks || null;
        this.nextTier = data.nextTier || null;
        this.nextHediff = data.nextHediff || null;
        this.prevTier = data.prevTier || null;
        this.modifiers = data.modifiers || [];
        this.tickEffects = data.tickEffects || [];
        this.decay = data.decay || null;
        this.localOverrides = data.localOverrides || {};
    }
}

module.exports = Hediff;