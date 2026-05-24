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
const GameContext = require('../models/GameContext');
const GameObjectManager = require('../managers/GameObjectManager');

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
        setInterval(
            () => {
                const now = Date.now();
                for (const [chatId, state] of this.userStates.entries()) {
                    if (state.timestamp && now - state.timestamp > 3600000) {
                        // 1 hour
                        this.userStates.delete(chatId);
                    }
                }
            },
            60 * 60 * 1000,
        );

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
        this.game.on(GameEvents.RANDOM_EVENT, async (b, e, grantedLoot) => {
            try {
                const player = await this.game.getPlayer(b.ownerId);
                const notifySetting = player.settings?.notifications?.events ?? 'sound';
                if (notifySetting === false || notifySetting === 'off') return;

                let msg = `🔔 **Random Event:** ${e.name}\n_${e.description}_`;

                const lootStr = GameObjectManager.formatLootString(grantedLoot, new GameContext(b, player));
                if (lootStr) msg += `\n\n🎁 **Rewards:** ${lootStr}`;

                await this.bot.sendMessage(b.ownerId, msg, {
                    parse_mode: 'Markdown',
                    disable_notification: notifySetting === 'silent'
                });
            } catch (err) {
                console.error(
                    '[GameEvents] Error in RANDOM_EVENT listener:',
                    err,
                );
            }
        });

        this.game.on(GameEvents.ENERGY_REWARD, async (playerId, amount) => {
            try {
                const player = await this.game.getPlayer(playerId);
                const notifySetting = player.settings?.notifications?.energy ?? 'sound';
                if (notifySetting === false || notifySetting === 'off') return;

                await this.bot.sendMessage(
                    playerId,
                    `⚡ **Community Energy Reward!**\n_You gained ${amount} ε for being active._`,
                    { 
                        parse_mode: 'Markdown',
                        disable_notification: notifySetting === 'silent' 
                    },
                );
            } catch (err) {
                console.error(
                    '[GameEvents] Error in ENERGY_REWARD listener:',
                    err,
                );
            }
        });

        this.game.on(
            GameEvents.LEVEL_UP,
            async (playerId, newLevel, byteName) => {
                if (!newLevel || !byteName) return; // Skip if arguments are missing
                try {
                    const player = await this.game.getPlayer(playerId);
                    const notifySetting = player.settings?.notifications?.levelUp ?? 'silent';
                    if (notifySetting === false || notifySetting === 'off') return;
                    await this.bot.sendMessage(playerId, `🎉 **LEVEL UP!**\n${byteName} reached Level ${newLevel}!`, { 
                        parse_mode: 'Markdown', 
                        disable_notification: notifySetting === 'silent' 
                    });
                } catch (err) {}
            }
        );

        this.game.on(
            GameEvents.ACHIEVEMENT_UNLOCKED,
            async (playerId, achievement) => {
                try {
                    const player = await this.game.getPlayer(playerId);
                    const notifySetting = player.settings?.notifications?.achievements ?? 'sound';
                    if (notifySetting === false || notifySetting === 'off') return;

                    const svgString = generateAchievementCard(achievement);
                    const pngBuffer = await sharp(Buffer.from(svgString))
                        .png()
                        .toBuffer();

                    await this.bot.sendPhoto(playerId, pngBuffer, {
                        caption: `🏆 **Achievement Unlocked!**\n*${achievement.name}*`,
                        parse_mode: 'Markdown',
                        disable_notification: notifySetting === 'silent'
                    });
                } catch (err) {
                    console.error('Failed to send achievement card:', err);
                }
            },
        );

        this.game.on('ENERGY_FULL', async (playerId) => {
            const player = await this.game.getPlayer(playerId);
            const notifySetting = player.settings?.notifications?.energyFull ?? 'sound';
            if (notifySetting === false || notifySetting === 'off') return;
            await this.bot.sendMessage(playerId, `🔋 **Energy Restored!**\nYour Player Energy is now at maximum capacity.`, { 
                parse_mode: 'Markdown',
                disable_notification: notifySetting === 'silent'
            });
        });

        this.game.on('BYTE_DORMANT', async (playerId, byte) => {
            const player = await this.game.getPlayer(playerId);
            const notifySetting = player.settings?.notifications?.dormant ?? 'sound';
            if (notifySetting === false || notifySetting === 'off') return;
            await this.bot.sendMessage(playerId, `⚠️ **System Dormant!**\n${byte.name}'s core needs have depleted. Passive operations suspended.`, { 
                parse_mode: 'Markdown',
                disable_notification: notifySetting === 'silent'
            });
        });

        this.game.on('BIT_BUFFER_FULL', async (playerId, byte) => {
            const player = await this.game.getPlayer(playerId);
            const notifySetting = player.settings?.notifications?.bufferFull ?? 'sound';
            if (notifySetting === false || notifySetting === 'off') return;
            await this.bot.sendMessage(playerId, `💾 **Buffer Full!**\n${byte.name} has filled their Bit Buffer. They are ready for a System Upgrade!`, { 
                parse_mode: 'Markdown',
                disable_notification: notifySetting === 'silent'
            });
        });

        this.game.on('HEDIFF_ESCALATED', async (playerId, byte, oldDef, newDef) => {
            const player = await this.game.getPlayer(playerId);
            const notifySetting = player.settings?.notifications?.hediff ?? 'sound';
            if (notifySetting === false || notifySetting === 'off') return;
            await this.bot.sendMessage(playerId, `📉 **Condition Worsened!**\n${byte.name}'s ${oldDef.name} has escalated into ${newDef?.name || 'a severe state'}!`, { 
                parse_mode: 'Markdown',
                disable_notification: notifySetting === 'silent'
            });
        });

        this.game.on('HEDIFF_EXPIRED', async (playerId, byte, hDef) => {
            const player = await this.game.getPlayer(playerId);
            const notifySetting = player.settings?.notifications?.hediff ?? 'sound';
            if (notifySetting === false || notifySetting === 'off') return;
            await this.bot.sendMessage(playerId, `✨ **Condition Cleared!**\n${byte.name} has recovered from ${hDef.name}.`, { 
                parse_mode: 'Markdown',
                disable_notification: notifySetting === 'silent'
            });
        });

        this.game.on('PLAYER_HEDIFF_ESCALATED', async (playerId, oldDef, newDef) => {
            const player = await this.game.getPlayer(playerId);
            const notifySetting = player.settings?.notifications?.hediff ?? 'sound';
            if (notifySetting === false || notifySetting === 'off') return;
            await this.bot.sendMessage(playerId, `📉 **Condition Worsened!**\nYour ${oldDef.name} has escalated into ${newDef?.name || 'a severe state'}!`, { 
                parse_mode: 'Markdown',
                disable_notification: notifySetting === 'silent'
            });
        });

        this.game.on('PLAYER_HEDIFF_EXPIRED', async (playerId, hDef) => {
            const player = await this.game.getPlayer(playerId);
            const notifySetting = player.settings?.notifications?.hediff ?? 'sound';
            if (notifySetting === false || notifySetting === 'off') return;
            await this.bot.sendMessage(playerId, `✨ **Condition Cleared!**\nYour status ${hDef.name} has expired.`, { 
                parse_mode: 'Markdown',
                disable_notification: notifySetting === 'silent'
            });
        });

        this.game.on('ACTIVITY_LOG', async (chatId, message) => {
            try {
                const player = await this.game.getPlayer(chatId);
                const notifySetting = player.settings?.notifications?.activity ?? 'silent';
                if (notifySetting === false || notifySetting === 'off') return;
                await this.bot.sendMessage(chatId, `📝 ${message}`, {
                    parse_mode: 'Markdown',
                    disable_notification: notifySetting === 'silent'
                });
            } catch (err) {}
        });

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
