const dbManager = require('../database/db');
const sharp = require('sharp');
const { generateTradingCard, generateStasisCard } = require('../util/card');

/**
 * @mixin TelegramUIOperators
 *
 * This mixin contains all the core logic for sending, updating, and deleting
 * UI messages in Telegram. It centralizes the complex logic of tracking the
 * active UI message and ensuring a clean chat history.
 */
const TelegramUIOperators = {
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
    },

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
    },

    // Generates the trading card image and updates the UI
    async sendStatusUI(chatId, byte, player, statusMessage = null, userMsgId = null) {
        const { text, options } = this.getByteStatusDisplay(byte, player, statusMessage);

        try {
            const svgString = generateTradingCard(byte);
            const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
            await this.sendOrUpdateUI(chatId, text, options, userMsgId, pngBuffer);
        } catch (error) {
            console.error('Failed to generate or send trading card:', error);
            await this.sendOrUpdateUI(chatId, text, options, userMsgId, null);
        }
    },

    // Generates the stasis bay image and updates the UI
    async sendStasisUI(chatId, bytes, player, userMsgId = null) {
        const { text, options } = this.getByteSelectionDisplay(bytes, player);

        try {
            const svgString = generateStasisCard(bytes, player);
            const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
            await this.sendOrUpdateUI(chatId, text, options, userMsgId, pngBuffer);
        } catch (error) {
            console.error('Failed to generate stasis card:', error);
            await this.sendOrUpdateUI(chatId, text, options, userMsgId, null);
        }
    },
};

module.exports = TelegramUIOperators;