const { getTimeContext } = require('../util/time');
const HediffManager = require('../managers/HediffManager');

class GameContext {
    /**
     * @param {Byte} byte - The active byte (can be null)
     * @param {Player} player - The active player (can be null)
     * @param {Object} extraLocals - Additional context variables (e.g., tickCounter, stacks)
     */
    constructor(byte = null, player = null, extraLocals = {}) {
        this.byte = byte;
        this.player = player;

        // Automatically fetch the time environment and merge in any extras
        this.locals = {
            ...getTimeContext(),
            ...extraLocals,
        };

        // Apply Local Context Overrides from Player or Byte Hediffs
        const applyOverrides = (hediffs) => {
            if (!hediffs) return;
            for (const hId of Object.keys(hediffs)) {
                const hDef = HediffManager.getHediff(hId);
                if (hDef && hDef.localOverrides) {
                    Object.assign(this.locals, hDef.localOverrides);
                }
            }
        };

        if (this.player) applyOverrides(this.player.hediffs);
        if (this.byte) applyOverrides(this.byte.hediffs);
    }
}

module.exports = GameContext;