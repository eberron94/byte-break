const LootManager = require('../LootManager');
const GameEvents = require('../../util/GameEvents');
const { calculateEffects, applyEffects, evaluateExpression } = require('../../util/effects');

class PacketSniffer {
    constructor() {
        this.id = 'packet_sniffer';
    }

    generatePool(size) {
        const hexChars = '0123456789ABCDEF'.split('');
        // Pick unique first characters so none repeat
        const firstChars = [...hexChars].sort(() => 0.5 - Math.random()).slice(0, size);
        const pool = firstChars.map(char => {
            const secondChar = hexChars[Math.floor(Math.random() * hexChars.length)];
            return char + secondChar;
        });
        return pool.sort();
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
        if (activity && activity.effects && activity.effects.length > 0) {
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

        const rawConfig = (activity && activity.difficulty) 
            ? activity.difficulty 
            : {};
        
        const config = {
            level: rawConfig.level || 'normal',
            guessLength: evaluateExpression(rawConfig.guessLength !== undefined ? rawConfig.guessLength : 4, byte, player),
            poolSize: evaluateExpression(rawConfig.poolSize !== undefined ? rawConfig.poolSize : 8, byte, player),
            maxGuesses: evaluateExpression(rawConfig.maxGuesses !== undefined ? rawConfig.maxGuesses : 6, byte, player)
        };

        const pool = this.generatePool(config.poolSize);
        const target = [...pool]
            .sort(() => 0.5 - Math.random())
            .slice(0, config.guessLength);

        console.log(`[Minigame] PacketSniffer initialized for user ${chatId}`);
        console.log(`[Minigame] Difficulty: ${config.level.toUpperCase()} | Pool: ${config.poolSize} | Target: ${config.guessLength} | Guesses: ${config.maxGuesses}`);
        console.log(`[Minigame] Available Pool: [${pool.join('] [')}]`);
        console.log(`[Minigame] Secret Target:  [${target.join('] [')}]`);

        gameManager.emit(GameEvents.MINIGAME_START, chatId, this.id);

        const state = {
            state: `MINIGAME_${this.id}`,
            config,
            pool,
            target: target,
            history: [],
            currentGuess: [],
            activityId: activity ? activity.id : null
        };
        return { state, display: this.render(state, itemManager) };
    }

    render(state, itemManager) {
        const { target, history, currentGuess, pool, config } = state;
        const { guessLength, maxGuesses } = config;

        let text = '```text\n';
        if (history.length === 0 && currentGuess.length === 0) {
            text += `📡 PACKET INTERCEPTED\n`;
            text += `-------------------------\n`;
            text += `Lock: ${guessLength}-Byte Hex\n`;
            text += `Lifespan: ${maxGuesses} Cycles\n\n`;
            text += `Select ${guessLength} nodes:\n`;
        } else {
            text += `🖥️ TRACE LOG\n`;
            text += `-------------------------\n`;
            history.forEach((h, index) => {
                text += `C${index + 1}/${maxGuesses}: [${h.guess.join('][')}]\n`;
                text += `FB: [${h.feedback.join('][')}]\n`;
                if (index < history.length - 1) text += `\n`;
            });
            text += `-------------------------\n`;
        }

        const isWin =
            history.length > 0 &&
            history[history.length - 1].feedback.every((f) => f === 'ACK') &&
            history[history.length - 1].feedback.length === guessLength;
        const isLoss = history.length >= maxGuesses && !isWin;

        if (isWin) {
            text += `\n🔓 PACKET CRACKED 🔓\n`;
            text += `-------------------------\n`;
            text += `Breached on Cycle ${history.length}/${maxGuesses}.\n`;
            text += `Payload extracted.\n\n`;

            if (state.grantedLoot && (state.grantedLoot.bits > 0 || state.grantedLoot.items.length > 0)) {
                text += `💰 REWARDS:\n`;
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
        const splitIndex = Math.ceil(pool.length / 2);
        pool.forEach((hex, index) => {
            const isUsed = currentGuess.includes(hex);
            const btn = {
                text: isUsed ? '⬛' : `[${hex}]`,
                callback_data: isUsed
                    ? 'ignore_pagination'
                    : `minigame_${this.id}_${hex}`,
            };
            if (index < splitIndex) row1.push(btn);
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
        const { target, pool, config, activityId } = state;
        const activity = gameManager.activityManager.getActivity(activityId);
        const { guessLength, maxGuesses, level } = config;

        if (cmd === 'help') {
            return {
                alert: 'ACK: Correct node in correct slot.\nSEQ: Correct node in wrong slot.\nDRP: Node not in target sequence.\nFeedback order is randomized!'
            };
        } else if (cmd === 'clear') {
            state.currentGuess = [];
            return this.render(state, itemManager);
        } else if (pool.includes(cmd)) {
            if (
                state.currentGuess.length < guessLength &&
                !state.currentGuess.includes(cmd)
            ) {
                state.currentGuess.push(cmd);

                if (state.currentGuess.length === guessLength) {
                    let ack = 0,
                        seq = 0,
                        drop = 0;
                    for (let i = 0; i < guessLength; i++) {
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

                    const isWin = ack === guessLength;
                    const isLoss = state.history.length >= maxGuesses && !isWin;

                    if (isWin && activity && activity.winEffects) {
                        const calculatedWinEffects = calculateEffects(activity.winEffects, byte, player);
                            state.grantedLoot = LootManager.processLoot(calculatedWinEffects, player, itemManager);
                        applyEffects(calculatedWinEffects, byte, player, itemManager);
                    } else if (isLoss && activity && activity.loseEffects) {
                        const calculatedLoseEffects = calculateEffects(activity.loseEffects, byte, player);
                            state.grantedLoot = LootManager.processLoot(calculatedLoseEffects, player, itemManager);
                        applyEffects(calculatedLoseEffects, byte, player, itemManager);
                    }

                    if (isWin || isLoss) {
                            try {
                                await gameManager.saveByte(byte);
                                await gameManager.savePlayer(player);
                                
                                const guessesRemaining = maxGuesses - state.history.length;
                                const resultStr = isWin ? 'win' : 'loss';
                                gameManager.emit(
                                    GameEvents.MINIGAME_END,
                                    chatId,
                                    this.id,
                                    { result: resultStr, guessesRemaining, difficulty: level },
                                );
                            } catch (err) {
                                console.error('[PacketSniffer] Error saving results:', err);
                                return { alert: 'Database error saving results!' };
                            }
                    }
                }
                return this.render(state, itemManager);
            }
        }
        return null;
    }
}

module.exports = PacketSniffer;
