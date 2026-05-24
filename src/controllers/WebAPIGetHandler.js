const { generateClassBasedAvatar, getAvatarColors } = require('../util/avatar');
const ItemManager = require('../managers/ItemManager');
const ShopManager = require('../managers/ShopManager');
const TalentManager = require('../managers/TalentManager');
const AchievementManager = require('../managers/AchievementManager');
const { checkRequirements } = require('../util/requirements');
const GameContext = require('../models/GameContext');
const GameObjectManager = require('../managers/GameObjectManager');
const ByteClassManager = require('../managers/ByteClassManager');
const dbManager = require('../database/db');

/**
 * @mixin WebAPIGetHandler
 *
 * This mixin contains all the route handler logic for GET requests. By
 * separating these handlers into their own file, we keep the main
 * WebApiController clean and focused on routing.
 */
const WebAPIGetHandler = {
    async getByte(req, res) {
        this.gameManager
            .recordPlayerActivity(req.params.id)
            .catch(console.error);
        const byte = await this.gameManager.getByte(req.params.id);
        if (byte) {
            const status = byte.getStatus();
            status.colors = getAvatarColors(
                status.name,
                status.byteClass,
                status.generation,
            );
            res.json(status);
        } else {
            res.status(404).json({ error: 'Byte not found' });
        }
    },

    async getBytes(req, res) {
        try {
            this.gameManager
                .recordPlayerActivity(req.params.id)
                .catch(console.error);
            const bytes = await this.gameManager.getBytes(req.params.id);
            const livingBytes = bytes
                .filter((b) => b.isAlive)
                .map((b) => {
                    const status = b.getStatus();
                    status.id = b.id; // Append ID for frontend selection
                    status.colors = getAvatarColors(
                        status.name,
                        status.byteClass,
                        status.generation,
                    );
                    const bClass = ByteClassManager.getClass(status.byteClass);
                    status.enhanceStat = bClass
                        ? bClass.enhanceStat
                        : 'aptitude';
                    return status;
                });
            res.json(livingBytes);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch bytes' });
        }
    },

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

    async getAvatar(req, res) {
        const { name, charClass, level, generation } = req.query;
        if (!name) {
            return res.status(400).send('Missing name parameter');
        }
        const svgString = generateClassBasedAvatar(
            name,
            charClass || 'demo',
            parseInt(level, 10) || 1,
            parseInt(generation, 10) || 0,
        );
        // Send as raw SVG, the frontend will handle rendering
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgString);
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

    async getClass(req, res) {
        const byteClass = ByteClassManager.getClass(req.params.id);
        if (byteClass) {
            res.json(byteClass);
        } else {
            res.status(404).json({ error: 'Class not found' });
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
                            item.effects && item.effects.length > 0
                                ? GameObjectManager.formatEffectsList(
                                      item.effects,
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

    async handleGetShops(req, res) {
        try {
            const { userId } = req.query;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);

            const context = new GameContext(byte, player);
            const availableShops = ShopManager.getAvailableShops(context);
            const shopsData = availableShops.map((shop) => ({
                id: shop.id,
                name: shop.name,
                description: shop.description,
                items: shop.getAvailableItems(ItemManager, player),
            }));

            res.json(shopsData);
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
            res.json({ achievements });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch achievements' });
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
};

module.exports = WebAPIGetHandler;
