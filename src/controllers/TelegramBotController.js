const Pagination = require('./Pagination');

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
                description: 'Adopt a new pet (usage: /adopt name)',
            },
            {
                command: '/status',
                description: "View your pet's status and activities",
            },
            { command: '/rooms', description: 'View all available rooms' },
            {
                command: '/move',
                description: 'Move to a different room (usage: /move room_id)',
            },
            { command: '/inventory', description: 'View your items' },
        ]);

        // Map message commands
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.onText(/\/adopt(?:\s+(.+))?/, this.handleAdopt.bind(this));
        this.bot.onText(/\/status/, this.handleStatus.bind(this));
        this.bot.onText(/\/rooms/, this.handleRooms.bind(this));
        this.bot.onText(/\/move(?:\s+(.+))?/, this.handleMove.bind(this));
        this.bot.onText(/\/inventory/, this.handleInventory.bind(this));
        
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
            'Welcome to Telegram-gotchi! Use `/adopt [name]` to get your first pet.',
        );
    }

    // Spawns a new pet and commits it to the database
    async handleAdopt(msg, match) {
        const chatId = msg.chat.id;
        const petName = match[1];

        // Check if they already have a pet before proceeding
        const existingPet = await this.game.getPet(chatId);
        if (existingPet) {
            await this.bot.sendMessage(chatId, 'You already have a pet!');
            return;
        }

        if (!petName) {
            console.log(`[Command] /adopt (prompting for name) from chat ${chatId}`);
            this.userStates.set(chatId, { state: 'AWAITING_PET_NAME' });
            await this.bot.sendMessage(chatId, 'What would you like to name your new pet?');
            return;
        }

        console.log(`[Command] /adopt ${petName} from chat ${chatId}`);
        await this.processAdoption(chatId, petName.trim());
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
            if (userState.state === 'AWAITING_PET_NAME') {
                this.userStates.delete(chatId);
                console.log(`[State] Received pet name '${msg.text}' from chat ${chatId}`);
                await this.processAdoption(chatId, msg.text.trim());
            }
        }
    }

    async processAdoption(chatId, petName) {
        try {
            await this.game.createPet(chatId, petName);
            await this.bot.sendMessage(
                chatId,
                `Congratulations! You adopted ${petName}. Use /status to check on them.`,
            );
        } catch (error) {
            await this.bot.sendMessage(chatId, 'You already have a pet!');
        }
    }

    // Formats and constructs the main Telegram message displaying pet status
    getPetStatusDisplay(pet, player, lastActionMessage = null) {
        const status = pet.getStatus();
        if (!status.isAlive) {
            return {
                text: `💀 ${status.name} has passed away due to neglect.`,
                options: {},
            };
        }

        const room = this.roomManager.getRoom(status.room);
        const roomName = room ? room.name : status.room.replace(/_/g, '\\_');
        const roomDesc = room ? room.description : 'Unknown location';

        const invEntries = Object.entries(player.inventory).map(([id, amt]) => {
            const item = this.itemManager.getItem(id);
            const name = item ? item.shortname : id.replace(/_/g, '\\_');
            return `${name}: ${amt}`;
        });
        const invString =
            invEntries.length > 0 ? invEntries.join(', ') : 'Empty';

        let text = `
🐾 **${status.name}'s Status** 🐾
🍗 Hunger: ${status.hunger}/100
💧 Thirst: ${status.thirst}/100
🧩 Enrichment: ${status.enrichment}/100
🎮 Stimulation: ${status.stimulation}/100
⚡ Exertion: ${status.exertion}/100
💤 Energy: ${status.energy}/100
━━━━━━━━━━━━━━━━━━━━━
🏠 Room: ${roomName}
_${roomDesc}_
━━━━━━━━━━━━━━━━━━━━━
💪 **Core Stats:** Str: ${status.stats.strength} | Con: ${status.stats.constitution} | Dex: ${status.stats.dexterity} | Agi: ${status.stats.agility} | Foc: ${status.stats.focus} | Wil: ${status.stats.willpower} | Ins: ${status.stats.instinct} | Apt: ${status.stats.aptitude}
❤️ **Pools:** LP: ${status.pools.lifepoints} | MP: ${status.pools.mana} | Ki: ${status.pools.ki} | Pot: ${status.pools.potential}
📚 **Knowledge:** XP: ${status.pools.xp}
🎒 **Inventory:** ${invString}
    `;

        if (lastActionMessage) {
            text += `\n📢 **Last Action:** ${lastActionMessage}`;
        }

        const inline_keyboard = [];

        // Build inline action buttons depending on what activities are available in the current room
        if (room && room.allowedActivities) {
            const buttons = [];
            for (const actId of room.allowedActivities) {
                const activity = this.activityManager.getActivity(actId);
                if (activity) {
                    buttons.push({
                        text: activity.name,
                        callback_data: `act_${activity.id}`,
                    });
                }
            }
            for (let i = 0; i < buttons.length; i += 2) {
                inline_keyboard.push(buttons.slice(i, i + 2));
            }
        }

        inline_keyboard.push([
            { text: '🚶 Move Rooms', callback_data: 'nav_rooms' },
            { text: '🎒 Inventory', callback_data: 'nav_inventory' }
        ]);

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
    getRoomsDisplay(pet, page = 0) {
        const rooms = this.roomManager.getAllRooms();
        const buttons = [];

        rooms.forEach((room) => {
            if (room.id !== pet.room) {
                buttons.push({
                    text: room.name,
                    callback_data: `nav_move_${room.id}`,
                });
            }
        });

        const inline_keyboard = Pagination.getKeyboard(buttons, {
            page: parseInt(page, 10),
            pageSize: 5,
            columns: 1,
            actionPrefix: 'rooms_page',
        });

        inline_keyboard.push([{ text: '🔙 Back to Status', callback_data: 'nav_status' }]);

        let text = `🏠 **Available Rooms** 🏠\n\nSelect a room to move to:`;

        const options = { parse_mode: 'Markdown' };
        if (inline_keyboard.length > 0) options.reply_markup = { inline_keyboard };
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

    // Main entry point for user requesting to see their pet
    async handleStatus(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /status from chat ${chatId}`);
        const pet = await this.game.getPet(chatId);

        if (!pet) {
            return this.bot.sendMessage(
                chatId,
                "You don't have a pet yet. Use `/adopt [name]` first.",
            );
        }
        const player = await this.game.getPlayer(chatId);

        const { text, options } = this.getPetStatusDisplay(pet, player);
        await this.bot.sendMessage(chatId, text, options);
    }

    // Lists the possible rooms a pet can currently travel to
    async handleRooms(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /rooms from chat ${chatId}`);

        const pet = await this.game.getPet(chatId);
        if (!pet) return this.bot.sendMessage(chatId, "You don't have a pet!");

        const { text, options } = this.getRoomsDisplay(pet, 0);
        await this.bot.sendMessage(chatId, text, options);
    }

    // Transitions a pet to a different map node/room
    async handleMove(msg, match) {
        const chatId = msg.chat.id;
        const newRoomId = match[1] ? match[1].trim() : null;
        console.log(`[Command] /move ${newRoomId || '(prompt)'} from chat ${chatId}`);

        const pet = await this.game.getPet(chatId);
        if (!pet) return this.bot.sendMessage(chatId, "You don't have a pet!");

        // If the user didn't specify a room, prompt them with the inline keyboard
        if (!newRoomId) {
            const { text, options } = this.getRoomsDisplay(pet, 0);
            await this.bot.sendMessage(chatId, text, options);
            return;
        }

        const room = this.roomManager.getRoom(newRoomId);
        if (!room) {
            return this.bot.sendMessage(
                chatId,
                `Room '${newRoomId}' does not exist. Use /rooms to see available rooms.`,
            );
        }

        if (pet.room === newRoomId) {
            return this.bot.sendMessage(
                chatId,
                `${pet.name} is already in the ${room.name}.`,
            );
        }

        pet.room = newRoomId;
        await this.game.savePet(pet);

        await this.bot.sendMessage(
            chatId,
            `${pet.name} moved to the **${room.name}**! 🚶`,
            { parse_mode: 'Markdown' },
        );
    }

    // Main entry point for rendering user's collected items
    async handleInventory(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /inventory from chat ${chatId}`);
        const player = await this.game.getPlayer(chatId);
        const { text, options } = this.getInventoryDisplay(player, 0);
        await this.bot.sendMessage(chatId, text, options);
    }

    // The primary router handling dynamic UI button presses
    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const action = query.data;

        console.log(`[Callback] Action '${action}' from chat ${chatId}`);

        const pet = await this.game.getPet(chatId);
        const player = await this.game.getPlayer(chatId);
        let alertMessage = '';

        try {
            if (!pet) {
                alertMessage = "You don't have a pet!";
                return;
            }

            // Ignore clicks on the page number indicator
            if (action === 'ignore_pagination') {
                return;
            }

            // Gracefully ignore requests to back out of an action selector
            if (action === 'act_cancel') {
                const { text, options } = this.getPetStatusDisplay(pet, player);
                options.chat_id = chatId;
                options.message_id = messageId;
                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified'))
                        console.error(err);
                }
            // Navigation Actions
            } else if (action === 'nav_status') {
                const { text, options } = this.getPetStatusDisplay(pet, player);
                options.chat_id = chatId;
                options.message_id = messageId;
                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified')) console.error(err);
                }
            } else if (action === 'nav_inventory') {
                const { text, options } = this.getInventoryDisplay(player, 0);
                options.chat_id = chatId;
                options.message_id = messageId;
                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified')) console.error(err);
                }
            } else if (action === 'nav_rooms') {
                const { text, options } = this.getRoomsDisplay(pet, 0);
                options.chat_id = chatId;
                options.message_id = messageId;
                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified')) console.error(err);
                }
            } else if (action.startsWith('rooms_page_')) {
                const page = parseInt(action.replace('rooms_page_', ''), 10);
                const { text, options } = this.getRoomsDisplay(pet, page);
                options.chat_id = chatId;
                options.message_id = messageId;
                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified')) console.error(err);
                }
            } else if (action.startsWith('nav_move_')) {
                const newRoomId = action.replace('nav_move_', '');
                const room = this.roomManager.getRoom(newRoomId);
                let statusMessage = '';
                if (room) {
                    pet.room = newRoomId;
                    await this.game.savePet(pet);
                    statusMessage = `Moved to the ${room.name}! 🚶`;
                } else {
                    alertMessage = 'Room not found!';
                }
                const { text, options } = this.getPetStatusDisplay(pet, player, statusMessage);
                options.chat_id = chatId;
                options.message_id = messageId;
                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified')) console.error(err);
                }
            // Handles paging through available items to pick for an activity
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
                    options.chat_id = chatId;
                    options.message_id = messageId;
                    try {
                        await this.bot.editMessageText(text, options);
                    } catch (err) {}
                    return;
                }
            // Executes the activity using the selected item
            } else if (action.startsWith('act_ex|')) {
                const [actId, itemId] = action
                    .replace('act_ex|', '')
                    .split('|');
                const activity = this.activityManager.getActivity(actId);
                let statusMessage = '';

                if (!activity) {
                    alertMessage = 'Activity not found!';
                } else if (
                    !activity.canPerform(pet, player, this.itemManager)
                ) {
                    alertMessage = `${pet.name} isn't able to do that right now.`;
                } else {
                    const item = this.itemManager.getItem(itemId);
                    if (!item || !player.hasItem(itemId, 1)) {
                        alertMessage = "You don't have that item.";
                    } else {
                        activity.perform(pet, player, this.itemManager, itemId);
                        await this.game.savePet(pet);
                        await this.game.savePlayer(player);
                        statusMessage = `Performed ${activity.name} with ${item.shortname}!`;
                    }
                }

                const { text, options } = this.getPetStatusDisplay(pet, player, statusMessage);
                options.chat_id = chatId;
                options.message_id = messageId;
                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified'))
                        console.error(err);
                }
            // Direct action handler for typical room activities (e.g. sleep, play_fetch)
            } else if (action.startsWith('act_')) {
                const actId = action.replace('act_', '');
                const room = this.roomManager.getRoom(pet.room);
                let statusMessage = '';

                if (!room || !room.allowedActivities.includes(actId)) {
                    alertMessage =
                        'You must be in the correct room to do that!';
                } else {
                    const activity = this.activityManager.getActivity(actId);
                    if (!activity) {
                        alertMessage = 'Activity not found!';
                    } else if (
                        !activity.canPerform(pet, player, this.itemManager)
                    ) {
                        alertMessage = `${pet.name} isn't able to do that right now.`;
                    // If the activity requires an item, halt execution and reroute UI to selection menu
                    } else if (activity.itemSelect) {
                        const { text, options } =
                            this.getActivityItemSelectDisplay(
                                player,
                                activity,
                                0,
                            );
                        options.chat_id = chatId;
                        options.message_id = messageId;
                        try {
                            await this.bot.editMessageText(text, options);
                        } catch (err) {
                            if (
                                !err.message.includes('message is not modified')
                            )
                                console.error(err);
                        }
                        return; // Stop here, wait for item selection
                    } else {
                        activity.perform(pet, player, this.itemManager);
                        await this.game.savePet(pet);
                        await this.game.savePlayer(player);
                        statusMessage = `Performed ${activity.name}!`;
                    }
                }

                // Re-render status block when action occurs
                const { text, options } = this.getPetStatusDisplay(pet, player, statusMessage);
                options.chat_id = chatId;
                options.message_id = messageId;

                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified')) {
                        console.error('Failed to edit message:', err);
                    }
                }
            // Handles inventory pagination clicks
            } else if (action.startsWith('inv_page_')) {
                const page = parseInt(action.replace('inv_page_', ''), 10);
                const { text, options } = this.getInventoryDisplay(
                    player,
                    page,
                );
                options.chat_id = chatId;
                options.message_id = messageId;

                try {
                    await this.bot.editMessageText(text, options);
                } catch (err) {
                    if (!err.message.includes('message is not modified')) {
                        console.error('Failed to edit message:', err);
                    }
                }
            // Fires toast popup displaying item detail descriptions
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
