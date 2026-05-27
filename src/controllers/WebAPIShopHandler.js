const ShopManager = require('../managers/ShopManager');
const ItemManager = require('../managers/ItemManager');
const GameContext = require('../models/GameContext');

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
};

module.exports = WebAPIShopHandler;