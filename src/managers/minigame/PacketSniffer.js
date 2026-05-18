const LootManager = require('./LootManager');
const GameEvents = require('../util/GameEvents');
const { calculateEffects } = require('../util/effects');

class PacketSniffer {
    constructor() {
        this.id = 'packet_sniffer';
        this.pool = ['00', '3F', '7A', '9B', 'A4', 'C2', 'E1', 'FF'];
    }

    async start(
        chatId,
        gameManager,
        byte,
        player,
        itemManager,
        activity = null,
    ) {
        let energyCost = 0;
        if (activity && activity.effects) {
            const effects = calculateEffects(activity.effects, byte, player);
            if (effects.energy && effects.energy < 0) {
                energyCost = Math.abs(effects.energy);
            }
        }

        if (energyCost > 0) {
            if (player.energy.value < energyCost) {
                return {
                    error: `Not enough Energy. Requires ${energyCost} ε.`,
                };
            }
            player.energy.decrease(energyCost);
            await gameManager.savePlayer(player);
        }

        gameManager.emit(GameEvents.MINIGAME_START, chatId, this.id);

        const target = [...this.pool]
            .sort(() => 0.5 - Math.random())
            .slice(0, 4);
        const state = {
            state: `MINIGAME_${this.id}`,
            target: target,
            history: [],
            currentGuess: [],
        };
        return { state, display: this.render(state, itemManager) };
    }

