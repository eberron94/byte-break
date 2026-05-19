/**
 * Handles general text messages for stateful interactions (e.g., prompting
 * for a name). Extracted from TelegramBotController to keep the main class
 * clean and focused on routing.
 *
 * @param {Object} msg - The Telegram message object.
 * @this TelegramBotController
 */
async function handleMessage(msg) {
    if (!msg.text) return;
    const chatId = msg.chat.id;

    this.game.recordPlayerActivity(chatId).catch(console.error);

    // If it's a command, clear any pending state and let the command handler take over
    if (msg.text.startsWith('/')) {
        this.userStates.delete(chatId);
        return;
    }

    try {
    const userState = this.userStates.get(chatId);
    if (userState) {
        if (userState.state === 'AWAITING_BYTE_NAME') {
                const byteName = msg.text.trim().replace(/[^a-zA-Z0-9 ]/g, '');
                if (byteName.length === 0 || byteName.length > 32) {
                    await this.bot.sendMessage(chatId, 'Byte name must be 1-32 characters and only contain letters/numbers. Please try again:');
                    return;
                }
            console.log(
                `[State] Received byte name '${byteName}' from chat ${chatId}`,
            );
            this.userStates.set(chatId, {
                state: 'AWAITING_BYTE_CLASS',
                byteName: byteName,
            });
            const { text, options } = this.getClassSelectionDisplay(byteName);
            await this.bot.sendMessage(chatId, text, options);
        } else if (userState.state === 'AWAITING_DELETE_CONFIRM') {
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
                await this.bot.sendMessage(chatId, `❌ Deletion cancelled.`);
            }

            const bytes = await this.game.getBytes(chatId);
            const player = await this.game.getPlayer(chatId);
            await this.sendStasisUI(chatId, bytes, player);
        } else if (userState.state.startsWith('MINIGAME_')) {
            await this.bot.sendMessage(
                chatId,
                '⚠️ You are currently in a minigame session. Use the inline buttons to interact, or press ❌ Abort.',
            );
        }
    }
    } catch (error) {
        console.error(`[TelegramMessageHandlers] Error processing message from chat ${chatId}:`, error);
    }
}

module.exports = handleMessage;
