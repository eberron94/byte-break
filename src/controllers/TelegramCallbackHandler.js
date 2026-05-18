const GameEvents = require('../util/GameEvents');
const minigameManager = require('../managers/minigame/MinigameManager');

async function handleCallbackQuery(query) {
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

        if (action === 'ignore_pagination') return;

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
                this.userStates.set(chatId, { state: 'AWAITING_BYTE_NAME' });
                await this.bot.sendMessage(chatId, 'What would you like to name your new byte?');
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
                const { text, options } = this.getDeleteSelectionDisplay(livingBytes);
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
                    if (state && state.state === 'AWAITING_DELETE_CONFIRM' && state.byteId === byteId) {
                        this.userStates.delete(chatId);
                        await this.bot.sendMessage(chatId, `Deletion of **${targetByte.name}** timed out.`, { parse_mode: 'Markdown' });
                    }
                }, 30000);

                this.userStates.set(chatId, { state: 'AWAITING_DELETE_CONFIRM', byteId: byteId, timeoutId: timeoutId });
                await this.bot.sendMessage(chatId, `⚠️ Are you sure you want to permanently delete **${targetByte.name}**?\n\nType \`YES\` to confirm. Any other input will cancel this action. (Times out in 30 seconds)`, { parse_mode: 'Markdown' });
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
                await this.sendStatusUI(chatId, byteToWake, player, `Woke up ${byteToWake.name}!`);
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
            const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim());
            const isAdmin = adminIds.includes(chatId.toString());
            let statusMessage = '';
            if (room && (room.id !== 'debug_room' || isAdmin)) {
                if (byte.room !== newRoomId) {
                    byte.room = newRoomId;
                    await this.game.saveByte(byte);
                    statusMessage = `Moved to the ${room.name}! 🚶`;
                    this.game.emit(GameEvents.ROOM_ENTERED, chatId, newRoomId);
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
                const { text, options } = this.getActivityItemSelectDisplay(player, activity, page);
                await this.updateMessageDisplay(query, text, options);
            }
        } else if (action.startsWith('act_ex|')) {
            const [actId, itemId] = action.replace('act_ex|', '').split('|');
            const activity = this.activityManager.getActivity(actId);
            let statusMessage = '';
            if (!activity) {
                alertMessage = 'Activity not found!';
            } else if (!activity.canPerform(byte, player, this.itemManager)) {
                alertMessage = `${byte.name} isn't able to do that right now.`;
            } else {
                const item = this.itemManager.getItem(itemId);
                if (!item || !player.hasItem(itemId, 1)) {
                    alertMessage = "You don't have that item.";
                } else {
                    activity.perform(byte, player, this.itemManager, itemId);
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
                alertMessage = 'You must be in the correct room to do that!';
            } else {
                const activity = this.activityManager.getActivity(actId);
                if (!activity) {
                    alertMessage = 'Activity not found!';
                } else if (!activity.canPerform(byte, player, this.itemManager)) {
                    alertMessage = `${byte.name} isn't able to do that right now.`;
                } else if (activity.itemSelect) {
                    const { text, options } = this.getActivityItemSelectDisplay(player, activity, 0);
                    await this.updateMessageDisplay(query, text, options);
                    return;
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
            await this.sendStatusUI(chatId, byte, player, statusMessage);
        } else if (action.startsWith('inv_page_')) {
            const page = parseInt(action.replace('inv_page_', ''), 10);
            const { text, options } = this.getInventoryDisplay(player, page);
            await this.updateMessageDisplay(query, text, options);
        } else if (action.startsWith('item_info_')) {
            const itemId = action.replace('item_info_', '');
            const item = this.itemManager.getItem(itemId);
            if (item) {
                const { text, options } = this.getItemDetailDisplay(player, itemId);
                await this.updateMessageDisplay(query, text, options);
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
                    await this.sendStatusUI(chatId, byte, player, `Used ${item.name}!`);
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
        await this.bot.answerCallbackQuery(query.id, { text: alertMessage, show_alert: showAlert });
    }
}

module.exports = handleCallbackQuery;