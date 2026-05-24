const CombatManager = require('../managers/CombatManager');
const { ByteBuilder } = require('../models/Byte');
const { getAvatarColors } = require('../util/avatar');
const ItemManager = require('../managers/ItemManager');
const LootManager = require('../managers/LootManager');
const { calculateEffects, applyEffects } = require('../util/effects');
const ShopManager = require('../managers/ShopManager');
const GameObjectManager = require('../managers/GameObjectManager');
const GameEvents = require('../util/GameEvents');
const GameContext = require('../models/GameContext');
const TalentManager = require('../managers/TalentManager');
const AchievementManager = require('../managers/AchievementManager');
const { checkRequirements } = require('../util/requirements');
const ByteClassManager = require('../managers/ByteClassManager');

const activeTransactions = new Set();

/**
 * @mixin WebAPIPostHandler
 *
 * This mixin contains all the route handler logic for POST requests. This
 * includes actions that modify game state, such as merging bytes, upgrading
 * skills, or making purchases. Separating these keeps the API controller
 * organized.
 */
const WebAPIPostHandler = {
    async mergeBytes(req, res) {
        const { userId, byte1Id, byte2Id, newName } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);

            const player = await this.gameManager.getPlayer(userId);

            const newByte = await this.gameManager.mergeBytes(
                userId,
                byte1Id,
                byte2Id,
                newName,
                player,
            );

            if (this.botController) {
                await this.botController.bot.sendMessage(
                    userId,
                    `🧬 Merge successful! Welcome **${newByte.name}** to the world!`,
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
        } finally {
            activeTransactions.delete(userId);
        }
    },

    async upgradeByte(req, res) {
        const { userId, upgradeKey } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const playerByte = await this.gameManager.getByte(userId);

            if (!playerByte)
                return res.status(404).json({ error: 'Byte not found' });
            const byteClass = ByteClassManager.getClass(playerByte.byteClass);
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
        } finally {
            activeTransactions.delete(userId);
        }
    },

    async handleBuyItem(req, res) {
        const { userId, shopId, itemId } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);
            const item = ItemManager.getItem(itemId);
            const shop = ShopManager.getShop(shopId);

            if (!byte || !player || !item || !shop) {
                return res.status(404).json({ error: 'Data not found' });
            }

            const context = new GameContext(byte, player);
            if (!shop.canAppear(context)) {
                return res
                    .status(400)
                    .json({ error: 'Shop is currently closed' });
            }
            if (!shop.acceptsItem(item)) {
                return res
                    .status(400)
                    .json({ error: 'Shop does not trade this item' });
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

            if (
                item.maxCount !== undefined &&
                (player.inventory[itemId] || 0) >= item.maxCount
            ) {
                return res
                    .status(400)
                    .json({ error: 'Inventory full for this item' });
            }

            if (item.type === 'key' && player.hasItem(itemId, 1)) {
                return res
                    .status(400)
                    .json({ error: 'You already own this key' });
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
        } finally {
            activeTransactions.delete(userId);
        }
    },

    async handleSellItem(req, res) {
        const { userId, shopId, itemId } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);
            const item = ItemManager.getItem(itemId);
            const shop = ShopManager.getShop(shopId);

            if (!byte || !player || !item || !shop) {
                return res.status(404).json({ error: 'Data not found' });
            }

            const context = new GameContext(byte, player);
            if (!shop.canAppear(context)) {
                return res
                    .status(400)
                    .json({ error: 'Shop is currently closed' });
            }
            if (!shop.acceptsItem(item)) {
                return res
                    .status(400)
                    .json({ error: 'Shop does not trade this item' });
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
        } finally {
            activeTransactions.delete(userId);
        }
    },

    async simulateCombat(req, res) {
        const { userId, activityId } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const playerByte = await this.gameManager.getByte(userId);

            if (!playerByte)
                return res.status(404).json({ error: 'Byte not found' });
            if (playerByte.pools.integrity.value <= 0)
                return res.status(400).json({
                    error: 'Byte lacks sufficient Integrity to fight.',
                });

            const activity = this.gameManager.activityManager.getActivity(
                activityId || 'combat_simulation',
            );
            const combatConfig = activity?.combat || {
                enemyName: 'Training Virus',
                enemyClass: 'virus',
                scaleWithPlayer: true,
                hpMultiplier: 1.0,
                tfMultiplier: 1.0,
                bandwidthMultiplier: 1.0,
                winEffects: [{ type: 'loot', table: 'dojo_win_normal' }],
            };

            const eHp = combatConfig.scaleWithPlayer
                ? Math.max(
                      1,
                      Math.floor(
                          playerByte.pools.integrity.maxValue *
                              (combatConfig.hpMultiplier || 1),
                      ),
                  )
                : combatConfig.hp || 100;
            const eTf = combatConfig.scaleWithPlayer
                ? Math.max(
                      1,
                      Math.floor(
                          playerByte.pools.teraflops.maxValue *
                              (combatConfig.tfMultiplier || 1),
                      ),
                  )
                : combatConfig.tf || 100;
            const eBw = combatConfig.scaleWithPlayer
                ? Math.max(
                      1,
                      Math.floor(
                          (playerByte.pools.bandwidth?.maxValue || 100) *
                              (combatConfig.bandwidthMultiplier || 1),
                      ),
                  )
                : combatConfig.bandwidth || 100;

            const enemyByte = ByteBuilder.default(
                'npc_dummy',
                combatConfig.enemyName || 'Enemy',
            )
                .withByteClass(combatConfig.enemyClass || 'virus')
                .withPools({
                    integrity: { value: eHp, maxValue: eHp },
                    teraflops: { value: eTf, maxValue: eTf },
                    bandwidth: { value: eBw, maxValue: eBw },
                    bits: { value: 0, maxValue: 100 },
                })
                .build();

            if (combatConfig.skills) {
                for (const [sKey, sVal] of Object.entries(
                    combatConfig.skills,
                )) {
                    if (enemyByte.skills[sKey])
                        enemyByte.skills[sKey].investedValue = sVal;
                }
            }

            const result = CombatManager.simulate(
                playerByte,
                enemyByte,
                combatConfig.winEffects,
            );

            // Apply post-match HP and TF losses
            playerByte.pools.integrity.value = Math.max(
                0,
                result.finalState.player.hp,
            );
            playerByte.pools.teraflops.value = Math.max(
                0,
                result.finalState.player.tf,
            );

            let player = await this.gameManager.getPlayer(userId);

            // Reward Bits if won
            if (result.winner === 'player') {
                const context = new GameContext(playerByte, player);
                const calculatedWinEffects = calculateEffects(result.winEffects, context);
                const grantedLoot = LootManager.processLoot(
                    calculatedWinEffects,
                    player,
                );
                applyEffects(calculatedWinEffects, context);

                const lootStr = GameObjectManager.formatLootString(grantedLoot);
                const rewardMsg =
                    lootStr.length > 0
                        ? `Simulation complete! Rewards extracted: ${lootStr}.`
                        : 'Simulation complete! No rewards extracted.';
                result.log.push({ action: 'reward', message: rewardMsg });

                this.gameManager.emit(GameEvents.COMBAT_WIN, userId);
            } else if (result.winner === 'enemy') {
                this.gameManager.emit(GameEvents.COMBAT_LOSS, userId);
            }

            await this.gameManager.saveByte(playerByte);
            await this.gameManager.savePlayer(player);

            if (this.botController) {
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
        } finally {
            activeTransactions.delete(userId);
        }
    },

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
    },

    async buyTalent(req, res) {
        const { userId, talentId } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const byte = await this.gameManager.getByte(userId);
            const talent = TalentManager.getTalent(talentId);
            if (!player || !talent)
                return res.status(404).json({ error: 'Not found' });
            const currentLevel = player.talents[talentId] || 0;
            if (currentLevel >= talent.maxLevel)
                return res.status(400).json({ error: 'Talent maxed out' });
            if (player.achievementPoints.available < talent.cost)
                return res.status(400).json({ error: 'Not enough α' });

            const context = new GameContext(byte, player);

            if (!checkRequirements(talent.requirements, context)) {
                const reqStr = GameObjectManager.formatRequirementsList(talent.requirements);
                return res.status(400).json({ error: `Prerequisites not met.\nRequires:\n• ${reqStr}` });
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
        } finally {
            activeTransactions.delete(userId);
        }
    },

    async useRebooter(req, res) {
        const { userId } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
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

            const byteClass = ByteClassManager.getClass(byte.byteClass);
            if (!byteClass)
                return res.status(400).json({ error: 'Invalid byte class' });

            const refundedBits = byte.refundBits();

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
        } finally {
            activeTransactions.delete(userId);
        }
    },

    async useMutator(req, res) {
        const { userId } = req.body;
        if (activeTransactions.has(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        activeTransactions.add(userId);
        try {
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
        } finally {
            activeTransactions.delete(userId);
        }
    },

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
                                    tierData.effects, context
                                );
                                const success = applyEffects(calculatedEffects, context);
                                if (success && byte) byteModified = true;
                            }

                            player.history[`ach_unlocked_${ach.id}_tier_${i + 1}`] = new Date().toISOString();

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
};

module.exports = WebAPIPostHandler;
