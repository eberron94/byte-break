const CombatManager = require('../managers/CombatManager');
const { ByteBuilder } = require('../models/Byte');
const { generateClassBasedAvatar, getAvatarColors } = require('../util/avatar');

class WebApiController {
    constructor(app, gameManager, byteClassManager, botController = null) {
        this.app = app;
        this.gameManager = gameManager;
        this.byteClassManager = byteClassManager;
        this.botController = botController;
    }

    init() {
        this.app.get('/api/byte/:id', this.getByte.bind(this));
        this.app.post('/api/combat/simulate', this.simulateCombat.bind(this));
        this.app.get('/api/avatar', this.getAvatar.bind(this));
        this.app.get('/api/class/:id', this.getClass.bind(this));
        this.app.post('/api/byte/upgrade', this.upgradeByte.bind(this));
    }

    async getByte(req, res) {
        const byte = await this.gameManager.getByte(req.params.id);
        if (byte) {
            const status = byte.getStatus();
            status.colors = getAvatarColors(status.name, status.byteClass);
            res.json(status);
        } else {
            res.status(404).json({ error: 'Byte not found' });
        }
    }

    async getAvatar(req, res) {
        const { name, charClass, level } = req.query;
        if (!name) {
            return res.status(400).send('Missing name parameter');
        }
        const svgString = generateClassBasedAvatar(
            name,
            charClass || 'demo',
            parseInt(level, 10) || 1,
        );
        // Send as raw SVG, the frontend will handle rendering
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
            if (playerByte.pools.bits.value < cost)
                return res.status(400).json({ error: 'Not enough Bits' });

            const previousLevel = playerByte.level;

            // Deduct Bits and apply the upgrade
            playerByte.pools.bits.decrease(cost);
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

    async simulateCombat(req, res) {
        try {
            const { userId } = req.body;
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
}

module.exports = WebApiController;
