const Pagination = require('./Pagination');
const sharp = require('sharp');
const generateTradingCard = require('../util/card');
const dbManager = require('../database/db');
const { calculateEffects } = require('../util/effects');

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
    }

    init() {
        // Register UI auto-complete commands with the Telegram Client
        this.bot.setMyCommands([
            { command: '/start', description: 'Welcome to Telegram-gotchi!' },
            {
                command: '/adopt',
                description: 'Adopt a new byte (usage: /adopt name)',
            },
            {
                command: '/status',
                description: "View your byte's status and activities",
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
                description: 'Preview avatar at level(s) (usage: /avatar [level] [maxLevel])',
            },
        ]);

        // Map message commands
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.onText(/\/adopt(?:\s+(.+))?/, this.handleAdopt.bind(this));
        this.bot.onText(/\/status/, this.handleStatus.bind(this));
        this.bot.onText(/\/rooms/, this.handleRooms.bind(this));
        this.bot.onText(/\/move(?:\s+(.+))?/, this.handleMove.bind(this));
        this.bot.onText(/\/inventory/, this.handleInventory.bind(this));
        this.bot.onText(/\/tick(?:\s+(\d+))?/, this.handleTick.bind(this));
        this.bot.onText(/\/avatar(?:\s+(\d+))?(?:\s+(\d+))?/, this.handleAvatar.bind(this));

        // Intercept inline button clicks
        this.bot.on('callback_query', this.handleCallbackQuery.bind(this));

        // Intercept general messages for state machine
        this.bot.on('message', this.handleMessage.bind(this));
    }

    // Welcome response handler
    async handleStart(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /start from chat ${chatId}`);
        await this.bot.sendMessage(
            chatId,
            'Welcome to Tele-grow! Use `/adopt [name]` to get your first byte.',
        );
    }

    // Spawns a new byte and commits it to the database
    async handleAdopt(msg, match) {
        const chatId = msg.chat.id;
        const byteName = match[1];

        // Check if they already have a byte before proceeding
        const existingByte = await this.game.getByte(chatId);
        if (existingByte && existingByte.isAlive) {
            await this.bot.sendMessage(
                chatId,
                'You already have a living byte!',
            );
            return;
        }

        if (!byteName) {
            console.log(
                `[Command] /adopt (prompting for name) from chat ${chatId}`,
            );
            this.userStates.set(chatId, { state: 'AWAITING_BYTE_NAME' });
            await this.bot.sendMessage(
                chatId,
                'What would you like to name your new byte?',
            );
            return;
        }

        console.log(`[Command] /adopt ${byteName} from chat ${chatId}`);
        await this.processAdoption(chatId, byteName.trim());
    }

    // Handles user state machine for multi-step interactions
    async handleMessage(msg) {
        if (!msg.text) return;
        const chatId = msg.chat.id;

        // If it's a command, clear any pending state and let the command handler take over
        if (msg.text.startsWith('/')) {
            this.userStates.delete(chatId);
            return;
        }

        const userState = this.userStates.get(chatId);
        if (userState) {
            if (userState.state === 'AWAITING_BYTE_NAME') {
                this.userStates.delete(chatId);
                console.log(
                    `[State] Received byte name '${msg.text}' from chat ${chatId}`,
                );
                await this.processAdoption(chatId, msg.text.trim());
            }
        }
    }

    async processAdoption(chatId, byteName) {
        try {
            await this.game.createByte(chatId, byteName);
            await this.bot.sendMessage(
                chatId,
                `Congratulations! You adopted ${byteName}. Use /status to check on them.`,
            );
        } catch (error) {
            await this.bot.sendMessage(
                chatId,
                'You already have a living byte!',
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

        const isDormant = status.charge === 0 || status.thermal === 0 || status.defrag === 0 || status.telemetry === 0;
        if (isDormant) {
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

        text += `━━━━━━━━━━━━━━━━━━━━━\n⚡ **Player Energy:** ${player.energy.value}/${player.energy.maxValue}\n🎒 **Inventory:** ${invString}`;

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

        const webAppUrl = process.env.WEB_APP_URL;
        if (webAppUrl) {
            const separator = webAppUrl.includes('?') ? '&' : '?';
            inline_keyboard.push([
                { text: '📱 Byte Specification', web_app: { url: webAppUrl } },
                { text: '⬆️ Upgrades', web_app: { url: `${webAppUrl}${separator}view=upgrades` } },
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

    // Formats and constructs the room navigation view
    getRoomsDisplay(byte, page = 0) {
        const rooms = this.roomManager.getAllRooms();
        const buttons = [];

        rooms.forEach((room) => {
            if (room.id !== byte.room) {
                buttons.push({
                    text: room.name,
                    callback_data: `nav_move_${room.id}`,
                });
            }
        });

        const inline_keyboard = Pagination.getKeyboard(buttons, {
            page: parseInt(page, 10),
            pageSize: 9,
            columns: 3,
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

    // Main entry point for user requesting to see their byte
    async handleStatus(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /status from chat ${chatId}`);
        const byte = await this.game.getByte(chatId);

        if (!byte) {
            return this.bot.sendMessage(
                chatId,
                "You don't have a byte yet. Use `/adopt [name]` first.",
            );
        }
        const player = await this.game.getPlayer(chatId);

        await this.sendStatusUI(chatId, byte, player, null, msg.message_id);
    }

    // Lists the possible rooms a byte can currently travel to
    async handleRooms(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /rooms from chat ${chatId}`);

        const byte = await this.game.getByte(chatId);
        if (!byte)
            return this.bot.sendMessage(chatId, "You don't have a byte!");

        const { text, options } = this.getRoomsDisplay(byte, 0);
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

        // If the user didn't specify a room, prompt them with the inline keyboard
        if (!newRoomId) {
            const { text, options } = this.getRoomsDisplay(byte, 0);
            await this.sendOrUpdateUI(chatId, text, options, msg.message_id);
            return;
        }

        const room = this.roomManager.getRoom(newRoomId);
        if (!room) {
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
            await this.game.processTick(
                eventManager,
                this.itemManager,
                (b, e) => {
                    this.bot
                        .sendMessage(
                            b.ownerId,
                            `🔔 **Random Event:** ${e.name}\n_${e.description}_`,
                            { parse_mode: 'Markdown' },
                        )
                        .catch(() => {
                            // Ignore send failures from forced ticks
                        });
                },
            );
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
                "You don't have a byte yet. Use `/adopt [name]` first."
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
                    await this.bot.sendMessage(chatId, "⚠️ Range too large. Limiting to 10 avatars.");
                }

                console.log(`[Command] /avatar ${startLevel}-${endLevel} from chat ${chatId}`);
                const mediaGroup = [];

                for (let lvl = startLevel; lvl <= endLevel; lvl++) {
                    const svgString = generateClassBasedAvatar(byte.name, byte.byteClass, lvl);
                    const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
                    
                    mediaGroup.push({
                        type: 'photo',
                        media: pngBuffer,
                        caption: `📸 **${byte.name}** at Level ${lvl}`,
                        parse_mode: 'Markdown'
                    });
                }
                
                await this.bot.sendMediaGroup(chatId, mediaGroup);
            } else {
                console.log(`[Command] /avatar ${level1} from chat ${chatId}`);
                const svgString = generateClassBasedAvatar(byte.name, byte.byteClass, level1);
                const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();

                await this.bot.sendPhoto(chatId, pngBuffer, {
                    caption: `📸 **${byte.name}** at Level ${level1}`,
                    parse_mode: 'Markdown',
                });
            }
        } catch (error) {
            console.error('Failed to generate avatar:', error);
            await this.bot.sendMessage(chatId, 'Failed to generate the avatar image(s).');
        }
    }

    // The primary router handling dynamic UI button presses
    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const action = query.data;

        console.log(`[Callback] Action '${action}' from chat ${chatId}`);

        const byte = await this.game.getByte(chatId);
        const player = await this.game.getPlayer(chatId);
        let alertMessage = '';

        try {
            if (!byte) {
                alertMessage = "You don't have a byte!";
                return;
            }

            // Ignore clicks on the page number indicator
            if (action === 'ignore_pagination') {
                return;
            }

            // Gracefully ignore requests to back out of an action selector
            if (action === 'act_cancel') {
                await this.sendStatusUI(chatId, byte, player);
            } else if (action === 'nav_status') {
                await this.sendStatusUI(chatId, byte, player);
            } else if (action === 'nav_inventory') {
                const { text, options } = this.getInventoryDisplay(player, 0);
                await this.updateMessageDisplay(query, text, options);
            } else if (action === 'nav_rooms') {
                const { text, options } = this.getRoomsDisplay(byte, 0);
                await this.updateMessageDisplay(query, text, options);
            } else if (action.startsWith('rooms_page_')) {
                const page = parseInt(action.replace('rooms_page_', ''), 10);
                const { text, options } = this.getRoomsDisplay(byte, page);
                await this.updateMessageDisplay(query, text, options);
            } else if (action.startsWith('nav_move_')) {
                const newRoomId = action.replace('nav_move_', '');
                const room = this.roomManager.getRoom(newRoomId);
                let statusMessage = '';
                if (room) {
                    byte.room = newRoomId;
                    await this.game.saveByte(byte);
                    statusMessage = `Moved to the ${room.name}! 🚶`;
                } else {
                    alertMessage = 'Room not found!';
                }
                await this.sendStatusUI(chatId, byte, player, statusMessage);
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
                    } else {
                        activity.perform(byte, player, this.itemManager);
                        await this.game.saveByte(byte);
                        await this.game.savePlayer(player);
                        statusMessage = `Performed ${activity.name}!`;
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
                alertMessage = item
                    ? `${item.name}: ${item.description}`
                    : 'Item not found.';
            }
        } finally {
            await this.bot.answerCallbackQuery(query.id, {
                text: alertMessage,
            });
        }
    }
}

module.exports = TelegramBotController;
