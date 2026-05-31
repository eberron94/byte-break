const WebAPIDebugHandler = require('./WebAPIDebugHandler');
const WebAPIPlayerHandler = require('./WebAPIPlayerHandler');
const WebAPIShopHandler = require('./WebAPIShopHandler');
const WebAPIByteHandler = require('./WebAPIByteHandler');
const WebAPICraftingHandler = require('./WebAPICraftingHandler');
const WebAPICombatHandler = require('./WebAPICombatHandler');
const WebAPIUIHandler = require('./WebAPIUIHandler');
const WebAPIRoomHandler = require('./WebAPIRoomHandler');
const crypto = require('crypto');

/**
 * The main router for all Express-based API endpoints. This class acts as a
 * lightweight orchestrator, binding route handlers from external mixin files.
 * This pattern keeps the controller clean and focused on routing, while the
 * heavy lifting is delegated to the specialized handler files.
 */
class WebApiController {
    constructor(app, gameManager, botController = null) {
        this.app = app;
        this.gameManager = gameManager;
        this.botController = botController;

        this.lastCombatMessages = new Map();

        // --- Mixin Pattern ---
        // The `Object.assign` method is used to "mix in" the methods from the
        // handler files. This allows us to keep the route logic in separate,
        // more manageable files while still having access to the controller's
        // `this` context (e.g., `this.gameManager`).
        Object.assign(this, WebAPIDebugHandler);
        Object.assign(this, WebAPIPlayerHandler);
        Object.assign(this, WebAPIShopHandler);
        Object.assign(this, WebAPIByteHandler);
        Object.assign(this, WebAPICraftingHandler);
        Object.assign(this, WebAPICombatHandler);
        Object.assign(this, WebAPIUIHandler);
        Object.assign(this, WebAPIRoomHandler);
    }

    authenticateWebAppRequest(req, res, next) {
        const initDataString = req.headers['x-telegram-init-data'];
        const botToken = process.env.TELEGRAM_BOT_TOKEN;

        // Extract the ID the client is trying to read/modify
        let requestedId = req.body.userId || req.query.userId;
        if (!requestedId) {
            // Attempt to manually parse the ID from common GET routes like /api/byte/:id
            const parts = req.path.split('/');
            const potentialId = parts[parts.length - 1];
            if (/^\d+$/.test(potentialId)) requestedId = potentialId;
        }

        // Only enforce strict validation on routes dealing with specific user data
        if (botToken && requestedId) {
            if (!initDataString) {
                return res.status(403).json({
                    error: 'Unauthorized. Missing Telegram signature.',
                });
            }

            try {
                const urlParams = new URLSearchParams(initDataString);
                const hash = urlParams.get('hash');
                urlParams.delete('hash');

                const dataToCheck = [...urlParams.entries()]
                    .map(([key, val]) => `${key}=${val}`)
                    .sort()
                    .join('\n');

                const secretKey = crypto
                    .createHmac('sha256', 'WebAppData')
                    .update(botToken)
                    .digest();
                const calculatedHash = crypto
                    .createHmac('sha256', secretKey)
                    .update(dataToCheck)
                    .digest('hex');

                if (calculatedHash !== hash) {
                    return res.status(403).json({
                        error: 'Unauthorized. Data signature mismatch.',
                    });
                }

                const validUser = JSON.parse(urlParams.get('user'));
                if (requestedId.toString() !== validUser.id.toString()) {
                    return res.status(403).json({
                        error: 'Unauthorized. User identity mismatch.',
                    });
                }
            } catch (err) {
                return res
                    .status(403)
                    .json({ error: 'Unauthorized. Invalid auth payload.' });
            }
        }
        next();
    }

    init() {
        // Apply authentication middleware to all API routes
        this.app.use('/api', this.authenticateWebAppRequest.bind(this));

        this.app.get('/api/byte/:id', this.getByte.bind(this));
        this.app.get('/api/bytes/:id', this.getBytes.bind(this));
        this.app.get('/api/player/:id', this.getPlayer.bind(this));
        this.app.get('/api/rooms/:id', this.getRooms.bind(this));
        this.app.post('/api/combat/simulate', this.simulateCombat.bind(this));
        this.app.get('/api/avatar', this.getAvatar.bind(this));
        this.app.get('/api/class/:id', this.getClass.bind(this));
        this.app.post('/api/byte/upgrade', this.upgradeByte.bind(this));
        this.app.get('/api/inventory/:id', this.getInventory.bind(this));
        this.app.get('/api/shops', this.handleGetShops.bind(this));
        this.app.get('/api/crafting/:id', this.getCraftingRecipes.bind(this));
        this.app.post('/api/shop/buy', this.handleBuyItem.bind(this));
        this.app.post('/api/shop/sell', this.handleSellItem.bind(this));
        this.app.post('/api/crafting/craft', this.craftRecipe.bind(this));
        this.app.get('/api/equipment/:id', this.getEquipment.bind(this));
        this.app.post('/api/equipment/toggle', this.toggleEquipment.bind(this));
        this.app.post('/api/settings/update', this.updateSettings.bind(this));
        this.app.post('/api/byte/merge', this.mergeBytes.bind(this));
        this.app.post('/api/ui/refresh', this.refreshUI.bind(this));
        this.app.get('/api/talents/:id', this.getTalents.bind(this));
        this.app.post('/api/talent/buy', this.buyTalent.bind(this));
        this.app.get('/api/achievements/:id', this.getAchievements.bind(this));
        this.app.get(
            '/api/achievement-icon',
            this.getAchievementIcon.bind(this),
        );
        this.app.get('/api/logs/:id', this.getPlayerLogs.bind(this));
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
}

module.exports = WebApiController;
