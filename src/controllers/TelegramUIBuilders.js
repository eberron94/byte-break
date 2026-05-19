const Pagination = require('./Pagination');
const { calculateEffects, evaluateExpression } = require('../util/effects');
const ShopManager = require('../managers/ShopManager');
const classesData = require('../../data/classes.json');
const { getTimeContext } = require('../util/time');

/**
 * @mixin TelegramUIBuilders
 *
 * This mixin contains all the UI formatting logic for Telegram messages.
 * By separating these builders into their own file, we keep the main
 * TelegramBotController clean and focused on routing and state management.
 */
const TelegramUIBuilders = {
    getClassSelectionDisplay(byteName) {
        let text = `Great! Now, select a class for **${byteName}**:`;
        const inline_keyboard = [];

        for (let i = 0; i < classesData.length; i += 2) {
            const row = [];
            row.push({
                text: classesData[i].name,
                callback_data: `spawn_class_${classesData[i].id}`,
            });
            if (classesData[i + 1]) {
                row.push({
                    text: classesData[i + 1].name,
                    callback_data: `spawn_class_${classesData[i + 1].id}`,
                });
            }
            inline_keyboard.push(row);
        }

        inline_keyboard.push([
            { text: '🔙 Cancel', callback_data: 'act_cancel' },
        ]);

        const options = {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard },
        };
        return { text, options };
    },

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
            const timeContext = getTimeContext();
            const effectStrings = [];

            const effectsByTicks = {};
            room.tickEffects.forEach((eff) => {
                const tpt =
                    eff.ticksPerTrigger !== undefined
                        ? evaluateExpression(
                              eff.ticksPerTrigger,
                              byte,
                              player,
                              timeContext,
                          )
                        : 1;
                if (!effectsByTicks[tpt]) effectsByTicks[tpt] = [];
                effectsByTicks[tpt].push(eff);
            });

            for (const [tptStr, effs] of Object.entries(effectsByTicks)) {
                const tpt = parseInt(tptStr, 10);
                const evaluatedEffects = calculateEffects(
                    effs,
                    byte,
                    player,
                    timeContext,
                );
                const str = Object.entries(evaluatedEffects)
                    .filter(
                        ([key]) =>
                            key !== 'inventory' &&
                            key !== 'loot' &&
                            key !== 'hediffs',
                    )
                    .map(([key, val]) => {
                        const suffix = tpt === 1 ? '/min' : `/${tpt}min`;
                        return `${val > 0 ? '+' : ''}${val} ${key.charAt(0).toUpperCase() + key.slice(1)}${suffix}`;
                    })
                    .join(', ');
                if (str.length > 0) {
                    effectStrings.push(str);
                }
            }

            if (effectStrings.length > 0) {
                text += `⏱️ **Passive Effects:** ${effectStrings.join(', ')}\n`;
            }
        }

        if (room && room.id === 'market') {
            const timeContext = getTimeContext();
            const context = {
                byte,
                player,
                ...timeContext,
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
                            player,
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
    },

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
    },

    getItemDetailDisplay(player, itemId) {
        const item = this.itemManager.getItem(itemId);
        const amount = player.inventory[itemId] || 0;
        let text = `🎒 **Item Details** 🎒\n\n**${item.name}** (x${amount})\n_${item.description}_\n`;
        const inline_keyboard = [];
        if ((item.type === 'consumable' || item.type === 'key') && amount > 0) {
            const icon = item.type === 'key' ? '🔑' : '💊';
            if (item.isOnCooldown(player)) {
                const waitMins = item.getCooldownRemaining(player);
                inline_keyboard.push([
                    {
                        text: `⏳ Cooldown (${waitMins}m)`,
                        callback_data: `ignore_pagination`,
                    },
                ]);
            } else {
                inline_keyboard.push([
                    {
                        text: `${icon} Use ${item.shortname}`,
                        callback_data: `use_item_${itemId}`,
                    },
                ]);
            }
        }
        inline_keyboard.push([
            { text: '🔙 Back to Inventory', callback_data: 'nav_inventory' },
        ]);
        const options = {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard },
        };
        return { text, options };
    },

    getRoomsDisplay(byte, player, chatId, page = 0) {
        const rooms = this.roomManager.getAllRooms();
        const buttons = [];
        const adminIds = (process.env.ADMIN_USER_IDS || '')
            .split(',')
            .map((id) => id.trim());
        const isAdmin = adminIds.includes(chatId.toString());

        rooms.forEach((room) => {
            if (room.id === 'debug_room' && !isAdmin) return;
            if (!room.canEnter(byte, player, this.itemManager)) return;
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
    },

    getActivityItemSelectDisplay(player, activity, page = 0) {
        const inventory = player.inventory;
        const buttons = [];
        for (const [itemId, amount] of Object.entries(inventory)) {
            if (amount <= 0) continue;
            const item = this.itemManager.getItem(itemId);
            if (!item) continue;

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

            if (isValid && !item.isOnCooldown(player)) {
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
    },

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
        if (adminRow.length > 0) inline_keyboard.push(adminRow);

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
        if (inline_keyboard.length > 0)
            options.reply_markup = { inline_keyboard };
        return { text, options };
    },

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
    },
};

module.exports = TelegramUIBuilders;
