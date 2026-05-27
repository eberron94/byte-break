const ItemManager = require('../managers/ItemManager');
const TalentManager = require('../managers/TalentManager');
const AchievementManager = require('../managers/AchievementManager');
const GameEvents = require('../util/GameEvents');
const GameContext = require('../models/GameContext');
const { calculateEffects, applyEffects } = require('../util/effects');

/**
 * @mixin WebAPIDebugHandler
 *
 * This mixin contains all the route handler logic for debug POST requests.
 * By separating these handlers, we keep the main game mechanics clean.
 */
const WebAPIDebugHandler = {
    async debugAchievement(req, res) {
        try {
            const { userId, achId, progress } = req.body;
            const player = await this.gameManager.getPlayer(userId);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            const oldProgress = player.achievementPoints.progress[achId] || 0;
            player.achievementPoints.progress[achId] = progress;
            if (progress === 0) delete player.achievementPoints.progress[achId];

            let byte = null;
            let byteModified = false;

            const ach = AchievementManager.getAchievement(achId);
            if (ach) {
                if (progress > oldProgress) {
                    for (let i = 0; i < ach.tiers.length; i++) {
                        const tierData = ach.tiers[i];
                        const tierReq = tierData.requirement;
                        if (oldProgress < tierReq && progress >= tierReq) {
                            const reward = tierData.reward;

                            if (
                                tierData.effects &&
                                tierData.effects.length > 0
                            ) {
                                if (!byte)
                                    byte =
                                        await this.gameManager.getByte(userId);
                                const context = new GameContext(byte, player);
                                const calculatedEffects = calculateEffects(
                                    tierData.effects,
                                    context,
                                );
                                const success = applyEffects(
                                    calculatedEffects,
                                    context,
                                );
                                if (success && byte) byteModified = true;
                            }

                            player.history[
                                `ach_unlocked_${ach.id}_tier_${i + 1}`
                            ] = new Date().toISOString();

                            this.gameManager.emit(
                                GameEvents.ACHIEVEMENT_UNLOCKED,
                                userId,
                                {
                                    name: ach.name,
                                    description:
                                        tierData.description || ach.description,
                                    reward: reward,
                                    tier: i + 1,
                                    totalTiers: ach.tiers.length,
                                    id: ach.id,
                                },
                            );
                        }
                    }
                }
            }

            await this.gameManager.savePlayer(player);
            if (byteModified && byte) {
                await this.gameManager.saveByte(byte);
            }
            this.gameManager.emit(
                GameEvents.DEBUG_ACTION,
                userId,
                `Achievement ${achId} progress set to ${progress}`,
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async debugItem(req, res) {
        try {
            const { userId, itemId, amount, resetCooldown } = req.body;
            const player = await this.gameManager.getPlayer(userId);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            if (amount > 0) {
                player.addItem(itemId, amount);
            } else if (amount < 0) {
                player.removeItem(itemId, Math.abs(amount));
            }

            if (resetCooldown) {
                delete player.history[`item_used_${itemId}`];
            }

            await this.gameManager.savePlayer(player);
            this.gameManager.emit(
                GameEvents.DEBUG_ACTION,
                userId,
                `Item ${itemId} modified (Amount: ${amount}, Cooldown Reset: ${!!resetCooldown})`,
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async debugByte(req, res) {
        try {
            const { userId, byteId, field, key, value } = req.body;
            const bytes = await this.gameManager.getBytes(userId);
            const byte = bytes.find((b) => b.id === byteId);
            if (!byte) return res.status(404).json({ error: 'Byte not found' });

            const numValue = parseInt(value, 10) || 0;

            if (field === 'name') {
                if (typeof value === 'string' && value.trim().length > 0) {
                    byte.name = value.trim();
                } else {
                    return res.status(400).json({ error: 'Invalid name' });
                }
            } else if (field === 'bufferOverflow') {
                byte.bufferOverflow = numValue;
            } else if (field === 'generation') {
                byte.generation = numValue;
            } else if (field === 'bits') {
                if (byte.pools.bits)
                    byte.pools.bits.value = Math.min(
                        numValue,
                        byte.pools.bits.maxValue,
                    );
            } else if (field === 'fillPool') {
                if (byte.pools[key])
                    byte.pools[key].value = byte.pools[key].maxValue;
            } else if (field === 'stats') {
                if (byte.stats[key]) byte.stats[key].baseValue = numValue;
            } else if (field === 'skills') {
                if (byte.skills[key]) byte.skills[key].investedValue = numValue;
            } else if (field === 'pools') {
                if (byte.pools[key]) {
                    byte.pools[key].investedValue = numValue;
                    byte.pools[key].value = Math.min(
                        byte.pools[key].value,
                        byte.pools[key].maxValue,
                    );
                }
            }

            await this.gameManager.saveByte(byte);
            this.gameManager.emit(
                GameEvents.DEBUG_ACTION,
                userId,
                `Byte ${byteId} field ${field} updated to ${value}`,
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Debug Byte API Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async debugTalent(req, res) {
        try {
            const { userId, talentId, amount } = req.body;
            const player = await this.gameManager.getPlayer(userId);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            const talent = TalentManager.getTalent(talentId);
            if (!talent)
                return res.status(404).json({ error: 'Talent not found' });

            const currentLevel = player.talents[talentId] || 0;

            if (amount > 0) {
                if (currentLevel >= talent.maxLevel)
                    return res
                        .status(400)
                        .json({ error: 'Talent is already at max level' });
                if (player.achievementPoints.available < talent.cost)
                    return res
                        .status(400)
                        .json({ error: 'Not enough available AP' });

                player.talents[talentId] = currentLevel + 1;
            } else if (amount < 0) {
                if (currentLevel > 0) {
                    player.talents[talentId] = currentLevel - 1;
                    if (player.talents[talentId] === 0)
                        delete player.talents[talentId];
                }
            }

            await this.gameManager.savePlayer(player);
            this.gameManager.emit(
                GameEvents.DEBUG_ACTION,
                userId,
                `Talent ${talentId} modified by ${amount}`,
            );
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getDebugData(req, res) {
        try {
            const userId = req.params.id;
            const player = await this.gameManager.getPlayer(userId);
            const bytes = await this.gameManager.getBytes(userId);
            const achievements = AchievementManager.getAllAchievements();
            const items = ItemManager.getAllItems();
            const talents = TalentManager.getAllTalents();

            res.json({
                player: player.toWeb(),
                bytes: bytes.filter((b) => b.isAlive).map((b) => b.toWeb()),
                achievements,
                items,
                talents,
            });
        } catch (error) {
            console.error('Debug Data API Error:', error);
            res.status(500).json({ error: error.message });
        }
    },
};

module.exports = WebAPIDebugHandler;