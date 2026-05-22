const sharp = require('sharp');
const { generateClassBasedAvatar } = require('../util/avatar');
const GameEvents = require('../util/GameEvents');
const RoomManager = require('../managers/RoomManager');
const GameContext = require('../models/GameContext');
const GameObjectManager = require('../managers/GameObjectManager');

/**
 * @mixin TelegramCommandHandlers
 *
 * This mixin contains all the logic for handling direct Telegram commands
 * (e.g., /start, /spawn). It is mixed into the main TelegramBotController
 * to keep the main class file clean and focused on initialization and core logic.
 */
const TelegramCommandHandlers = {
    // Centralized spawn processing
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
    },

    // Welcome response handler
    async handleStart(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /start from chat ${chatId}`);
        await this.bot.sendMessage(
            chatId,
            'Welcome to Tele-grow! Use `/spawn [name]` to get your first byte.',
        );
    },

    // Spawns a new byte and commits it to the database
    async handleSpawn(msg, match) {
        const chatId = msg.chat.id;
        const rawByteName = match[1];

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

        if (!rawByteName) {
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

        const byteName = rawByteName.trim().replace(/[^a-zA-Z0-9 ]/g, '');
        if (byteName.length === 0 || byteName.length > 32) {
            await this.bot.sendMessage(
                chatId,
                'Byte name must be 1-32 characters and only contain letters/numbers. Please try again with `/spawn [name]`.'
            );
            return;
        }

        console.log(`[Command] /spawn ${byteName} from chat ${chatId}`);
        this.userStates.set(chatId, { state: 'AWAITING_BYTE_CLASS', byteName: byteName });
        const { text, options } = this.getClassSelectionDisplay(byteName);
        await this.bot.sendMessage(chatId, text, options);
    },

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
    },

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
    },

    // Lists the possible rooms a byte can currently travel to
    async handleRooms(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /rooms from chat ${chatId}`);

        const byte = await this.game.getByte(chatId);
        if (!byte)
            return this.bot.sendMessage(chatId, "You don't have a byte!");

        const player = await this.game.getPlayer(chatId);

        const { text, options } = this.getRoomsDisplay(byte, player, chatId, 0);
        await this.sendOrUpdateUI(chatId, text, options, msg.message_id);
    },

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
            
        const player = await this.game.getPlayer(chatId);

        const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
        const isAdmin = adminIds.includes(chatId.toString());

        // If the user didn't specify a room, prompt them with the inline keyboard
        if (!newRoomId) {
            const { text, options } = this.getRoomsDisplay(byte, player, chatId, 0);
            await this.sendOrUpdateUI(chatId, text, options, msg.message_id);
            return;
        }

        const room = RoomManager.getRoom(newRoomId);
        if (!room || (room.id === 'debug_room' && !isAdmin)) {
            return this.bot.sendMessage(
                chatId,
                `Room '${newRoomId}' does not exist. Use /rooms to see available rooms.`,
            );
        }

        if (!room.canEnter(new GameContext(byte, player))) {
            const reqStr = GameObjectManager.formatRequirementsList(room.requirements);
            return this.bot.sendMessage(
                chatId,
                `${byte.name} does not meet the requirements to enter the ${room.name}.\n\nRequires:\n• ${reqStr}`,
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
    },

    // Main entry point for rendering user's collected items
    async handleInventory(msg) {
        const chatId = msg.chat.id;
        console.log(`[Command] /inventory from chat ${chatId}`);
        const player = await this.game.getPlayer(chatId);
        const { text, options } = this.getInventoryDisplay(player, 0);
        await this.sendOrUpdateUI(chatId, text, options, msg.message_id);
    },

    // Forces one or more global ticks for testing/mechanics
    async handleTick(msg, match) {
        const chatId = msg.chat.id;
        const ticks = match[1] ? parseInt(match[1], 10) : 1;
        console.log(`[Command] /tick ${ticks} from chat ${chatId}`);

        for (let i = 0; i < ticks; i++) {
            await this.game.processTick();
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
    },

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
    },
};

module.exports = TelegramCommandHandlers;