    render(state, itemManager) {
        const { target, history, currentGuess } = state;

        let text = '```text\n';
        if (history.length === 0 && currentGuess.length === 0) {
            text += `📡 PACKET INTERCEPTED\n`;
            text += `-------------------------\n`;
            text += `Lock: 4-Byte Hex\n`;
            text += `Lifespan: 6 Cycles\n\n`;
            text += `Select 4 nodes:\n`;
        } else {
            text += `🖥️ TRACE LOG\n`;
            text += `-------------------------\n`;
            history.forEach((h, index) => {
                text += `C${index + 1}: [${h.guess.join('][')}]\n`;
                text += `FB: [${h.feedback.join('][')}]\n`;
                if (index < history.length - 1) text += `\n`;
            });
            text += `-------------------------\n`;
        }

        const isWin =
            history.length > 0 &&
            history[history.length - 1].feedback.every((f) => f === 'ACK');
        const isLoss = history.length >= 6 && !isWin;

        if (isWin) {
            text += `\n🔓 PACKET CRACKED 🔓\n`;
            text += `-------------------------\n`;
            text += `Breached on Cycle ${history.length}/6.\n`;
            text += `Payload extracted.\n\n`;

            text += `💰 REWARDS:\n`;
            if (state.grantedLoot) {
                if (state.grantedLoot.bits)
                    text += `+ ${state.grantedLoot.bits} Bits\n`;
                if (state.grantedLoot.items) {
                    state.grantedLoot.items.forEach((itemLoot) => {
                        const itemObj = itemManager
                            ? itemManager.getItem(itemLoot.id)
                            : null;
                        const itemName = itemObj ? itemObj.name : itemLoot.id;
                        text += `+ [Item] ${itemName} (x${itemLoot.amount})\n`;
                    });
                }
            }
            text += `-------------------------\n`;
            text += `root:~# _\n\`\`\``;
            return {
                text,
                options: {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '🔙 Back to Status',
                                    callback_data: 'nav_status',
                                },
                            ],
                        ],
                    },
                },
            };
        } else if (isLoss) {
            text += `\n🚨 TERMINATED 🚨\n`;
            text += `-------------------------\n`;
            text += `Buffer exceeded. \n`;
            text += `Packet lost.\n\n`;
            text += `Target: [${target.join('][')}]\n`;
            text += `-------------------------\n`;
            text += `root:~# _\n\`\`\``;
            return {
                text,
                options: {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '🔙 Back to Status',
                                    callback_data: 'nav_status',
                                },
                            ],
                        ],
                    },
                },
            };
        }

        if (history.length > 0) {
            text += `⚠️ Firewall holding...\n`;
        }

        let guessDisplay =
            currentGuess.length > 0 ? `[${currentGuess.join('][')}]` : '';
        text += `\nroot:~# /inject ${guessDisplay}\n\`\`\``;

        const inline_keyboard = [];
        const row1 = [];
        const row2 = [];
        this.pool.forEach((hex, index) => {
            const isUsed = currentGuess.includes(hex);
            const btn = {
                text: isUsed ? '⬛' : `[${hex}]`,
                callback_data: isUsed
                    ? 'ignore_pagination'
                    : `minigame_${this.id}_${hex}`,
            };
            if (index < 4) row1.push(btn);
            else row2.push(btn);
        });
        inline_keyboard.push(row1);
        inline_keyboard.push(row2);
        inline_keyboard.push([
            { text: '⌫ Clear', callback_data: `minigame_${this.id}_clear` },
            { text: 'ℹ️ Help', callback_data: `minigame_${this.id}_help` },
        ]);
        inline_keyboard.push([
            { text: '❌ Abort', callback_data: `minigame_${this.id}_abort` },
        ]);

        return {
            text,
            options: {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard },
            },
        };
    }

    async handleInput(
        cmd,
        state,
        gameManager,
        chatId,
        byte,
        player,
        itemManager,
    ) {
        if (cmd === 'help') {
            return {
                alert: 'ACK: Correct node in correct slot.\nSEQ: Correct node in wrong slot.\nDRP: Node not in target sequence.\nFeedback order is randomized!'
            };
        } else if (cmd === 'clear') {
            state.currentGuess = [];
            return this.render(state, itemManager);
        } else if (this.pool.includes(cmd)) {
            if (
                state.currentGuess.length < 4 &&
                !state.currentGuess.includes(cmd)
            ) {
                state.currentGuess.push(cmd);

                if (state.currentGuess.length === 4) {
                    let ack = 0,
                        seq = 0,
                        drop = 0;
                    for (let i = 0; i < 4; i++) {
                        if (state.currentGuess[i] === state.target[i]) ack++;
                        else if (state.target.includes(state.currentGuess[i]))
                            seq++;
                        else drop++;
                    }

                    const feedback = [];
                    for (let i = 0; i < ack; i++) feedback.push('ACK');
                    for (let i = 0; i < seq; i++) feedback.push('SEQ');
                    for (let i = 0; i < drop; i++) feedback.push('DRP');
                    feedback.sort(() => 0.5 - Math.random());

                    state.history.push({
                        guess: [...state.currentGuess],
                        feedback: feedback,
                    });
                    state.currentGuess = [];

                    const isWin = ack === 4;
                    const isLoss = state.history.length >= 6 && !isWin;

                    if (isWin || isLoss) {
                        const guessesRemaining = 6 - state.history.length;
                        const resultStr = isWin ? 'win' : 'loss';
                        gameManager.emit(
                            GameEvents.MINIGAME_END,
                            chatId,
                            this.id,
                            { result: resultStr, guessesRemaining },
                        );
                    }

                    if (isWin && byte) {
                        const loot = LootManager.rollLoot('packet_sniffer_win');
                        state.grantedLoot = loot;
                        if (loot.bits) byte.pools.bits.increase(loot.bits);
                        if (loot.items) {
                            loot.items.forEach((itemLoot) =>
                                player.addItem(
                                    itemLoot.id,
const LootManager = require('../LootManager');
const GameEvents = require('../../util/GameEvents');
const { calculateEffects } = require('../../util/effects');

class PacketSniffer {
    constructor() {
        this.id = 'packet_sniffer';
        this.pool = ['00', '3F', '7A', '9B', 'A4', 'C2', 'E1', 'FF'];
    }

    async start(
        chatId,
        gameManager,
        byte,
        player,
        itemManager,
        activity = null,
    ) {
        let energyCost = 0;
        if (activity && activity.effects) {
            const effects = calculateEffects(activity.effects, byte, player);
            if (effects.energy && effects.energy < 0) {
                energyCost = Math.abs(effects.energy);
            }
        }

        if (energyCost > 0) {
            if (player.energy.value < energyCost) {
                return {
                    error: `Not enough Energy. Requires ${energyCost} ε.`,
                };
            }
            player.energy.decrease(energyCost);
            await gameManager.savePlayer(player);
        }

        gameManager.emit(GameEvents.MINIGAME_START, chatId, this.id);

        const target = [...this.pool]
            .sort(() => 0.5 - Math.random())
            .slice(0, 4);
        const state = {
            state: `MINIGAME_${this.id}`,
            target: target,
            history: [],
            currentGuess: [],
        };
        return { state, display: this.render(state, itemManager) };
    }

    render(state, itemManager) {
        const { target, history, currentGuess } = state;

        let text = '```text\n';
        if (history.length === 0 && currentGuess.length === 0) {
            text += `📡 PACKET INTERCEPTED\n`;
            text += `-------------------------\n`;
            text += `Lock: 4-Byte Hex\n`;
            text += `Lifespan: 6 Cycles\n\n`;
            text += `Select 4 nodes:\n`;
        } else {
            text += `🖥️ TRACE LOG\n`;
            text += `-------------------------\n`;
            history.forEach((h, index) => {
                text += `C${index + 1}: [${h.guess.join('][')}]\n`;
                text += `FB: [${h.feedback.join('][')}]\n`;
                if (index < history.length - 1) text += `\n`;
            });
            text += `-------------------------\n`;
        }

        const isWin =
            history.length > 0 &&
            history[history.length - 1].feedback.every((f) => f === 'ACK');
        const isLoss = history.length >= 6 && !isWin;

        if (isWin) {
            text += `\n🔓 PACKET CRACKED 🔓\n`;
            text += `-------------------------\n`;
            text += `Breached on Cycle ${history.length}/6.\n`;
            text += `Payload extracted.\n\n`;

            text += `💰 REWARDS:\n`;
            if (state.grantedLoot) {
                if (state.grantedLoot.bits)
                    text += `+ ${state.grantedLoot.bits} Bits\n`;
                if (state.grantedLoot.items) {
                    state.grantedLoot.items.forEach((itemLoot) => {
                        const itemObj = itemManager
                            ? itemManager.getItem(itemLoot.id)
                            : null;
                        const itemName = itemObj ? itemObj.name : itemLoot.id;
                        text += `+ [Item] ${itemName} (x${itemLoot.amount})\n`;
                    });
                }
            }
            text += `-------------------------\n`;
            text += `root:~# _\n\`\`\``;
            return {
                text,
                options: {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '🔙 Back to Status',
                                    callback_data: 'nav_status',
                                },
                            ],
                        ],
                    },
                },
            };
        } else if (isLoss) {
            text += `\n🚨 TERMINATED 🚨\n`;
            text += `-------------------------\n`;
            text += `Buffer exceeded. \n`;
            text += `Packet lost.\n\n`;
            text += `Target: [${target.join('][')}]\n`;
            text += `-------------------------\n`;
            text += `root:~# _\n\`\`\``;
            return {
                text,
                options: {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '🔙 Back to Status',
                                    callback_data: 'nav_status',
                                },
                            ],
                        ],
                    },
                },
            };
        }

        if (history.length > 0) {
            text += `⚠️ Firewall holding...\n`;
        }

        let guessDisplay =
            currentGuess.length > 0 ? `[${currentGuess.join('][')}]` : '';
        text += `\nroot:~# /inject ${guessDisplay}\n\`\`\``;

        const inline_keyboard = [];
        const row1 = [];
        const row2 = [];
        this.pool.forEach((hex, index) => {
            const isUsed = currentGuess.includes(hex);
            const btn = {
                text: isUsed ? '⬛' : `[${hex}]`,
                callback_data: isUsed
                    ? 'ignore_pagination'
                    : `minigame_${this.id}_${hex}`,
            };
            if (index < 4) row1.push(btn);
            else row2.push(btn);
        });
        inline_keyboard.push(row1);
        inline_keyboard.push(row2);
        inline_keyboard.push([
            { text: '⌫ Clear', callback_data: `minigame_${this.id}_clear` },
            { text: 'ℹ️ Help', callback_data: `minigame_${this.id}_help` },
        ]);
        inline_keyboard.push([
            { text: '❌ Abort', callback_data: `minigame_${this.id}_abort` },
        ]);

        return {
            text,
            options: {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard },
            },
        };
    }

    async handleInput(
        cmd,
        state,
        gameManager,
        chatId,
        byte,
        player,
        itemManager,
    ) {
        if (cmd === 'help') {
            return {
                alert: 'ACK: Correct node in correct slot.\nSEQ: Correct node in wrong slot.\nDRP: Node not in target sequence.\nFeedback order is randomized!'
            };
        } else if (cmd === 'clear') {
            state.currentGuess = [];
            return this.render(state, itemManager);
        } else if (this.pool.includes(cmd)) {
            if (
                state.currentGuess.length < 4 &&
                !state.currentGuess.includes(cmd)
            ) {
                state.currentGuess.push(cmd);

                if (state.currentGuess.length === 4) {
                    let ack = 0,
                        seq = 0,
                        drop = 0;
                    for (let i = 0; i < 4; i++) {
                        if (state.currentGuess[i] === state.target[i]) ack++;
                        else if (state.target.includes(state.currentGuess[i]))
                            seq++;
                        else drop++;
                    }

                    const feedback = [];
                    for (let i = 0; i < ack; i++) feedback.push('ACK');
                    for (let i = 0; i < seq; i++) feedback.push('SEQ');
                    for (let i = 0; i < drop; i++) feedback.push('DRP');
                    feedback.sort(() => 0.5 - Math.random());

                    state.history.push({
                        guess: [...state.currentGuess],
                        feedback: feedback,
                    });
                    state.currentGuess = [];

                    const isWin = ack === 4;
                    const isLoss = state.history.length >= 6 && !isWin;

                    if (isWin || isLoss) {
                        const guessesRemaining = 6 - state.history.length;
                        const resultStr = isWin ? 'win' : 'loss';
                        gameManager.emit(
                            GameEvents.MINIGAME_END,
                            chatId,
                            this.id,
                            { result: resultStr, guessesRemaining },
                        );
                    }

                    if (isWin && byte) {
                        const loot = LootManager.rollLoot('packet_sniffer_win');
                        state.grantedLoot = loot;
                        if (loot.bits) byte.pools.bits.increase(loot.bits);
                        if (loot.items) {
                            loot.items.forEach((itemLoot) =>
                                player.addItem(
                                    itemLoot.id,
                                    itemLoot.amount,
                                    itemManager,
                                ),
                            );
                        }
                        await gameManager.saveByte(byte);
                        await gameManager.savePlayer(player);
                    }
                }
                return this.render(state, itemManager);
            }
        }
        return null;
    }
}

module.exports = PacketSniffer;

class MinigameManager {
    constructor() {
        this.minigames = new Map();
        this.register(new PacketSniffer());
    }
    register(minigame) {
        this.minigames.set(minigame.id, minigame);
    }
    getMinigame(id) {
        return this.minigames.get(id);
    }
}
module.exports = new MinigameManager();
