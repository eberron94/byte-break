const CombatManager = require('../managers/CombatManager');
const { ByteBuilder } = require('../models/Byte');
const { generateClassBasedAvatar, getAvatarColors } = require('../util/avatar');
const ItemManager = require('../managers/ItemManager');
const ShopManager = require('../managers/ShopManager');
const GameEvents = require('../util/GameEvents');
const TalentManager = require('../managers/TalentManager');
const AchievementManager = require('../managers/AchievementManager');

class WebApiController {
    constructor(app, gameManager, byteClassManager, botController = null) {
        this.app = app;
        this.gameManager = gameManager;
        this.byteClassManager = byteClassManager;
        this.botController = botController;
    }

    init() {
        this.app.get('/api/byte/:id', this.getByte.bind(this));
        this.app.get('/api/bytes/:id', this.getBytes.bind(this));
        this.app.get('/api/player/:id', this.getPlayer.bind(this));
        this.app.post('/api/combat/simulate', this.simulateCombat.bind(this));
        this.app.get('/api/avatar', this.getAvatar.bind(this));
        this.app.get('/api/class/:id', this.getClass.bind(this));
        this.app.post('/api/byte/upgrade', this.upgradeByte.bind(this));
        this.app.get('/api/inventory/:id', this.getInventory.bind(this));
        this.app.get('/api/shops', this.handleGetShops.bind(this));
        this.app.post('/api/shop/buy', this.handleBuyItem.bind(this));
        this.app.post('/api/shop/sell', this.handleSellItem.bind(this));
        this.app.post('/api/byte/merge', this.mergeBytes.bind(this));
        this.app.post('/api/ui/refresh', this.refreshUI.bind(this));
        this.app.get('/api/talents/:id', this.getTalents.bind(this));
        this.app.post('/api/talent/buy', this.buyTalent.bind(this));
        this.app.get('/api/achievements/:id', this.getAchievements.bind(this));
        this.app.get(
            '/api/achievement-icon',
            this.getAchievementIcon.bind(this),
        );
        this.app.post('/api/special/reboot', this.useRebooter.bind(this));
        this.app.post('/api/special/mutate', this.useMutator.bind(this));
        this.app.get('/api/debug/data/:id', this.getDebugData.bind(this));
        this.app.post(
            '/api/debug/achievement',
            this.debugAchievement.bind(this),
        );
        this.app.post('/api/debug/item', this.debugItem.bind(this));
        this.app.post('/api/debug/byte', this.debugByte.bind(this));
        this.app.post('/api/debug/talent', this.debugTalent.bind(this));
    }

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
    }

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
                    const bClass = this.byteClassManager.getClass(status.byteClass);
                    status.enhanceStat = bClass ? bClass.enhanceStat : 'aptitude';
                    return status;
                });
            res.json(livingBytes);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch bytes' });
        }
    }

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
    }

    async mergeBytes(req, res) {
        try {
            const { userId, byte1Id, byte2Id, newName } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);

            const player = await this.gameManager.getPlayer(userId);
            const cost = this.gameManager.getMergeCost(player);

            if (player.energy.value < cost) {
                return res.status(400).json({ error: `Not enough Energy. Requires ${cost} ε.` });
            }

            const newByte = await this.gameManager.mergeBytes(
                userId,
                byte1Id,
                byte2Id,
                newName,
                player,
            );

            player.energy.decrease(cost);
            await this.gameManager.savePlayer(player);

            if (this.botController) {
                await this.botController.bot.sendMessage(
                    userId,
                    `🧬 Merge successful! Welcome **${newName}** to the world!`,
                    { parse_mode: 'Markdown' },
                );
                await this.botController.sendStatusUI(userId, newByte, player);
            }

            const status = newByte.getStatus();
            status.id = newByte.id;
            status.colors = getAvatarColors(
                status.name,
                status.byteClass,
                status.generation,
            );
            res.json(status);
        } catch (error) {
            console.error('Merge API Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

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
    }

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
    }

    async getClass(req, res) {
        const byteClass = this.byteClassManager.getClass(req.params.id);
        if (byteClass) {
            res.json(byteClass);
        } else {
            res.status(404).json({ error: 'Class not found' });
        }
    }

    async upgradeByte(req, res) {
        try {
            const { userId, upgradeKey } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const playerByte = await this.gameManager.getByte(userId);

            if (!playerByte)
                return res.status(404).json({ error: 'Byte not found' });
            const byteClass = this.byteClassManager.getClass(
                playerByte.byteClass,
            );
            if (!byteClass)
                return res.status(400).json({ error: 'Invalid byte class' });

            const cost = byteClass.investmentRates[upgradeKey];
            if (cost === undefined)
                return res.status(400).json({ error: 'Invalid upgrade key' });

            const totalBits =
                playerByte.pools.bits.value + (playerByte.bufferOverflow || 0);
            if (totalBits < cost)
                return res.status(400).json({ error: 'Not enough Bits' });

            const previousLevel = playerByte.level;

            // Deduct Bits and apply the upgrade
            if (playerByte.bufferOverflow && playerByte.bufferOverflow > 0) {
                if (playerByte.bufferOverflow >= cost) {
                    playerByte.bufferOverflow -= cost;
                } else {
                    const remaining = cost - playerByte.bufferOverflow;
                    playerByte.bufferOverflow = 0;
                    playerByte.pools.bits.decrease(remaining);
                }
            } else {
                playerByte.pools.bits.decrease(cost);
            }

            if (playerByte.skills[upgradeKey])
                playerByte.skills[upgradeKey].investedValue += 1;
            else if (playerByte.pools[upgradeKey]) {
                playerByte.pools[upgradeKey].maxValue += 1;
                playerByte.pools[upgradeKey].investedValue += 1;
                playerByte.pools[upgradeKey].increase(1); // Heal the newly gained capacity immediately
            } else
                return res
                    .status(400)
                    .json({ error: 'Upgrade key not found on Byte' });

            const newLevel = playerByte.level;

            await this.gameManager.saveByte(playerByte);

            if (this.botController) {
                const player = await this.gameManager.getPlayer(userId);
                let statusMsg = `System updated: ${upgradeKey} enhanced.`;
                if (newLevel > previousLevel) {
                    this.gameManager.emit(
                        GameEvents.LEVEL_UP,
                        userId,
                        newLevel,
                    );
                    statusMsg += `\n🎉 **LEVEL UP!** ${playerByte.name} reached Level ${newLevel}!`;
                }

                this.botController
                    .sendStatusUI(userId, playerByte, player, statusMsg)
                    .catch(console.error);
            }
            res.json(playerByte.getStatus());
        } catch (error) {
            console.error('Upgrade API Error:', error);
            res.status(500).json({ error: 'Failed to upgrade byte.' });
        }
    }

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
                        inventory.push({ ...item, amount });
                    }
                }
            }
            res.json(inventory);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async handleGetShops(req, res) {
        try {
            const { userId } = req.query;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);

            const now = new Date();
            const hour = now.getHours();
            let timePhase = 'night';
            if (hour >= 6 && hour < 18) timePhase = 'day';
            else if (hour >= 18 && hour < 21) timePhase = 'evening';

            const context = {
                byte,
                player,
                timePhase,
                dayOfWeek: now.getDay(),
            };

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
    }

    async handleBuyItem(req, res) {
        try {
            const { userId, shopId, itemId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);
            const item = ItemManager.getItem(itemId);
            const shop = ShopManager.getShop(shopId);

            if (!byte || !player || !item || !shop) {
                return res.status(404).json({ error: 'Data not found' });
            }

            if (item.cost === undefined) {
                return res.status(400).json({ error: 'Item is not for sale' });
            }

            const calculatedCost = Math.ceil(item.cost * shop.priceMultiplier);

            const totalBits =
                byte.pools.bits.value + (byte.bufferOverflow || 0);
            if (totalBits < calculatedCost) {
                return res.status(400).json({ error: 'Insufficient bits' });
            }

            if (shop.stock[itemId] !== undefined) {
                const bought = player.history[`shop_${shop.id}_${itemId}`] || 0;
                if (bought >= shop.stock[itemId]) {
                    return res.status(400).json({ error: 'Item is sold out' });
                }
            }

            // Deduct cost and add item
            if (byte.bufferOverflow && byte.bufferOverflow > 0) {
                if (byte.bufferOverflow >= calculatedCost) {
                    byte.bufferOverflow -= calculatedCost;
                } else {
                    const remainingCost = calculatedCost - byte.bufferOverflow;
                    byte.bufferOverflow = 0;
                    byte.pools.bits.decrease(remainingCost);
                }
            } else {
                byte.pools.bits.decrease(calculatedCost);
            }
            player.addItem(itemId, 1, ItemManager);

            if (shop.stock[itemId] !== undefined) {
                player.recordHistory(`shop_${shop.id}_${itemId}`);
            }

            await this.gameManager.saveByte(byte);
            await this.gameManager.savePlayer(player);

            if (this.botController) {
                const statusMsg = `Purchased ${item.name} for ${calculatedCost} β!`;
                this.botController
                    .sendStatusUI(userId, byte, player, statusMsg)
                    .catch(console.error);
            }

            this.gameManager.emit(GameEvents.SHOP_PURCHASE, userId, itemId);

            res.json({ byte: byte.getStatus(), player: player.inventory });
        } catch (error) {
            console.error('Shop API Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async handleSellItem(req, res) {
        try {
            const { userId, shopId, itemId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);
            const item = ItemManager.getItem(itemId);
            const shop = ShopManager.getShop(shopId);

            if (!byte || !player || !item || !shop) {
                return res.status(404).json({ error: 'Data not found' });
            }

            if (!player.hasItem(itemId, 1)) {
                return res.status(400).json({ error: 'Item not in inventory' });
            }

            if (item.cost === undefined) {
                return res.status(400).json({ error: 'Item cannot be sold' });
            }

            const sellPrice = Math.floor(item.cost * shop.sellMultiplier);

            player.removeItem(itemId, 1);
            byte.pools.bits.increase(sellPrice);

            await this.gameManager.saveByte(byte);
            await this.gameManager.savePlayer(player);

            if (this.botController) {
                const statusMsg = `Sold ${item.name} for ${sellPrice} β!`;
                this.botController
                    .sendStatusUI(userId, byte, player, statusMsg)
                    .catch(console.error);
            }

            res.json({ byte: byte.getStatus(), player: player.inventory });
        } catch (error) {
            console.error('Shop Sell API Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async simulateCombat(req, res) {
        try {
            const { userId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const playerByte = await this.gameManager.getByte(userId);

            if (!playerByte)
                return res.status(404).json({ error: 'Byte not found' });

            // Generate a dummy enemy scaled roughly to the player
            const enemyByte = ByteBuilder.default('npc_dummy', 'Training Virus')
                .withPools({
                    integrity: {
                        value: playerByte.pools.integrity.maxValue,
                        maxValue: playerByte.pools.integrity.maxValue,
                    },
                    teraflops: {
                        value: playerByte.pools.teraflops.maxValue,
                        maxValue: playerByte.pools.teraflops.maxValue,
                    },
                    bandwidth: { value: 100, maxValue: 100 },
                    bits: { value: 0, maxValue: 100 },
                })
                .build();

            // Pre-calculate the entire battle instantly
            const result = CombatManager.simulate(playerByte, enemyByte);

            // Apply post-match HP and TF losses
            playerByte.pools.integrity.value = Math.max(
                0,
                result.finalState.player.hp,
            );
            playerByte.pools.teraflops.value = Math.max(
                0,
                result.finalState.player.tf,
            );

            // Reward Bits if won
            if (result.winner === 'player') {
                const bitsGain = Math.floor(15 * result.lootMultiplier);
                playerByte.pools.bits.increase(bitsGain);
                result.log.push({
                    action: 'reward',
                    message: `Simulation complete! ${playerByte.name} extracted ${bitsGain} β.`,
                });
                this.gameManager.emit(GameEvents.COMBAT_WIN, userId);
            } else if (result.winner === 'enemy') {
                this.gameManager.emit(GameEvents.COMBAT_LOSS, userId);
            }

            await this.gameManager.saveByte(playerByte);

            if (this.botController) {
                const player = await this.gameManager.getPlayer(userId);
                let combatMsg = 'Combat ended in a stalemate!';
                if (result.winner === 'player')
                    combatMsg = `Combat Simulation: ${playerByte.name} was the victor!`;
                else if (result.winner === 'enemy')
                    combatMsg = `Combat Simulation: ${playerByte.name} was defeated.`;

                this.botController
                    .sendStatusUI(userId, playerByte, player, combatMsg)
                    .catch(console.error);
            }

            res.json(result);
        } catch (error) {
            console.error('Combat API Error:', error);
            res.status(500).json({ error: 'Failed to simulate combat.' });
        }
    }

    async refreshUI(req, res) {
        try {
            const { userId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);

            if (this.botController) {
                const bytes = await this.gameManager.getBytes(userId);
                const player = await this.gameManager.getPlayer(userId);
                const activeByte = bytes.find((b) => !b.isAsleep && b.isAlive);

                if (activeByte) {
                    await this.botController.sendStatusUI(
                        userId,
                        activeByte,
                        player,
                    );
                } else {
                    await this.botController.sendStasisUI(
                        userId,
                        bytes,
                        player,
                    );
                }
            }
            res.json({ success: true });
        } catch (error) {
            console.error('UI Refresh API Error:', error);
            res.status(500).json({ error: 'Failed to refresh UI.' });
        }
    }

    _getAchievementRanks(player) {
        const ranks = {};
        const achievements = AchievementManager.getAllAchievements();
        for (const ach of achievements) {
            const progress = player.achievementPoints.progress[ach.id] || 0;
            let rank = 0;
            for (let i = 0; i < ach.tiers.length; i++) {
                if (progress >= ach.tiers[i]) rank = i + 1;
            }
            ranks[ach.id] = rank;
        }
        return ranks;
    }

    async getTalents(req, res) {
        try {
            this.gameManager
                .recordPlayerActivity(req.params.id)
                .catch(console.error);
            const player = await this.gameManager.getPlayer(req.params.id);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            const allTalents = TalentManager.getAllTalents();
            const achievementRanks = this._getAchievementRanks(player);
            const availableAP = player.achievementPoints.available;

            const visibleTalents = new Set();
            const hiddenTalents = new Set();
            const hintTalents = new Set();

            for (const talent of allTalents) {
                let meetsPrereq = true;
                if (talent.prereq) {
                    for (const [reqId, reqLevel] of Object.entries(talent.prereq)) {
                        if ((player.talents[reqId] || 0) < reqLevel) {
                            meetsPrereq = false;
                            break;
                        }
                    }
                }
                if (talent.reqAchievements) {
                    for (const [achId, reqRank] of Object.entries(talent.reqAchievements)) {
                        if ((achievementRanks[achId] || 0) < reqRank) {
                            meetsPrereq = false;
                            break;
                        }
                    }
                }
                if (meetsPrereq) visibleTalents.add(talent.id);
                else hiddenTalents.add(talent);
            }

            for (const hiddenTalent of hiddenTalents) {
                if (hiddenTalent.prereq) {
                    for (const [reqId, reqLevel] of Object.entries(hiddenTalent.prereq)) {
                        if (visibleTalents.has(reqId) && (player.talents[reqId] || 0) < reqLevel) {
                            hintTalents.add(reqId);
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
                    btnBg: isMaxed ? 'var(--tg-theme-button-color, #2481cc)' : (canAfford ? '#ff9800' : '#888'),
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
    }

    async buyTalent(req, res) {
        try {
            const { userId, talentId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const talent = TalentManager.getTalent(talentId);
            if (!player || !talent)
                return res.status(404).json({ error: 'Not found' });
            const currentLevel = player.talents[talentId] || 0;
            if (currentLevel >= talent.maxLevel)
                return res.status(400).json({ error: 'Talent maxed out' });
            if (player.achievementPoints.available < talent.cost)
                return res.status(400).json({ error: 'Not enough α' });
            if (talent.prereq) {
                for (const [reqId, reqLevel] of Object.entries(talent.prereq)) {
                    if ((player.talents[reqId] || 0) < reqLevel)
                        return res
                            .status(400)
                            .json({ error: 'Prerequisites not met' });
                }
            }
            
            const achievementRanks = this._getAchievementRanks(player);
            if (talent.reqAchievements) {
                for (const [achId, reqRank] of Object.entries(talent.reqAchievements)) {
                    if ((achievementRanks[achId] || 0) < reqRank) {
                        return res.status(400).json({ error: 'Achievement prerequisites not met' });
                    }
                }
            }
            
            player.talents[talentId] = currentLevel + 1;
            await this.gameManager.savePlayer(player);
            res.json({
                availableAchievementPoints: player.achievementPoints.available,
                maxAchievementPoints: player.achievementPoints.value,
                talents: player.talents,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

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
                    const isCompleted = progress >= tierReq;
                    if (isCompleted) completedTiers++;
                    return {
                        req: tierReq,
                        reward: ach.rewards[i],
                        checkColor: isCompleted ? '#4caf50' : '#4d4d73',
                    };
                });

                const allCompleted = progress >= ach.tiers[ach.tiers.length - 1];

                return {
                    id: ach.id,
                    name: ach.name,
                    description: ach.description,
                    progress,
                    completedTiers,
                    totalTiers: ach.tiers.length,
                    tiers: processedTiers,
                    allCompleted,
                    borderStyle: allCompleted ? 'border: 1px solid #4caf50;' : 'border: 1px solid rgba(255, 255, 255, 0.05);',
                    nameColor: allCompleted ? '#4caf50' : 'var(--tg-theme-button-color, #2481cc)',
                };
            });
            res.json({ achievements });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch achievements' });
        }
    }

    async useRebooter(req, res) {
        try {
            const { userId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const byte = await this.gameManager.getByte(userId);

            if (!player || !byte)
                return res.status(404).json({ error: 'Not found' });

            if (!player.hasItem('byte_rebooter', 1)) {
                return res
                    .status(400)
                    .json({ error: 'You do not have a Byte Rebooter.' });
            }

            const byteClass = this.byteClassManager.getClass(byte.byteClass);
            if (!byteClass)
                return res.status(400).json({ error: 'Invalid byte class' });

            const refundedBits = byte.refundBits(byteClass);

            if (refundedBits > 0) {
                player.removeItem('byte_rebooter', 1);

                await this.gameManager.saveByte(byte);
                await this.gameManager.savePlayer(player);

                if (this.botController) {
                    this.botController
                        .sendStatusUI(
                            userId,
                            byte,
                            player,
                            'System Rebooted: Upgrades refunded to Buffer Overflow.',
                        )
                        .catch(console.error);
                }

                res.json(byte.getStatus());
            } else {
                return res
                    .status(400)
                    .json({ error: 'No upgrades to refund.' });
            }
        } catch (error) {
            console.error('Rebooter API Error:', error);
            res.status(500).json({ error: 'Failed to reboot byte.' });
        }
    }

    async useMutator(req, res) {
        try {
            const { userId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);

            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            if (!player.hasItem('user_mutator', 1)) {
                return res
                    .status(400)
                    .json({ error: 'You do not have a User Mutator.' });
            }

            const success = player.refundAchievementPoints();
            if (!success) {
                return res.status(400).json({ error: 'No talents to refund.' });
            }

            player.removeItem('user_mutator', 1);
            await this.gameManager.savePlayer(player);

            res.json({
                availableAchievementPoints: player.achievementPoints.available,
                maxAchievementPoints: player.achievementPoints.value,
                talents: player.talents,
            });
        } catch (error) {
            console.error('Mutator API Error:', error);
            res.status(500).json({ error: 'Failed to use mutator.' });
        }
    }

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
                bytes: bytes
                    .filter((b) => b.isAlive)
                    .map((b) => b.toWeb()),
                achievements,
                items,
                talents,
            });
        } catch (error) {
            console.error('Debug Data API Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async debugAchievement(req, res) {
        try {
            const { userId, achId, progress } = req.body;
            const player = await this.gameManager.getPlayer(userId);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            const oldProgress = player.achievementPoints.progress[achId] || 0;
            player.achievementPoints.progress[achId] = progress;
            if (progress === 0) delete player.achievementPoints.progress[achId];

            const ach = AchievementManager.getAchievement(achId);
            if (ach) {
                if (progress > oldProgress) {
                    for (let i = 0; i < ach.tiers.length; i++) {
                        const tierReq = ach.tiers[i];
                        if (oldProgress < tierReq && progress >= tierReq) {
                            const reward = ach.rewards[i];
                            this.gameManager.emit(GameEvents.ACHIEVEMENT_UNLOCKED, userId, {
                                name: ach.name,
                                description: ach.description,
                                reward: reward,
                                tier: i + 1,
                                totalTiers: ach.tiers.length,
                                id: ach.id
                            });
                        }
                    }
                }
            }

            await this.gameManager.savePlayer(player);
            this.gameManager.emit(GameEvents.DEBUG_ACTION, userId, `Achievement ${achId} progress set to ${progress}`);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async debugItem(req, res) {
        try {
            const { userId, itemId, amount } = req.body;
            const player = await this.gameManager.getPlayer(userId);
            if (!player)
                return res.status(404).json({ error: 'Player not found' });

            if (amount > 0) {
                player.addItem(itemId, amount, ItemManager);
            } else if (amount < 0) {
                player.removeItem(itemId, Math.abs(amount));
            }

            await this.gameManager.savePlayer(player);
            this.gameManager.emit(GameEvents.DEBUG_ACTION, userId, `Item ${itemId} modified by ${amount}`);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

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
                if (byte.pools.bits) byte.pools.bits.value = Math.min(numValue, byte.pools.bits.maxValue);
            } else if (field === 'fillPool') {
                if (byte.pools[key]) byte.pools[key].value = byte.pools[key].maxValue;
            } else if (field === 'stats') {
                if (byte.stats[key]) byte.stats[key].value = numValue;
            } else if (field === 'skills') {
                if (byte.skills[key]) byte.skills[key].investedValue = numValue;
            } else if (field === 'pools') {
                if (byte.pools[key]) {
                    byte.pools[key].investedValue = numValue;
                    byte.pools[key].maxValue = numValue; // Approximate debug override
                    byte.pools[key].value = Math.min(
                        byte.pools[key].value,
                        byte.pools[key].maxValue,
                    );
                }
            }

            await this.gameManager.saveByte(byte);
            this.gameManager.emit(GameEvents.DEBUG_ACTION, userId, `Byte ${byteId} field ${field} updated to ${value}`);
            res.json({ success: true });
        } catch (error) {
            console.error('Debug Byte API Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async debugTalent(req, res) {
        try {
            const { userId, talentId, amount } = req.body;
            const player = await this.gameManager.getPlayer(userId);
            if (!player) return res.status(404).json({ error: 'Player not found' });
            
            const talent = TalentManager.getTalent(talentId);
            if (!talent) return res.status(404).json({ error: 'Talent not found' });

            const currentLevel = player.talents[talentId] || 0;

            if (amount > 0) {
                if (currentLevel >= talent.maxLevel) return res.status(400).json({ error: 'Talent is already at max level' });
                if (player.achievementPoints.available < talent.cost) return res.status(400).json({ error: 'Not enough available AP' });
                
                player.talents[talentId] = currentLevel + 1;
            } else if (amount < 0) {
                if (currentLevel > 0) {
                    player.talents[talentId] = currentLevel - 1;
                    if (player.talents[talentId] === 0) delete player.talents[talentId];
                }
            }

            await this.gameManager.savePlayer(player);
            this.gameManager.emit(GameEvents.DEBUG_ACTION, userId, `Talent ${talentId} modified by ${amount}`);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = WebApiController;
