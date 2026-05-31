const ItemManager = require('../managers/ItemManager');
const TalentManager = require('../managers/TalentManager');
const AchievementManager = require('../managers/AchievementManager');
const { checkRequirements } = require('../util/requirements');
const GameContext = require('../models/GameContext');
const GameObjectManager = require('../managers/GameObjectManager');
const dbManager = require('../database/db');
const CombatMetrics = require('../models/CombatMetrics');

/**
 * @mixin WebAPIPlayerHandler
 *
 * This mixin contains all the route handler logic for player-centric GET requests,
 * isolating inventory, achievements, and talent trees from core game data.
 */
const WebAPIPlayerHandler = {
    async getPlayer(req, res) {
        try {
            this.gameManager
                .recordPlayerActivity(req.params.id)
                .catch(console.error);
            const player = await this.gameManager.getPlayer(req.params.id);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });
            const data = player.toWeb();
            data.mergeCost = this.gameManager.getMergeCost(player);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch player' });
        }
    },

    async getInventory(req, res) {
        try {
            this.gameManager
                .recordPlayerActivity(req.params.id)
                .catch(console.error);
            const player = await this.gameManager.getPlayer(req.params.id);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            const inventory = [];
            for (const [itemId, amount] of Object.entries(player.inventory)) {
                if (amount > 0) {
                    const item = ItemManager.getItem(itemId);
                    if (item) {
                        const formattedEffects =
                            item.useEffects && item.useEffects.length > 0
                                ? GameObjectManager.formatEffectsList(
                                      item.useEffects,
                                  )
                                : null;
                        inventory.push({ ...item, amount, formattedEffects });
                    }
                }
            }
            res.json(inventory);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getTalents(req, res) {
        try {
            this.gameManager
                .recordPlayerActivity(req.params.id)
                .catch(console.error);
            const player = await this.gameManager.getPlayer(req.params.id);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });
            const byte = await this.gameManager.getByte(req.params.id);

            const allTalents = TalentManager.getAllTalents();
            const availableAP = player.achievementPoints.available;

            const visibleTalents = new Set();
            const hiddenTalents = new Set();
            const hintTalents = new Set();

            const context = new GameContext(byte, player);

            for (const talent of allTalents) {
                const meetsPrereq = checkRequirements(talent.requirements, context);
                if (meetsPrereq) visibleTalents.add(talent.id);
                else hiddenTalents.add(talent);
            }

            for (const hiddenTalent of hiddenTalents) {
                if (hiddenTalent.requirements) {
                    for (const req of hiddenTalent.requirements) {
                        if (
                            req.type === 'talent' &&
                            visibleTalents.has(req.id) &&
                            (player.talents[req.id] || 0) < req.level
                        ) {
                            hintTalents.add(req.id);
                        }
                    }
                }
            }

            const tree = [];
            for (const talent of allTalents) {
                if (!visibleTalents.has(talent.id)) continue;

                const currentLevel = player.talents[talent.id] || 0;
                const isMaxed = currentLevel >= talent.maxLevel;
                const canAfford = availableAP >= talent.cost;

                tree.push({
                    id: talent.id,
                    name: talent.name,
                    description: talent.description,
                    maxLevel: talent.maxLevel,
                    currentLevel,
                    isDisabled: isMaxed || !canAfford,
                    btnBg: isMaxed
                        ? 'var(--tg-theme-button-color, #2481cc)'
                        : canAfford
                          ? '#ff9800'
                          : '#888',
                    btnText: isMaxed ? 'MAXED' : `🧬 ${talent.cost} α`,
                    hasHint: hintTalents.has(talent.id),
                });
            }

            res.json({
                availableAchievementPoints: availableAP,
                maxAchievementPoints: player.achievementPoints.value,
                tree,
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch talents' });
        }
    },

    async getAchievements(req, res) {
        try {
            this.gameManager
                .recordPlayerActivity(req.params.id)
                .catch(console.error);
            const player = await this.gameManager.getPlayer(req.params.id);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            const allAchievements = AchievementManager.getAllAchievements();
            const achievements = allAchievements.map((ach) => {
                const progress = player.achievementPoints.progress[ach.id] || 0;
                let completedTiers = 0;

                const processedTiers = ach.tiers.map((tierReq, i) => {
                    const isCompleted = progress >= tierReq.requirement;
                    if (isCompleted) completedTiers++;
                    return {
                        req: tierReq.requirement,
                        reward: tierReq.reward,
                        description: tierReq.description || ach.description,
                        checkColor: isCompleted ? '#4caf50' : '#4d4d73',
                        formattedEffects:
                            tierReq.effects && tierReq.effects.length > 0
                                ? GameObjectManager.formatEffectsList(
                                      tierReq.effects,
                                  )
                                : null,
                        unlockDate: player.history[`ach_unlocked_${ach.id}_tier_${i + 1}`] || null,
                    };
                });

                const allCompleted =
                    progress >= ach.tiers[ach.tiers.length - 1].requirement;

                return {
                    id: ach.id,
                    name: ach.name,
                    description: ach.description,
                    progress,
                    completedTiers,
                    totalTiers: ach.tiers.length,
                    tiers: processedTiers,
                    allCompleted,
                    borderStyle: allCompleted
                        ? 'border: 1px solid #4caf50;'
                        : 'border: 1px solid rgba(255, 255, 255, 0.05);',
                    nameColor: allCompleted
                        ? '#4caf50'
                        : 'var(--tg-theme-button-color, #2481cc)',
                };
            });

            const metricsObj = new CombatMetrics(player.history.combatMetrics);

            res.json({ achievements, combatMetrics: metricsObj.toWeb() });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch achievements' });
        }
    },

    async getAchievementIcon(req, res) {
        const { name, rank, maxRank } = req.query;
        if (!name) {
            return res.status(400).send('Missing name parameter');
        }

        const { generateAchievementIcon } = require('../util/avatar');
        const svgString = generateAchievementIcon(
            name,
            parseInt(rank, 10) || 0,
            parseInt(maxRank, 10) || 1,
        );
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgString);
    },

    async getEquipment(req, res) {
        try {
            const userId = req.params.id;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const byte = await this.gameManager.getByte(userId);
            if (!player || !byte) return res.status(404).json({ error: 'Not found' });

            const equipment = {
                hardware: [],
                software: [],
                hwCap: byte.getHardwareCapacity(player),
                swCap: byte.getSoftwareCapacity(player)
            };

            const getDetails = (itemId, isEquipped, amount) => {
                const item = ItemManager.getItem(itemId);
                if (!item) return null;
                const formattedModifiers = item.modifiers && item.modifiers.length > 0 ? GameObjectManager.formatEffectsList(item.modifiers) : null;
                const formattedTickEffects = item.tickEffects && item.tickEffects.length > 0 ? GameObjectManager.formatEffectsList(item.tickEffects) : null;

                return {
                    ...item,
                    isEquipped,
                    amount,
                    formattedModifiers,
                    formattedTickEffects,
                    rarity: item.rarity || 1
                };
            };

            ['hardware', 'software'].forEach(type => {
                const equipped = byte.loadout[type] || [];
                equipped.forEach(itemId => {
                    const details = getDetails(itemId, true, 1);
                    if (details) equipment[type].push(details);
                });
            });

            for (const [itemId, amount] of Object.entries(player.inventory)) {
                if (amount > 0) {
                    const item = ItemManager.getItem(itemId);
                    if (item && (item.type === 'hardware' || item.type === 'software')) {
                        const details = getDetails(itemId, false, amount);
                        if (details) equipment[item.type].push(details);
                    }
                }
            }

            res.json(equipment);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getPlayerLogs(req, res) {
        try {
            const playerId = req.params.id;
            const page = parseInt(req.query.page) || 0;
            const limit = 10;
            const offset = page * limit;
            
            const logs = await dbManager.getEventLogs(playerId, limit, offset);
            res.json(logs);
        } catch (error) {
            console.error('Failed to fetch player logs:', error);
            res.status(500).json({ error: 'Failed to fetch logs' });
        }
    },

    async buyTalent(req, res) {
        const { userId, talentId } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const byte = await this.gameManager.getByte(userId);
            
            if (!player)
                return res.status(404).json({ error: 'Not found' });

            try {
                player.buyTalent(talentId, byte);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            await this.gameManager.savePlayer(player);
            res.json({
                availableAchievementPoints: player.achievementPoints.available,
                maxAchievementPoints: player.achievementPoints.value,
                talents: player.talents,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        } finally {
            this.gameManager.deleteTransaction(userId);
        }
    },

    async useMutator(req, res) {
        const { userId } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);

            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            try {
                player.useMutator();
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            await this.gameManager.savePlayer(player);

            res.json({
                availableAchievementPoints: player.achievementPoints.available,
                maxAchievementPoints: player.achievementPoints.value,
                talents: player.talents,
            });
        } catch (error) {
            console.error('Mutator API Error:', error);
            res.status(500).json({ error: 'Failed to use mutator.' });
        } finally {
            this.gameManager.deleteTransaction(userId);
        }
    },

    async updateSettings(req, res) {
        const { userId, settings } = req.body;
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);

            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            player.settings = settings;
            await this.gameManager.savePlayer(player);

            res.json({ success: true });
        } catch (error) {
            console.error('Settings Update API Error:', error);
            res.status(500).json({ error: 'Failed to update settings.' });
        }
    },
};

module.exports = WebAPIPlayerHandler;