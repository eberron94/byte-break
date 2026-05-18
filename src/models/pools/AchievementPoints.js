const TalentManager = require('../../managers/TalentManager');
const AchievementManager = require('../../managers/AchievementManager');

/**
 * Represents the achievement points pool for a player.
 */
class AchievementPoints {
    constructor(data, player = null) {
        this.id = 'achievement_points';
        this.name = 'Achievement Points';
        this._player = player;
        this.progress = data && data.progress ? data.progress : {};
    }

    get value() {
        let total = 0;
        const achievements = AchievementManager.getAllAchievements();
        for (const ach of achievements) {
            const progress = this.progress[ach.id] || 0;
            for (let i = 0; i < ach.tiers.length; i++) {
                if (progress >= ach.tiers[i]) {
                    total += ach.rewards[i];
                }
            }
        }
        return total;
    }

    get maxValue() {
        return Number.MAX_SAFE_INTEGER;
    }

    get invested() {
        if (!this._player || !this._player.talents) return 0;
        let total = 0;
        for (const [talentId, level] of Object.entries(this._player.talents)) {
            const talent = TalentManager.getTalent(talentId);
            if (talent) {
                total += talent.cost * level;
            }
        }
        return total;
    }

    get available() {
        return Math.max(0, this.value - this.invested);
    }
}

module.exports = AchievementPoints;
