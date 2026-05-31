const ShopManager = require('../managers/ShopManager');
const ItemManager = require('../managers/ItemManager');
const GameContext = require('../models/GameContext');
const GameEvents = require('../util/GameEvents');

/**
 * @mixin WebAPIShopHandler
 *
 * Handles routing logic for fetching available shops and their inventories.
 */
const WebAPIShopHandler = {
    async handleGetShops(req, res) {
        try {
            const { userId } = req.query;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);

            const context = new GameContext(byte, player);
            const availableShops = ShopManager.getAvailableShops(context);
            const shopsData = availableShops.map((shop) => shop.toWeb(player));

            res.json(shopsData);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async handleBuyItem(req, res) {
        const { userId, shopId, itemId } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);
            const item = ItemManager.getItem(itemId);
            const shop = ShopManager.getShop(shopId);

            if (!byte || !player || !item || !shop) {
                return res.status(404).json({ error: 'Data not found' });
            }

            let calculatedCost;
            try {
                calculatedCost = shop.buyItem(byte, player, item);
            } catch (err) {
                return res.status(400).json({ error: err.message });
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
            this.gameManager.deleteTransaction(userId);
        }
    },

    async handleSellItem(req, res) {
        const { userId, shopId, itemId } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const byte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);
            const item = ItemManager.getItem(itemId);
            const shop = ShopManager.getShop(shopId);

            if (!byte || !player || !item || !shop) {
                return res.status(404).json({ error: 'Data not found' });
            }

            let sellPrice;
            try {
                sellPrice = shop.sellItem(byte, player, item);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

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
            this.gameManager.deleteTransaction(userId);
        }
    },
};

module.exports = WebAPIShopHandler;
