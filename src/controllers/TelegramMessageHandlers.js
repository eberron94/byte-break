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
                await this.bot.sendMessage(chatId, `❌ Deletion cancelled.`);
            }

            const bytes = await this.game.getBytes(chatId);
            const player = await this.game.getPlayer(chatId);
            await this.sendStasisUI(chatId, bytes, player);
        } else if (userState.state.startsWith('MINIGAME_')) {
            await this.bot.sendMessage(chatId, "⚠️ You are currently in a minigame session. Use the inline buttons to interact, or press ❌ Abort.");
        }
    }
}

module.exports = handleMessage;