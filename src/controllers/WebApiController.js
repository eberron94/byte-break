const WebAPIGetHandler = require('./WebAPIGetHandler');
const WebAPIPostHandler = require('./WebAPIPostHandler');

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

        // --- Mixin Pattern ---
        // The `Object.assign` method is used to "mix in" the methods from the
        // handler files. This allows us to keep the route logic in separate,
        // more manageable files while still having access to the controller's
        // `this` context (e.g., `this.gameManager`).
        Object.assign(this, WebAPIGetHandler);
        Object.assign(this, WebAPIPostHandler);
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
}

module.exports = WebApiController;
