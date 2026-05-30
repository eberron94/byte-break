const Hediff = require('../models/Hediff');
const hediffsData = require('../../data/hediffs.json');

class HediffManager {
    constructor() {
        this.hediffs = new Map();
        this.load();
    }

    load() {
        if (!Array.isArray(hediffsData)) {
            console.error(
                '[HediffManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        hediffsData.forEach((data, index) => {
            if (!data.id || !data.name) {
                console.warn(
                    `[HediffManager] Skipping invalid hediff at index ${index}: Missing required 'id' or 'name'`,
                );
                return;
            }
            this.hediffs.set(data.id, new Hediff(data));
        });
    }

    getHediff(id) {
        return this.hediffs.get(id);
    }
}

module.exports = new HediffManager();
