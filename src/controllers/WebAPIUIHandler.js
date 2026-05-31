/**
 * @mixin WebAPIUIHandler
 */
const WebAPIUIHandler = {
    async refreshUI(req, res) {
        try {
            const { userId } = req.body;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);

            if (this.botController) {
                const bytes = await this.gameManager.getBytes(userId);
                const player = await this.gameManager.getPlayer(userId);
                const activeByte = bytes.find((b) => !b.isAsleep && b.isAlive);

                let finalMessage = req.body.message;
                if (
                    req.body.isCombatFinish &&
                    this.lastCombatMessages.has(userId)
                ) {
                    finalMessage = this.lastCombatMessages.get(userId);
                    this.lastCombatMessages.delete(userId);
                }

                if (activeByte) {
                    await this.botController.sendStatusUI(
                        userId,
                        activeByte,
                        player,
                        finalMessage,
                    );
                } else {
                    await this.botController.sendStasisUI(
                        userId,
                        bytes,
                        player,
                    );
                }
            }
            res.json({ success: true });
        } catch (error) {
            console.error('UI Refresh API Error:', error);
            res.status(500).json({ error: 'Failed to refresh UI.' });
        }
    },
};

module.exports = WebAPIUIHandler;
