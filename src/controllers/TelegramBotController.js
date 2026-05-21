const sharp = require('sharp');
const {
    generateTradingCard,
    generateStasisCard,
    generateAchievementCard,
} = require('../util/card');
const GameEvents = require('../util/GameEvents');
const TelegramUIBuilders = require('./TelegramUIBuilders');
const handleCallbackQuery = require('./TelegramCallbackHandler');
const TelegramCommandHandlers = require('./TelegramCommandHandlers');
const handleMessage = require('./TelegramMessageHandlers');
const TelegramUIOperators = require('./TelegramUIOperators');

/**
 * Acts as the UI layer mapping Telegram interactions into GameManager logic.
 * This main controller acts as a lightweight orchestrator, delegating heavy
 * UI formatting and callback routing to external mixins and handler functions
 * to maintain a clean and manageable codebase.
 */
class TelegramBotController {
    constructor(bot, gameManager) {
        this.bot = bot;
        this.game = gameManager;

        // Simple state machine to track multi-step interactions per user
        this.userStates = new Map();

        // Wrap the set method to automatically inject a timestamp for garbage collection
        const originalSet = this.userStates.set.bind(this.userStates);
        this.userStates.set = (key, value) => {
            const oldState = this.userStates.get(key);
            if (oldState && oldState.timeoutId) {
                clearTimeout(oldState.timeoutId);
            }

            if (value && typeof value === 'object') {
                value.timestamp = Date.now();
            }
            return originalSet(key, value);
        };

        // Wrap the delete method to automatically clean up any active timeouts
        const originalDelete = this.userStates.delete.bind(this.userStates);
        this.userStates.delete = (key) => {
            const state = this.userStates.get(key);
            if (state && state.timeoutId) {
                clearTimeout(state.timeoutId);
            }
            return originalDelete(key);
        };

        // Garbage collection: Sweep stale user states every hour to prevent memory leaks from abandoned minigames/prompts
        setInterval(() => {
            const now = Date.now();
            for (const [chatId, state] of this.userStates.entries()) {
                if (state.timestamp && now - state.timestamp > 3600000) { // 1 hour
                    this.userStates.delete(chatId);
                }
            }
        }, 60 * 60 * 1000);

        // --- Mixin Pattern ---
        // The `Object.assign` method is used to "mix in" the methods from the
        // TelegramUIBuilders file. This allows us to keep the UI generation logic
        // separate while still having access to the controller's `this` context
        // (e.g., `this.roomManager`, `this.itemManager`).
        Object.assign(this, TelegramUIBuilders);
        Object.assign(this, TelegramCommandHandlers);
        Object.assign(this, TelegramUIOperators);
    }

    init() {
        // Register UI auto-complete commands with the Telegram Client
        this.bot.setMyCommands([
            { command: '/start', description: 'Welcome to Telegram-gotchi!' },
            {
                command: '/spawn',
                description: 'Spawn a new byte (usage: /spawn name)',
            },
            {
                command: '/status',
                description: "View your byte's status and activities",
            },
            {
                command: '/merge',
                description: 'Merge two Bytes to create a stronger child',
            },
            { command: '/rooms', description: 'View all available rooms' },
            {
                command: '/move',
                description: 'Move to a different room (usage: /move room_id)',
            },
            { command: '/inventory', description: 'View your items' },
            {
                command: '/tick',
                description: 'Force game ticks (usage: /tick [amount])',
            },
            {
                command: '/avatar',
                description:
                    'Preview avatar at level(s) (usage: /avatar [level] [maxLevel])',
            },
        ]);

        // Map message commands
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.onText(/\/spawn(?:\s+(.+))?/, this.handleSpawn.bind(this));
        this.bot.onText(/\/merge/, this.handleMerge.bind(this));
        this.bot.onText(/\/status/, this.handleStatus.bind(this));
        this.bot.onText(/\/rooms/, this.handleRooms.bind(this));
        this.bot.onText(/\/move(?:\s+(.+))?/, this.handleMove.bind(this));
        this.bot.onText(/\/inventory/, this.handleInventory.bind(this));
        this.bot.onText(/\/tick(?:\s+(\d+))?/, this.handleTick.bind(this));
        this.bot.onText(
            /\/avatar(?:\s+(\d+))?(?:\s+(\d+))?/,
            this.handleAvatar.bind(this),
        );

        // Intercept inline button clicks
        this.bot.on('callback_query', handleCallbackQuery.bind(this));

        // Intercept general messages for state machine
        this.bot.on('message', handleMessage.bind(this));

        // Register system callbacks for global messaging
        this.game.on(GameEvents.RANDOM_EVENT, async (b, e) => {
            try {
                const player = await this.game.getPlayer(b.ownerId);
                if (player.settings?.notifications?.events === false) return;

                await this.bot.sendMessage(
                    b.ownerId,
                    `🔔 **Random Event:** ${e.name}\n_${e.description}_`,
                    { parse_mode: 'Markdown' },
                );
            } catch (err) {
                console.error('[GameEvents] Error in RANDOM_EVENT listener:', err);
            }
        });

        this.game.on(GameEvents.ENERGY_REWARD, async (playerId, amount) => {
            try {
                const player = await this.game.getPlayer(playerId);
                if (player.settings?.notifications?.energy === false) return;

                await this.bot.sendMessage(
                    playerId,
                    `⚡ **Community Energy Reward!**\n_You gained ${amount} ε for being active._`,
                    { parse_mode: 'Markdown' },
                );
            } catch (err) {
                console.error('[GameEvents] Error in ENERGY_REWARD listener:', err);
            }
        });

        this.game.on(
            GameEvents.ACHIEVEMENT_UNLOCKED,
            async (playerId, achievement) => {
                try {
                    const svgString = generateAchievementCard(achievement);
                    const pngBuffer = await sharp(Buffer.from(svgString))
                        .png()
                        .toBuffer();

                    await this.bot.sendPhoto(playerId, pngBuffer, {
                        caption: `🏆 **Achievement Unlocked!**\n*${achievement.name}*`,
                        parse_mode: 'Markdown',
                    });
                } catch (err) {
                    console.error('Failed to send achievement card:', err);
                }
            },
        );

        // Clean up user state automatically when a minigame concludes naturally
        this.game.on(GameEvents.MINIGAME_END, (chatId) => {
            this.userStates.delete(chatId);
        });

        // Clean up user state if their active byte is permanently deleted
        this.game.on(GameEvents.BYTE_DELETED, (userId) => {
            this.userStates.delete(userId);
        });
    }
}

module.exports = TelegramBotController;
