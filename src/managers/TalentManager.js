const talentsData = require('../../data/talents.json');

class TalentManager {
    constructor() {
        this.talents = new Map();
        this.load();
    }

    load() {
        if (!Array.isArray(talentsData)) {
            console.error('[TalentManager] Invalid JSON structure: Expected an array.');
            return;
        }
        talentsData.forEach((data) => {
            if (!data.id || !data.name) return;
            this.talents.set(data.id, data);
        });
    }

    getAllTalents() {
        return Array.from(this.talents.values());
    }

    getTalent(id) {
        return this.talents.get(id);
    }
}
module.exports = new TalentManager();