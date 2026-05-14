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
        if (!Array.isArray(skillsData)) {
            console.error(
                '[SkillManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        skillsData.forEach((data, index) => {
            if (!data.id || !data.name) {
                console.warn(
                    `[SkillManager] Skipping invalid skill at index ${index}: Missing required 'id' or 'name'`,
                );
                return;
            }
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
module.exports = new SkillManager();
