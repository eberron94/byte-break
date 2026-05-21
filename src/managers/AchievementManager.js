const GameEvents = require('../util/GameEvents');
const achievementsData = require('../../data/achievements.json');
const { calculateEffects, applyEffects } = require('../util/effects');
const ItemManager = require('./ItemManager');
const { getTimeContext } = require('../util/time');

class AchievementManager {
    constructor() {
        this.achievements = new Map();
        if (Array.isArray(achievementsData)) {
            achievementsData.forEach((ach) =>
                this.achievements.set(ach.id, ach),
            );
        }
    }

    getAllAchievements() {
        return Array.from(this.achievements.values());
    }

    getAchievement(id) {
        return this.achievements.get(id);
    }

    async processAchievement(gameManager, userId, achId, amount = 1) {
        const ach = this.getAchievement(achId);
        if (!ach) return;

        try {
            const player = await gameManager.getPlayer(userId);
            const currentProgress =
                player.achievementPoints.progress[achId] || 0;
            const newProgress = currentProgress + amount;
            player.achievementPoints.progress[achId] = newProgress;

            let byte = null;
            let byteModified = false;

            for (let i = 0; i < ach.tiers.length; i++) {
                const tierData = ach.tiers[i];
                const tierReq = tierData.requirement;
                if (currentProgress < tierReq && newProgress >= tierReq) {
                    const reward = tierData.reward;

                    if (tierData.effects && tierData.effects.length > 0) {
                        if (!byte) byte = await gameManager.getByte(userId);
                        const timeContext = getTimeContext();
                        const context = { byte, player, ...timeContext };
                        const calculatedEffects = calculateEffects(
                            tierData.effects,
                            byte,
                            player,
                            context
                        );
                        const success = applyEffects(calculatedEffects, byte, player, ItemManager);
                        if (success && byte) byteModified = true;
                    }

                    gameManager.emit(GameEvents.ACHIEVEMENT_UNLOCKED, userId, {
                        name: ach.name,
                        description: tierData.description || ach.description,
                        reward: reward,
                        tier: i + 1,
                        totalTiers: ach.tiers.length,
                        id: ach.id,
                    });
                }
            }

            await gameManager.savePlayer(player);
            if (byteModified && byte) {
                await gameManager.saveByte(byte);
            }
        } catch (e) {
            console.error(`Achievement error (${achId}):`, e);
        }
    }

    init(gameManager) {
        gameManager.on(GameEvents.COMBAT_WIN, (userId) =>
            this.processAchievement(gameManager, userId, 'dojo_wins'),
        );
        gameManager.on(GameEvents.LEVEL_UP, (userId) =>
            this.processAchievement(gameManager, userId, 'level_ups'),
        );
        gameManager.on(GameEvents.SHOP_PURCHASE, (userId) =>
            this.processAchievement(gameManager, userId, 'shop_purchases'),
        );
        gameManager.on(GameEvents.BYTE_SPAWNED, (userId) =>
            this.processAchievement(gameManager, userId, 'bytes_spawned'),
        );
        gameManager.on(GameEvents.BYTE_MERGED, (userId) =>
            this.processAchievement(gameManager, userId, 'bytes_merged'),
        );
        gameManager.on(GameEvents.COMBAT_LOSS, (userId) =>
            this.processAchievement(gameManager, userId, 'combat_losses'),
        );

        gameManager.on(GameEvents.MINIGAME_END, (userId, minigameId, data) => {
            if (!data) return;
            if (minigameId === 'packet_sniffer' && data.result === 'win') {
                if (data.difficulty === 'easy') {
                    this.processAchievement(
                        gameManager,
                        userId,
                        'packet_sniffer_easy_wins',
                    );
                } else if (data.difficulty === 'normal') {
                    this.processAchievement(
                        gameManager,
                        userId,
                        'packet_sniffer_normal_wins',
                    );
                }
            }
        });
    }
}

module.exports = new AchievementManager();
