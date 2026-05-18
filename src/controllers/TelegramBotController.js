const sharp = require('sharp');
const { generateTradingCard, generateStasisCard, generateAchievementCard } = require('../util/card');
const dbManager = require('../database/db');
const GameEvents = require('../util/GameEvents');
const TelegramUIBuilders = require('./TelegramUIBuilders');
const handleCallbackQuery = require('./TelegramCallbackHandler');

/**
 * Acts as the UI layer mapping Telegram interactions into GameManager logic.
 */
class TelegramBotController {
    constructor(bot, gameManager, roomManager, activityManager, itemManager) {
        this.bot = bot;
        this.game = gameManager;
        this.roomManager = roomManager;
        this.activityManager = activityManager;
        this.itemManager = itemManager;

        // Simple state machine to track multi-step interactions per user
        this.userStates = new Map();

        // Bind UI Builders
        Object.assign(this, TelegramUIBuilders);
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
        this.bot.on('message', this.handleMessage.bind(this));

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
            } catch (err) {}
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
            } catch (err) {}
        });

        this.game.on(
            GameEvents.ACHIEVEMENT_UNLOCKED,
            async (playerId, achievement) => {
                try {
                    const svgString = generateAchievementCard(achievement);
                    const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
                    
                    await this.bot.sendPhoto(playerId, pngBuffer, {
                        caption: `🏆 **Achievement Unlocked!**\n*${achievement.name}*`,
                        parse_mode: 'Markdown',
                    });
                } catch (err) {
                    console.error('Failed to send achievement card:', err);
                }
            },
        );
    }

    // Welcome response handler
    async handleStart(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /start from chat ${chatId}`);
        await this.bot.sendMessage(
            chatId,
            'Welcome to Tele-grow! Use `/spawn [name]` to get your first byte.',
        );
    }

    // Spawns a new byte and commits it to the database
    async handleSpawn(msg, match) {
        const chatId = msg.chat.id;
        const byteName = match[1];

        const bytes = await this.game.getBytes(chatId);
        const player = await this.game.getPlayer(chatId);
        const livingBytes = bytes.filter((b) => b.isAlive);
        const maxBytes = player.maxBytes || 2;

        if (livingBytes.length >= maxBytes) {
            await this.bot.sendMessage(
                chatId,
                `You already have the maximum number of living bytes (${maxBytes})!`,
            );
            return;
        }

        if (!byteName) {
            console.log(
                `[Command] /spawn (prompting for name) from chat ${chatId}`,
            );
            this.userStates.set(chatId, { state: 'AWAITING_BYTE_NAME' });
            await this.bot.sendMessage(
                chatId,
                'What would you like to name your new byte?',
            );
            return;
        }

        console.log(`[Command] /spawn ${byteName} from chat ${chatId}`);
        this.userStates.set(chatId, { state: 'AWAITING_BYTE_CLASS', byteName: byteName.trim() });
        const { text, options } = this.getClassSelectionDisplay(byteName.trim());
        await this.bot.sendMessage(chatId, text, options);
    }

    // Handles user state machine for multi-step interactions
    async handleMessage(msg) {
        if (!msg.text) return;
        const chatId = msg.chat.id;

        this.game.recordPlayerActivity(chatId).catch(console.error);

        // If it's a command, clear any pending state and let the command handler take over
        if (msg.text.startsWith('/')) {
            this.userStates.delete(chatId);
            return;
        }

        const userState = this.userStates.get(chatId);
        if (userState) {
            if (userState.state === 'AWAITING_BYTE_NAME') {
                const byteName = msg.text.trim();
                console.log(
                    `[State] Received byte name '${byteName}' from chat ${chatId}`,
                );
                this.userStates.set(chatId, { state: 'AWAITING_BYTE_CLASS', byteName: byteName });
                const { text, options } = this.getClassSelectionDisplay(byteName);
                await this.bot.sendMessage(chatId, text, options);
            } else if (userState.state === 'AWAITING_DELETE_CONFIRM') {
                clearTimeout(userState.timeoutId);
                this.userStates.delete(chatId);

                if (msg.text.trim() === 'YES') {
                    try {
                        await this.game.deleteByte(chatId, userState.byteId);
                        await this.bot.sendMessage(
                            chatId,
                            `✅ Byte successfully deleted.`,
                        );
                    } catch (e) {
                        await this.bot.sendMessage(
                            chatId,
                            `Failed to delete byte: ${e.message}`,
                        );
                    }
                } else {
                    await this.bot.sendMessage(
                        chatId,
                        `❌ Deletion cancelled.`,
                    );
                }

                const bytes = await this.game.getBytes(chatId);
                const player = await this.game.getPlayer(chatId);
                await this.sendStasisUI(chatId, bytes, player);
            } else if (userState.state.startsWith('MINIGAME_')) {
                await this.bot.sendMessage(
                    chatId,
                    "⚠️ You are currently in a minigame session. Use the inline buttons to interact, or press ❌ Abort.",
                );
                return;
            }
        }
    }

    async handleMerge(msg) {
        const chatId = msg.chat.id;
        this.userStates.delete(chatId);
        console.log(`[Command] /merge from chat ${chatId}`);

        const bytes = await this.game.getBytes(chatId);
        const livingBytes = bytes.filter((b) => b.isAlive);

        if (livingBytes.length < 2) {
            return this.bot.sendMessage(
                chatId,
                'You need at least 2 living Bytes to perform a merge.',
            );
        }

        const webAppUrl = process.env.WEB_APP_URL;
        if (!webAppUrl) return;

        const separator = webAppUrl.includes('?') ? '&' : '?';
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '🧬 Enter Merge Lab',
                            web_app: {
                                url: `${webAppUrl}${separator}view=merge`,
                            },
                        },
                    ],
                ],
            },
        };

        await this.bot.sendMessage(
            chatId,
            'The Merge Lab is ready. Click below to begin the sequence.',
            options,
        );
    }

    async processSpawn(chatId, byteName, byteClass = 'demo') {
        try {
            const newByte = await this.game.createByte(chatId, byteName, byteClass);
            const player = await this.game.getPlayer(chatId);
            await this.sendStatusUI(
                chatId,
                newByte,
                player,
                `🎉 Congratulations! You spawned ${newByte.name}!`
            );
        } catch (error) {
            await this.bot.sendMessage(
                chatId,
                error.message || 'Failed to spawn a new byte.',
            );
        }
    }

    async updateMessageDisplay(query, text, options) {
        options.chat_id = query.message.chat.id;
        options.message_id = query.message.message_id;

        // Update our tracker so if they send a command next, we know THIS is the active UI
        await dbManager.saveUIMessage(
            options.chat_id,
            options.message_id,
            query.message.photo ? 'photo' : 'text',
        );

        try {
            if (query.message.photo) {
                options.caption = text;
                await this.bot.editMessageCaption(text, options);
            } else {
                await this.bot.editMessageText(text, options);
            }
        } catch (err) {
            if (!err.message.includes('message is not modified')) {
                console.error(err);
            }
        }
    }

    // Helper to send a new UI message or update the existing one if it's the most recent
    async sendOrUpdateUI(
        chatId,
        text,
        options,
        userMsgId = null,
        pngBuffer = null,
    ) {
        const type = pngBuffer ? 'photo' : 'text';

        // 1. Send the new message first so the UI updates instantly for the user
        let sentMsg;
        if (type === 'photo') {
            options.caption = text;
            sentMsg = await this.bot.sendPhoto(chatId, pngBuffer, options, {
                filename: 'avatar.png',
                contentType: 'image/png',
            });
        } else {
            sentMsg = await this.bot.sendMessage(chatId, text, options);
        }

        // 2. Retrieve the last UI message ID from the database
        const lastUI = await dbManager.getUIMessage(chatId);

        // 3. Save the new message ID to the database
        await dbManager.saveUIMessage(chatId, sentMsg.message_id, type);

        // 4. Clean up the old UI message
        if (lastUI) {
            try {
                await this.bot.deleteMessage(chatId, lastUI.messageId);
            } catch (err) {
                // Ignore delete errors (e.g. if the message was already deleted manually)
            }
        }

        // 5. Clean up the user's chat command (e.g. "/status")
        if (userMsgId) {
            try {
                await this.bot.deleteMessage(chatId, userMsgId);
            } catch (err) {
                // Ignore delete errors
            }
        }
    }

    // Generates the trading card image and updates the UI
    async sendStatusUI(
        chatId,
        byte,
        player,
        statusMessage = null,
        userMsgId = null,
    ) {
        const { text, options } = this.getByteStatusDisplay(
            byte,
            player,
            statusMessage,
        );

        try {
            const svgString = generateTradingCard(byte);
            const pngBuffer = await sharp(Buffer.from(svgString))
                .png()
                .toBuffer();
            await this.sendOrUpdateUI(
                chatId,
                text,
                options,
                userMsgId,
                pngBuffer,
            );
        } catch (error) {
            console.error('Failed to generate or send trading card:', error);
            await this.sendOrUpdateUI(chatId, text, options, userMsgId, null);
        }
    }

    // Generates the stasis bay image and updates the UI
    async sendStasisUI(chatId, bytes, player, userMsgId = null) {
        const { text, options } = this.getByteSelectionDisplay(bytes, player);

        try {
            const svgString = generateStasisCard(bytes, player);
            const pngBuffer = await sharp(Buffer.from(svgString))
                .png()
                .toBuffer();
            await this.sendOrUpdateUI(
                chatId,
                text,
                options,
                userMsgId,
                pngBuffer,
            );
        } catch (error) {
            console.error('Failed to generate stasis card:', error);
            await this.sendOrUpdateUI(chatId, text, options, userMsgId, null);
        }
    }

    // Formats and constructs the main Telegram message displaying byte status
    getByteStatusDisplay(byte, player, lastActionMessage = null) {
        const status = byte.getStatus();
        if (!status.isAlive) {
            return {
                text: `💀 ${status.name} has passed away due to neglect.`,
                options: {},
            };
        }

        const room = this.roomManager.getRoom(status.room);
        const roomName = room ? room.name : status.room.replace(/_/g, '\\_');

        const invEntries = Object.entries(player.inventory).map(([id, amt]) => {
            const item = this.itemManager.getItem(id);
            const name = item ? item.shortname : id.replace(/_/g, '\\_');
            return `${name}: ${amt}`;
        });
        const invString =
            invEntries.length > 0 ? invEntries.join(', ') : 'Empty';

        let text = ` **Room:** ${roomName}\n`;

        if (status.isDormant) {
            text += `\n⚠️ **SYSTEM DORMANT** ⚠️\n_Core needs depleted. Passive operations suspended._\n\n`;
        }

        if (room && room.tickEffects) {
            const evaluatedEffects = calculateEffects(
                room.tickEffects,
                byte,
                player,
            );
            const effectsStr = Object.entries(evaluatedEffects)
                .map(
                    ([key, val]) =>
                        `${val > 0 ? '+' : ''}${val} ${key.charAt(0).toUpperCase() + key.slice(1)}/min`,
                )
                .join(', ');
            text += `⏱️ **Passive Effects:** ${effectsStr}\n`;
        }

        if (room && room.id === 'market') {
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

            const allShops = ShopManager.getAllShops();
            if (allShops.length > 0) {
                text += `\n🏪 **Market Directory:**\n`;
                allShops.forEach((shop) => {
                    const isOpen = shop.canAppear(context);
                    const statusIcon = isOpen ? '🟢' : '🔴';
                    const statusText = isOpen ? 'OPEN' : 'CLOSED';

                    const d = shop.timeAvailable.daysOfWeek;
                    let daysStr = 'Everyday';
                    if (d && d.length < 7) {
                        if (d.length === 2 && d.includes(0) && d.includes(6))
                            daysStr = 'Weekends';
                        else if (
                            d.length === 5 &&
                            !d.includes(0) &&
                            !d.includes(6)
                        )
                            daysStr = 'Weekdays';
                        else
                            daysStr = d
                                .map(
                                    (day) =>
                                        [
                                            'Sun',
                                            'Mon',
                                            'Tue',
                                            'Wed',
                                            'Thu',
                                            'Fri',
                                            'Sat',
                                        ][day],
                                )
                                .join(', ');
                    }

                    const p = shop.timeAvailable.timePhase;
                    let phasesStr = 'All Day';
                    if (p && p.length > 0) {
                        phasesStr = p
                            .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
                            .join('/');
                    }

                    text += `${statusIcon} **${shop.name}** (${statusText})\n   └ _${daysStr} | ${phasesStr}_\n`;
                });
            }
        }

        text += `\n━━━━━━━━━━━━━━━━━━━━━\n⚡ **Player Energy:** ${player.energy.value}/${player.energy.maxValue} ε | 🪙 **Achievement Points:** ${player.achievementPoints.available}/${player.achievementPoints.value} α\n🎒 **Inventory:** ${invString}`;

        if (lastActionMessage) {
            text += `\n📢 **Last Action:** ${lastActionMessage}`;
        }

        const inline_keyboard = [];

        // Build inline action buttons depending on what activities are available in the current room
        if (room && room.allowedActivities) {
            const buttons = [];
            const webAppUrl = process.env.WEB_APP_URL;
            for (const actId of room.allowedActivities) {
                const activity = this.activityManager.getActivity(actId);
                if (activity) {
                    buttons.push(
                        this.activityManager.getActivityButton(
                            activity,
                            webAppUrl,
                            byte,
                            player
                        ),
                    );
                }
            }
            for (let i = 0; i < buttons.length; i += 2) {
                inline_keyboard.push(buttons.slice(i, i + 2));
            }
        }

        inline_keyboard.push([
            { text: '🚶 Move Rooms', callback_data: 'nav_rooms' },
            { text: '🎒 Inventory', callback_data: 'nav_inventory' },
        ]);

        inline_keyboard.push([
            { text: '🔄 Refresh Status', callback_data: 'nav_status' },
        ]);

        const webAppUrl = process.env.WEB_APP_URL;
        if (webAppUrl) {
            const separator = webAppUrl.includes('?') ? '&' : '?';
            inline_keyboard.push([
                { text: '📱 Byte Specification', web_app: { url: webAppUrl } },
                {
                    text: '⬆️ Upgrades',
                    web_app: { url: `${webAppUrl}${separator}view=upgrades` },
                },
            ]);
            inline_keyboard.push([
                {
                    text: '🏆 Achievements',
                    web_app: {
                        url: `${webAppUrl}${separator}view=achievements`,
                    },
                },
                {
                    text: '🧬 Talents',
                    web_app: { url: `${webAppUrl}${separator}view=talents` },
                },
            ]);
            inline_keyboard.push([
                {
                    text: '⚙️ Settings',
                    web_app: { url: `${webAppUrl}${separator}view=settings` },
                },
            ]);
        }

        const options = {
            parse_mode: 'Markdown',
        };
        if (inline_keyboard.length > 0) {
            options.reply_markup = { inline_keyboard };
        }
        return { text, options };
    }

    // Formats and constructs the player inventory view, passing it to the Pagination util
    getInventoryDisplay(player, page = 0) {
        const inventory = player.inventory;
        const buttons = [];

        for (const [itemId, amount] of Object.entries(inventory)) {
            const item = this.itemManager.getItem(itemId);
            const name = item ? item.shortname : itemId;
            buttons.push({
                text: `${name} (x${amount})`,
                callback_data: `item_info_${itemId}`,
            });
        }

        const inline_keyboard = Pagination.getKeyboard(buttons, {
            page: parseInt(page, 10),
            pageSize: 6,
            columns: 2,
            actionPrefix: 'inv_page',
        });

        inline_keyboard.push([
            { text: '🔙 Back to Status', callback_data: 'nav_status' },
        ]);

        let text = `🎒 **Your Inventory** 🎒\n\n`;
        text +=
            buttons.length === 0
                ? `_Your inventory is currently empty._`
                : `_Click an item to see its description._`;

        const options = { parse_mode: 'Markdown' };
        if (inline_keyboard.length > 0)
            options.reply_markup = { inline_keyboard };
        return { text, options };
    }

    // Formats and constructs the detailed item view
    getItemDetailDisplay(player, itemId) {
        const item = this.itemManager.getItem(itemId);
        const amount = player.inventory[itemId] || 0;
        let text = `🎒 **Item Details** 🎒\n\n`;
        text += `**${item.name}** (x${amount})\n_${item.description}_\n`;

        const inline_keyboard = [];
        if (item.type === 'consumable' && amount > 0) {
            inline_keyboard.push([
                {
                    text: `💊 Use ${item.shortname}`,
                    callback_data: `use_item_${itemId}`,
                },
            ]);
        }
        inline_keyboard.push([
            { text: '🔙 Back to Inventory', callback_data: 'nav_inventory' },
        ]);

        const options = {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard },
        };
        return { text, options };
    }

    // Formats and constructs the room navigation view
    getRoomsDisplay(byte, chatId, page = 0) {
        const rooms = this.roomManager.getAllRooms();
        const buttons = [];
        const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
        const isAdmin = adminIds.includes(chatId.toString());

        rooms.forEach((room) => {
            if (room.id === 'debug_room' && !isAdmin) return;
            buttons.push({
                text: room.name,
                callback_data: `nav_move_${room.id}`,
            });
        });

        const inline_keyboard = Pagination.getKeyboard(buttons, {
            page: parseInt(page, 10),
            pageSize: 10,
            columns: 2,
            actionPrefix: 'rooms_page',
        });

        inline_keyboard.push([
            { text: '🔙 Back to Status', callback_data: 'nav_status' },
        ]);

        let text = `🏠 **Available Rooms** 🏠\n\nSelect a room to move to:`;

        const options = { parse_mode: 'Markdown' };
        if (inline_keyboard.length > 0)
            options.reply_markup = { inline_keyboard };
        return { text, options };
    }

    // Renders the sub-menu when clicking an item required by an activity
    getActivityItemSelectDisplay(player, activity, page = 0) {
        const inventory = player.inventory;
        const buttons = [];

        for (const [itemId, amount] of Object.entries(inventory)) {
            if (amount <= 0) continue;
            const item = this.itemManager.getItem(itemId);
            if (!item) continue;

            // Verify that this specific item satisfies the activity's configured itemSelect requirement
            let isValid = false;
            if (
                activity.itemSelect.type &&
                item.type === activity.itemSelect.type
            )
                isValid = true;
            if (
                activity.itemSelect.ids &&
                activity.itemSelect.ids.includes(item.id)
            )
                isValid = true;

            if (isValid) {
                buttons.push({
                    text: `${item.shortname} (x${amount})`,
                    callback_data: `act_ex|${activity.id}|${itemId}`,
                });
            }
        }

        const inline_keyboard = Pagination.getKeyboard(buttons, {
            page: parseInt(page, 10),
            pageSize: 6,
            columns: 2,
            actionPrefix: `act_pg|${activity.id}`,
        });

        inline_keyboard.push([
            { text: '🔙 Cancel', callback_data: 'act_cancel' },
        ]);

        let text = `🎒 **Select an item for: ${activity.name}**\n\nChoose an item to use:`;

        const options = { parse_mode: 'Markdown' };
        if (inline_keyboard.length > 0)
            options.reply_markup = { inline_keyboard };
        return { text, options };
    }

    getByteSelectionDisplay(bytes, player) {
        const livingBytes = bytes.filter((b) => b.isAlive);
        let text = `💤 **Stasis Bay**\n\nYou have ${livingBytes.length}/${player.maxBytes || 2} Bytes.\nSelect a Byte to wake up and connect to:`;

        const inline_keyboard = [];

        for (const byte of livingBytes) {
            const status = byte.getStatus();
            const gen = status.generation;

            inline_keyboard.push([
                {
                    text: `⚡ Wake ${byte.name} (V${gen}.${byte.level})`,
                    callback_data: `wake_byte_${byte.id}`,
                },
            ]);

            text += `\n\n**${byte.name}** (V${gen}.${byte.level}) - Class: ${byte.byteClass}`;
        }

        text += `\n\n━━━━━━━━━━━━━━━━━━━━━\n⚡ **Player Energy:** ${player.energy.value}/${player.energy.maxValue} ε | 🪙 **Achievement Points:** ${player.achievementPoints.available}/${player.achievementPoints.value} α`;

        const bottomRow = [];
        const webAppUrl = process.env.WEB_APP_URL;
        if (livingBytes.length >= 2 && webAppUrl) {
            const separator = webAppUrl.includes('?') ? '&' : '?';
            bottomRow.push({
                text: '🧬 Merge Bytes',
                web_app: { url: `${webAppUrl}${separator}view=merge` },
            });
        }
        bottomRow.push({
            text: '🔄 Refresh Status',
            callback_data: 'nav_status',
        });
        inline_keyboard.push(bottomRow);

        const adminRow = [];
        if (livingBytes.length < (player.maxBytes || 2)) {
            adminRow.push({
                text: '🐣 Spawn New Byte',
                callback_data: 'nav_spawn',
            });
        }
        if (livingBytes.length > 0) {
            adminRow.push({
                text: '🗑️ Delete Byte',
                callback_data: 'nav_delete',
            });
        }
        if (adminRow.length > 0) {
            inline_keyboard.push(adminRow);
        }

        if (webAppUrl) {
            const separator = webAppUrl.includes('?') ? '&' : '?';
            inline_keyboard.push([
                {
                    text: '🏆 Achievements',
                    web_app: {
                        url: `${webAppUrl}${separator}view=achievements`,
                    },
                },
                {
                    text: '🧬 Talents',
                    web_app: { url: `${webAppUrl}${separator}view=talents` },
                },
            ]);
            inline_keyboard.push([
                {
                    text: '⚙️ Settings',
                    web_app: { url: `${webAppUrl}${separator}view=settings` },
                },
            ]);
        }

        const options = { parse_mode: 'Markdown' };
        if (inline_keyboard.length > 0) {
            options.reply_markup = { inline_keyboard };
        }
        return { text, options };
    }

    getDeleteSelectionDisplay(livingBytes) {
        let text = `🗑️ **Delete Byte**\n\nSelect a Byte to permanently delete:`;
        const inline_keyboard = [];

        for (const byte of livingBytes) {
            const gen = byte.generation || 0;
            inline_keyboard.push([
                {
                    text: `🗑️ Delete ${byte.name} (V${gen}.${byte.level})`,
                    callback_data: `delete_byte_${byte.id}`,
                },
            ]);
        }

        inline_keyboard.push([
            { text: '🔙 Cancel', callback_data: 'nav_status' },
        ]);

        const options = {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard },
        };
        return { text, options };
    }

    // Main entry point for user requesting to see their byte
    async handleStatus(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /status from chat ${chatId}`);
        const bytes = await this.game.getBytes(chatId);

        if (!bytes || bytes.length === 0) {
            return this.bot.sendMessage(
                chatId,
                "You don't have a byte yet. Use `/spawn [name]` first.",
            );
        }
        const player = await this.game.getPlayer(chatId);
        const activeByte = bytes.find((b) => !b.isAsleep && b.isAlive);

        if (!activeByte) {
            await this.sendStasisUI(chatId, bytes, player, msg.message_id);
            return;
        }

        await this.sendStatusUI(
            chatId,
            activeByte,
            player,
            null,
            msg.message_id,
        );
    }

    // Lists the possible rooms a byte can currently travel to
    async handleRooms(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /rooms from chat ${chatId}`);

        const byte = await this.game.getByte(chatId);
        if (!byte)
            return this.bot.sendMessage(chatId, "You don't have a byte!");

        const { text, options } = this.getRoomsDisplay(byte, chatId, 0);
        await this.sendOrUpdateUI(chatId, text, options, msg.message_id);
    }

    // Transitions a byte to a different map node/room
    async handleMove(msg, match) {
        const chatId = msg.chat.id;
        const newRoomId = match[1] ? match[1].trim() : null;
        console.log(
            `[Command] /move ${newRoomId || '(prompt)'} from chat ${chatId}`,
        );

        const byte = await this.game.getByte(chatId);
        if (!byte)
            return this.bot.sendMessage(chatId, "You don't have a byte!");

        const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
        const isAdmin = adminIds.includes(chatId.toString());

        // If the user didn't specify a room, prompt them with the inline keyboard
        if (!newRoomId) {
            const { text, options } = this.getRoomsDisplay(byte, chatId, 0);
            await this.sendOrUpdateUI(chatId, text, options, msg.message_id);
            return;
        }

        const room = this.roomManager.getRoom(newRoomId);
        if (!room || (room.id === 'debug_room' && !isAdmin)) {
            return this.bot.sendMessage(
                chatId,
                `Room '${newRoomId}' does not exist. Use /rooms to see available rooms.`,
            );
        }

        if (byte.room === newRoomId) {
            return this.bot.sendMessage(
                chatId,
                `${byte.name} is already in the ${room.name}.`,
            );
        }

        byte.room = newRoomId;
        await this.game.saveByte(byte);
        this.game.emit(GameEvents.ROOM_ENTERED, chatId, newRoomId);

        await this.bot.sendMessage(
            chatId,
            `${byte.name} moved to the **${room.name}**! 🚶`,
            { parse_mode: 'Markdown' },
        );
    }

    // Main entry point for rendering user's collected items
    async handleInventory(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /inventory from chat ${chatId}`);
        const player = await this.game.getPlayer(chatId);
        const { text, options } = this.getInventoryDisplay(player, 0);
        await this.sendOrUpdateUI(chatId, text, options, msg.message_id);
    }

    // Forces one or more global ticks for testing/mechanics
    async handleTick(msg, match) {
        const chatId = msg.chat.id;
        const ticks = match[1] ? parseInt(match[1], 10) : 1;
        console.log(`[Command] /tick ${ticks} from chat ${chatId}`);

        // Fetch the singleton EventManager dynamically here since it wasn't natively injected
        const eventManager = require('../managers/EventManager');

        for (let i = 0; i < ticks; i++) {
            await this.game.processTick(eventManager, this.itemManager);
        }

        const byte = await this.game.getByte(chatId);
        if (byte) {
            const player = await this.game.getPlayer(chatId);
            await this.sendStatusUI(
                chatId,
                byte,
                player,
                `Fast-forwarded ${ticks} tick(s)!`,
                msg.message_id,
            );
        } else {
            await this.bot.sendMessage(
                chatId,
                `Fast-forwarded ${ticks} tick(s)!`,
            );
        }
    }

    // Previews the avatar image at a specific level
    async handleAvatar(msg, match) {
        const chatId = msg.chat.id;
        const byte = await this.game.getByte(chatId);

        if (!byte) {
            return this.bot.sendMessage(
                chatId,
                "You don't have a byte yet. Use `/spawn [name]` first.",
            );
        }

        const level1 = match[1] ? parseInt(match[1], 10) : byte.level;
        const level2 = match[2] ? parseInt(match[2], 10) : null;

        try {
            const { generateClassBasedAvatar } = require('../util/avatar');

            if (level2 !== null) {
                let startLevel = Math.min(level1, level2);
                let endLevel = Math.max(level1, level2);

                // Cap the range to 10 to avoid hitting Telegram API limits or lagging the server
                if (endLevel - startLevel > 9) {
                    endLevel = startLevel + 9;
                    await this.bot.sendMessage(
                        chatId,
                        '⚠️ Range too large. Limiting to 10 avatars.',
                    );
                }

                console.log(
                    `[Command] /avatar ${startLevel}-${endLevel} from chat ${chatId}`,
                );
                const mediaGroup = [];

                for (let lvl = startLevel; lvl <= endLevel; lvl++) {
                    const svgString = generateClassBasedAvatar(
                        byte.name,
                        byte.byteClass,
                        lvl,
                        byte.generation,
                    );
                    const pngBuffer = await sharp(Buffer.from(svgString))
                        .png()
                        .toBuffer();

                    mediaGroup.push({
                        type: 'photo',
                        media: pngBuffer,
                        caption: `📸 **${byte.name}** at Level ${lvl}`,
                        parse_mode: 'Markdown',
                    });
                }

                await this.bot.sendMediaGroup(chatId, mediaGroup);
            } else {
                console.log(`[Command] /avatar ${level1} from chat ${chatId}`);
                const svgString = generateClassBasedAvatar(
                    byte.name,
                    byte.byteClass,
                    level1,
                    byte.generation,
                );
                const pngBuffer = await sharp(Buffer.from(svgString))
                    .png()
                    .toBuffer();

                await this.bot.sendPhoto(chatId, pngBuffer, {
                    caption: `📸 **${byte.name}** at Level ${level1}`,
                    parse_mode: 'Markdown',
                });
            }
        } catch (error) {
            console.error('Failed to generate avatar:', error);
            await this.bot.sendMessage(
                chatId,
                'Failed to generate the avatar image(s).',
            );
        }
    }

    // The primary router handling dynamic UI button presses
    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const action = query.data;

        this.game.recordPlayerActivity(chatId).catch(console.error);

        console.log(`[Callback] Action '${action}' from chat ${chatId}`);

        const byte = await this.game.getByte(chatId);
        const player = await this.game.getPlayer(chatId);
        let alertMessage = '';
        let showAlert = false;

        try {
            const isStasisAction =
                action.startsWith('wake_byte_') ||
                action === 'nav_status' ||
                action === 'act_cancel' ||
                action === 'nav_spawn' ||
                action.startsWith('spawn_class_') ||
                action === 'nav_delete' ||
                action.startsWith('delete_byte_');

            if (!byte && !isStasisAction) {
                const bytes = await this.game.getBytes(chatId);
                if (bytes.length > 0) {
                    await this.sendStasisUI(chatId, bytes, player);
                } else {
                    alertMessage = "You don't have a byte!";
                }
                return;
            }

            // Ignore clicks on the page number indicator
            if (action === 'ignore_pagination') {
                return;
            }

            // Gracefully ignore requests to back out of an action selector
            if (action === 'act_cancel' || action === 'nav_status') {
                this.userStates.delete(chatId);
                if (byte) {
                    await this.sendStatusUI(chatId, byte, player);
                } else {
                    const bytes = await this.game.getBytes(chatId);
                    await this.sendStasisUI(chatId, bytes, player);
                }
                return;
            } else if (action === 'nav_spawn') {
                const allBytes = await this.game.getBytes(chatId);
                const livingBytes = allBytes.filter((b) => b.isAlive);
                const maxBytes = player.maxBytes || 2;
                if (livingBytes.length >= maxBytes) {
                    alertMessage = `You already have the maximum number of living bytes (${maxBytes})!`;
                } else {
                    this.userStates.set(chatId, {
                        state: 'AWAITING_BYTE_NAME',
                    });
                    await this.bot.sendMessage(
                        chatId,
                        'What would you like to name your new byte?',
                    );
                }
                return;
            } else if (action.startsWith('spawn_class_')) {
                const classId = action.replace('spawn_class_', '');
                const userState = this.userStates.get(chatId);
                
                if (userState && userState.state === 'AWAITING_BYTE_CLASS') {
                    this.userStates.delete(chatId);
                    await this.processSpawn(chatId, userState.byteName, classId);
                } else {
                    alertMessage = 'Spawn session expired or invalid.';
                }
                return;
            } else if (action === 'nav_delete') {
                this.userStates.delete(chatId);
                const allBytes = await this.game.getBytes(chatId);
                const livingBytes = allBytes.filter((b) => b.isAlive);
                if (livingBytes.length === 0) {
                    alertMessage = 'No bytes to delete.';
                } else {
                    const { text, options } =
                        this.getDeleteSelectionDisplay(livingBytes);
                    await this.updateMessageDisplay(query, text, options);
                }
                return;
            } else if (action.startsWith('delete_byte_')) {
                const byteId = action.replace('delete_byte_', '');
                const allBytes = await this.game.getBytes(chatId);
                const targetByte = allBytes.find((b) => b.id === byteId);

                if (!targetByte) {
                    alertMessage = 'Byte not found.';
                } else {
                    const timeoutId = setTimeout(async () => {
                        const state = this.userStates.get(chatId);
                        if (
                            state &&
                            state.state === 'AWAITING_DELETE_CONFIRM' &&
                            state.byteId === byteId
                        ) {
                            this.userStates.delete(chatId);
                            await this.bot.sendMessage(
                                chatId,
                                `Deletion of **${targetByte.name}** timed out.`,
                                { parse_mode: 'Markdown' },
                            );
                        }
                    }, 30000);

                    this.userStates.set(chatId, {
                        state: 'AWAITING_DELETE_CONFIRM',
                        byteId: byteId,
                        timeoutId: timeoutId,
                    });

                    await this.bot.sendMessage(
                        chatId,
                        `⚠️ Are you sure you want to permanently delete **${targetByte.name}**?\n\nType \`YES\` to confirm. Any other input will cancel this action. (Times out in 30 seconds)`,
                        { parse_mode: 'Markdown' },
                    );
                }
                return;
            } else if (action.startsWith('wake_byte_')) {
                const byteIdToWake = action.replace('wake_byte_', '');
                const allBytes = await this.game.getBytes(chatId);
                const byteToWake = allBytes.find((b) => b.id === byteIdToWake);

                if (byteToWake) {
                    for (const b of allBytes) {
                        if (b.id !== byteToWake.id && !b.isAsleep) {
                            b.isAsleep = true;
                            await this.game.saveByte(b);
                        }
                    }
                    byteToWake.isAsleep = false;
                    await this.game.saveByte(byteToWake);

                    await this.sendStatusUI(
                        chatId,
                        byteToWake,
                        player,
                        `Woke up ${byteToWake.name}!`,
                    );
                } else {
                    alertMessage = 'Byte not found.';
                }
            } else if (action === 'nav_inventory') {
                const { text, options } = this.getInventoryDisplay(player, 0);
                await this.updateMessageDisplay(query, text, options);
            } else if (action === 'nav_rooms') {
                const { text, options } = this.getRoomsDisplay(byte, chatId, 0);
                await this.updateMessageDisplay(query, text, options);
            } else if (action.startsWith('rooms_page_')) {
                const page = parseInt(action.replace('rooms_page_', ''), 10);
                const { text, options } = this.getRoomsDisplay(byte, chatId, page);
                await this.updateMessageDisplay(query, text, options);
            } else if (action.startsWith('nav_move_')) {
                const newRoomId = action.replace('nav_move_', '');
                const room = this.roomManager.getRoom(newRoomId);
                const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
                const isAdmin = adminIds.includes(chatId.toString());

                let statusMessage = '';
                if (room && (room.id !== 'debug_room' || isAdmin)) {
                    if (byte.room !== newRoomId) {
                        byte.room = newRoomId;
                        await this.game.saveByte(byte);
                        statusMessage = `Moved to the ${room.name}! 🚶`;
                        this.game.emit(
                            GameEvents.ROOM_ENTERED,
                            chatId,
                            newRoomId,
                        );
                    } else {
                        statusMessage = `You look around the ${room.name}. 👀`;
                    }
                } else {
                    alertMessage = 'Room not found!';
                }
                if (room && (room.id !== 'debug_room' || isAdmin)) {
                    await this.sendStatusUI(chatId, byte, player, statusMessage);
                }
            } else if (action.startsWith('act_pg|')) {
                const payload = action.replace('act_pg|', '');
                const lastUnderscore = payload.lastIndexOf('_');
                const actId = payload.slice(0, lastUnderscore);
                const page = parseInt(payload.slice(lastUnderscore + 1), 10);

                const activity = this.activityManager.getActivity(actId);
                if (activity) {
                    const { text, options } = this.getActivityItemSelectDisplay(
                        player,
                        activity,
                        page,
                    );
                    await this.updateMessageDisplay(query, text, options);
                    return;
                }
            } else if (action.startsWith('act_ex|')) {
                const [actId, itemId] = action
                    .replace('act_ex|', '')
                    .split('|');
                const activity = this.activityManager.getActivity(actId);
                let statusMessage = '';

                if (!activity) {
                    alertMessage = 'Activity not found!';
                } else if (
                    !activity.canPerform(byte, player, this.itemManager)
                ) {
                    alertMessage = `${byte.name} isn't able to do that right now.`;
                } else {
                    const item = this.itemManager.getItem(itemId);
                    if (!item || !player.hasItem(itemId, 1)) {
                        alertMessage = "You don't have that item.";
                    } else {
                        activity.perform(
                            byte,
                            player,
                            this.itemManager,
                            itemId,
                        );
                        await this.game.saveByte(byte);
                        await this.game.savePlayer(player);
                        statusMessage = `Performed ${activity.name} with ${item.shortname}!`;
                    }
                }

                await this.sendStatusUI(chatId, byte, player, statusMessage);
            } else if (action.startsWith('act_')) {
                const actId = action.replace('act_', '');
                const room = this.roomManager.getRoom(byte.room);
                let statusMessage = '';

                if (!room || !room.allowedActivities.includes(actId)) {
                    alertMessage =
                        'You must be in the correct room to do that!';
                } else {
                    const activity = this.activityManager.getActivity(actId);
                    if (!activity) {
                        alertMessage = 'Activity not found!';
                    } else if (
                        !activity.canPerform(byte, player, this.itemManager)
                    ) {
                        alertMessage = `${byte.name} isn't able to do that right now.`;
                    } else if (activity.itemSelect) {
                        const { text, options } =
                            this.getActivityItemSelectDisplay(
                                player,
                                activity,
                                0,
                            );
                        await this.updateMessageDisplay(query, text, options);
                        return; // Stop here, wait for item selection
                    } else if (activity.isMinigame) {
                        const minigame = minigameManager.getMinigame(actId);
                        if (minigame) {
                            const result = await minigame.start(chatId, this.game, byte, player, this.itemManager, activity);
                            if (result.error) {
                                alertMessage = result.error;
                            } else {
                                this.userStates.set(chatId, result.state);
                                await this.sendOrUpdateUI(chatId, result.display.text, result.display.options);
                            }
                        } else {
                            alertMessage = 'Minigame not found!';
                        }
                        return;
                    } else {
                        activity.perform(byte, player, this.itemManager);
                        await this.game.saveByte(byte);
                        await this.game.savePlayer(player);
                        statusMessage = `Performed ${activity.name}!`;

                        if (byte.isAsleep) {
                            const bytes = await this.game.getBytes(chatId);
                            await this.sendStasisUI(chatId, bytes, player);
                            return;
                        }
                    }
                }

                // Re-render status block when action occurs
                await this.sendStatusUI(chatId, byte, player, statusMessage);
            } else if (action.startsWith('inv_page_')) {
                const page = parseInt(action.replace('inv_page_', ''), 10);
                const { text, options } = this.getInventoryDisplay(
                    player,
                    page,
                );
                await this.updateMessageDisplay(query, text, options);
            } else if (action.startsWith('item_info_')) {
                const itemId = action.replace('item_info_', '');
                const item = this.itemManager.getItem(itemId);
                if (item) {
                    const { text, options } = this.getItemDetailDisplay(
                        player,
                        itemId,
                    );
                    await this.updateMessageDisplay(query, text, options);
                    return;
                } else {
                    alertMessage = 'Item not found.';
                }
            } else if (action.startsWith('use_item_')) {
                const itemId = action.replace('use_item_', '');
                const item = this.itemManager.getItem(itemId);

                if (!item || !player.hasItem(itemId, 1)) {
                    alertMessage = "You don't have that item.";
                } else {
                    const success = item.use(byte, player);
                    if (success) {
                        player.removeItem(itemId, 1);
                        await this.game.saveByte(byte);
                        await this.game.savePlayer(player);
                        await this.sendStatusUI(
                            chatId,
                            byte,
                            player,
                            `Used ${item.name}!`,
                        );
                        return;
                    } else {
                        alertMessage = `Cannot use ${item.name} right now.`;
                    }
                }
                } else if (action.startsWith('minigame_')) {
                    const userState = this.userStates.get(chatId);
                    
                    if (!userState || !userState.state.startsWith('MINIGAME_')) {
                        alertMessage = 'No active minigame session.';
                        return;
                    }
                    const minigameId = userState.state.replace('MINIGAME_', '');
                    const minigame = minigameManager.getMinigame(minigameId);
        
                    const cmd = action.replace(`minigame_${minigameId}_`, '');
                    if (cmd === 'abort') {
                        const guessesRemaining = userState.history ? 6 - userState.history.length : 6;
                        this.game.emit(GameEvents.MINIGAME_END, chatId, minigameId, { result: 'abort', guessesRemaining });

                        this.userStates.delete(chatId);
                        if (byte) {
                            await this.sendStatusUI(chatId, byte, player, "Minigame aborted.");
                        } else {
                            const bytes = await this.game.getBytes(chatId);
                            await this.sendStasisUI(chatId, bytes, player);
                        }
                        return;
                    }
                    
                    if (minigame) {
                        const display = await minigame.handleInput(cmd, userState, this.game, chatId, byte, player, this.itemManager);
                        if (display) {
                            if (display.alert) {
                                alertMessage = display.alert;
                                showAlert = true;
                            } else {
                                await this.updateMessageDisplay(query, display.text, display.options);
                            }
                        }
                    }
                    return;
            }
        } finally {
            await this.bot.answerCallbackQuery(query.id, {
                text: alertMessage,
                show_alert: showAlert
            });
        }
    }
}

module.exports = TelegramBotController;
