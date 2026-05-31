const ItemManager = require('../managers/ItemManager');
const { generateClassBasedAvatar, getAvatarColors } = require('../util/avatar');
const ByteClassManager = require('../managers/ByteClassManager');

/**
 * @mixin WebAPIByteHandler
 *
 * This mixin contains all the route handler logic for Byte-centric modifications,
 * such as upgrading, rebooting, and altering equipment loadouts.
 */
const WebAPIByteHandler = {
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

    async getClass(req, res) {
        const byteClass = ByteClassManager.getClass(req.params.id);
        if (byteClass) {
            res.json(byteClass);
        } else {
            res.status(404).json({ error: 'Class not found' });
        }
    },

    async mergeBytes(req, res) {
        const { userId, byte1Id, byte2Id, newName } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
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
            this.gameManager.deleteTransaction(userId);
        }
    },

    async upgradeByte(req, res) {
        const { userId, upgradeKey } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const playerByte = await this.gameManager.getByte(userId);

            if (!playerByte)
                return res.status(404).json({ error: 'Byte not found' });

            try {
                playerByte.upgrade(upgradeKey);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            await this.gameManager.saveByte(playerByte);

            if (this.botController) {
                const player = await this.gameManager.getPlayer(userId);
                let statusMsg = `System updated: ${upgradeKey} enhanced.`;

                this.botController
                    .sendStatusUI(userId, playerByte, player, statusMsg)
                    .catch(console.error);
            }
            res.json(playerByte.getStatus());
        } catch (error) {
            console.error('Upgrade API Error:', error);
            res.status(500).json({ error: 'Failed to upgrade byte.' });
        } finally {
            this.gameManager.deleteTransaction(userId);
        }
    },

    async useRebooter(req, res) {
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
            const byte = await this.gameManager.getByte(userId);

            if (!player || !byte)
                return res.status(404).json({ error: 'Not found' });

            try {
                byte.useRebooter(player);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

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
        } catch (error) {
            console.error('Rebooter API Error:', error);
            res.status(500).json({ error: 'Failed to reboot byte.' });
        } finally {
            this.gameManager.deleteTransaction(userId);
        }
    },

    async toggleEquipment(req, res) {
        const { userId, itemId, type, action } = req.body;
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

            if (!player || !byte)
                return res.status(404).json({ error: 'Not found' });

            try {
                byte.toggleEquipment(player, itemId, type, action);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            await this.gameManager.saveByte(byte);
            await this.gameManager.savePlayer(player);

            if (this.botController) {
                const item = ItemManager.getItem(itemId);
                const msg =
                    action === 'equip'
                        ? `Equipped ${item.name}!`
                        : `Unequipped ${item.name}!`;
                this.botController
                    .sendStatusUI(userId, byte, player, msg)
                    .catch(console.error);
            }

            res.json({ byte: byte.getStatus(), player: player.inventory });
        } catch (error) {
            console.error('Equipment API Error:', error);
            res.status(500).json({ error: error.message });
        } finally {
            this.gameManager.deleteTransaction(userId);
        }
    },
};

module.exports = WebAPIByteHandler;
