const CombatManager = require('../managers/CombatManager');
const ActivityManager = require('../managers/ActivityManager');
const GameObjectManager = require('../managers/GameObjectManager');

/**
 * @mixin WebAPICombatHandler
 */
const WebAPICombatHandler = {
    async simulateCombat(req, res) {
        const { userId, activityId } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const playerByte = await this.gameManager.getByte(userId);
            const player = await this.gameManager.getPlayer(userId);

            if (!playerByte || !player)
                return res.status(404).json({ error: 'Data not found' });

            const activity = ActivityManager.getActivity(
                activityId || 'combat_simulation',
            );
            const combatConfig = activity?.combat || {
                enemyId: 'training_virus',
            };

            let matchData;
            try {
                matchData = CombatManager.runSingleMatch(
                    playerByte,
                    player,
                    combatConfig,
                );
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            const { result, grantedLoot, hpDelta, tfDelta } = matchData;

            let combatMsg = 'Combat ended in a stalemate!';
            let lootStr = '';

            if (result.winner === 'player') {
                combatMsg = `Combat Simulation: ${playerByte.name} was the victor!`;
                lootStr = GameObjectManager.formatLootString(grantedLoot);
                const rewardMsg =
                    lootStr.length > 0
                        ? `Simulation complete! Rewards extracted: ${lootStr}.`
                        : 'Simulation complete! No rewards extracted.';
                result.log.push({ action: 'reward', message: rewardMsg });
            } else if (result.winner === 'enemy') {
                combatMsg = `Combat Simulation: ${playerByte.name} was defeated.`;
            }

            const deltas = [];
            if (hpDelta !== 0)
                deltas.push(`${hpDelta > 0 ? '+' : ''}${hpDelta} Integrity`);
            if (tfDelta !== 0)
                deltas.push(`${tfDelta > 0 ? '+' : ''}${tfDelta} Teraflops`);

            let changesStr = deltas.join(', ');

            if (changesStr) combatMsg += `\n📊 ${changesStr}`;
            if (lootStr) combatMsg += `\n🎁 ${lootStr}`;

            let logMsg = `*Combat Simulation*\n${combatMsg}`;
            this.gameManager.emit('ACTIVITY_LOG', userId, logMsg);

            await this.gameManager.saveByte(playerByte);
            await this.gameManager.savePlayer(player);

            this.lastCombatMessages.set(userId, combatMsg);

            if (this.botController) {
                this.botController
                    .sendStatusUI(userId, playerByte, player, combatMsg)
                    .catch(console.error);
            }

            res.json(result);
        } catch (error) {
            console.error('Combat API Error:', error);
            res.status(500).json({ error: 'Failed to simulate combat.' });
        } finally {
            this.gameManager.deleteTransaction(userId);
        }
    },
};

module.exports = WebAPICombatHandler;
