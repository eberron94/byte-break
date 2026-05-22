const { getTimeContext } = require('../util/time');

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
    }
}

module.exports = GameContext;