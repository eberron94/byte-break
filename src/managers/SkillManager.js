const skillsData = require('../../data/skills.json');

/**
 * Loads canonical definitions of game skills, such as how they map to core stats.
 */
class SkillManager {
    constructor() {
        this.skills = new Map();
        this.load();
    }

    // Caches JSON configurations into a mapped dictionary
    load() {
        skillsData.forEach((data) => {
            this.skills.set(data.id, data);
        });
    }

    // Finds a canonical skill configuration by ID
    getSkill(id) {
        return this.skills.get(id);
    }

    // Retrieves all loaded canonical skills as an array
    getAllSkills() {
        return Array.from(this.skills.values());
    }
}
module.exports = SkillManager;
