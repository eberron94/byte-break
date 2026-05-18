const GameEvents = require('../util/GameEvents');
const achievementsData = require('../../data/achievements.json');

class AchievementManager {
    constructor() {
        this.achievements = new Map();
        if (Array.isArray(achievementsData)) {
            achievementsData.forEach(ach => this.achievements.set(ach.id, ach));
        }
    }

    getAllAchievements() {
        return Array.from(this.achievements.values());
    }

    getAchievement(id) {
        return this.achievements.get(id);
    }

    async processAchievement(gameManager, userId, achId) {
        const ach = this.getAchievement(achId);
        if (!ach) return;

        try {
            const player = await gameManager.getPlayer(userId);
            const currentProgress = player.achievementPoints.progress[achId] || 0;
            const newProgress = currentProgress + 1;
            player.achievementPoints.progress[achId] = newProgress;

            let tierUnlocked = -1;
            for (let i = 0; i < ach.tiers.length; i++) {
                if (newProgress === ach.tiers[i]) {
                    tierUnlocked = i;
                    break;
                }
            }

            if (tierUnlocked !== -1) {
                const reward = ach.rewards[tierUnlocked];
                await gameManager.savePlayer(player);

                gameManager.emit(GameEvents.ACHIEVEMENT_UNLOCKED, userId, {
                    name: ach.name,
                    description: ach.description,
                    reward: reward,
                    tier: tierUnlocked + 1,
                    totalTiers: ach.tiers.length,
                    id: ach.id
                });
            } else {
                await gameManager.savePlayer(player);
            }
        } catch (e) {
            console.error(`Achievement error (${achId}):`, e);
        }
    }

    init(gameManager) {
        gameManager.on(GameEvents.COMBAT_WIN, (userId) => this.processAchievement(gameManager, userId, 'dojo_wins'));
        gameManager.on(GameEvents.LEVEL_UP, (userId) => this.processAchievement(gameManager, userId, 'level_ups'));
        gameManager.on(GameEvents.SHOP_PURCHASE, (userId) => this.processAchievement(gameManager, userId, 'shop_purchases'));
        gameManager.on(GameEvents.BYTE_SPAWNED, (userId) => this.processAchievement(gameManager, userId, 'bytes_spawned'));
        gameManager.on(GameEvents.BYTE_MERGED, (userId) => this.processAchievement(gameManager, userId, 'bytes_merged'));
        gameManager.on(GameEvents.COMBAT_LOSS, (userId) => this.processAchievement(gameManager, userId, 'combat_losses'));
        
        gameManager.on(GameEvents.MINIGAME_END, (userId, minigameId, data) => {
            if (minigameId === 'packet_sniffer' && data.result === 'win') {
                if (data.difficulty === 'easy') {
                    this.processAchievement(gameManager, userId, 'packet_sniffer_easy_wins');
                } else if (data.difficulty === 'normal') {
                    this.processAchievement(gameManager, userId, 'packet_sniffer_normal_wins');
                }
            }
        });
    }
}

module.exports = new AchievementManager();
