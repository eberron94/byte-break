const TalentManager = require('../../managers/TalentManager');
const AchievementManager = require('../../managers/AchievementManager');

/**
 * Binds the achievement points sub-object to a Player instance.
 */
function bindAchievementPoints(player, progressData) {
    player.achievementPoints = {
        progress: progressData || {},

        get value() {
            let total = 0;
            const achievements = AchievementManager.getAllAchievements();
            for (const ach of achievements) {
                const progress = this.progress[ach.id] || 0;
                if (ach.tiers) {
                    for (const tier of ach.tiers) {
                        if (progress >= tier.requirement) {
                            total += tier.reward || 0;
                        }
                    }
                } else if (ach.requirement && progress >= ach.requirement) {
                    total += ach.reward || 0; // Legacy fallback
                }
            }
            return total;
        },

        get maxValue() {
            return Number.MAX_SAFE_INTEGER;
        },

        get invested() {
            if (!player.talents) return 0;
            let total = 0;
            for (const [talentId, level] of Object.entries(player.talents)) {
                const talent = TalentManager.getTalent(talentId);
                if (talent) {
                    total += talent.cost * level;
                }
            }
            return total;
        },

        get available() {
            return Math.max(0, this.value - this.invested);
        }
    };
}

module.exports = bindAchievementPoints;
