class GameEvents {
    static BYTE_SPAWNED = 'byteSpawned';
    static BYTE_MERGED = 'byteMerged';
    static BYTE_DELETED = 'byteDeleted';
    static LEVEL_UP = 'levelUp';
    static SHOP_PURCHASE = 'shopPurchase';
    static COMBAT_WIN = 'combatWin';
    static COMBAT_LOSS = 'combatLoss';
    static ROOM_ENTERED = 'roomEntered';
    static RANDOM_EVENT = 'randomEvent';
    static ENERGY_REWARD = 'energyReward';
    static ACHIEVEMENT_UNLOCKED = 'achievementUnlocked';
    static DEBUG_ACTION = 'debugAction';
    static MINIGAME_START = 'minigameStart';
    static MINIGAME_END = 'minigameEnd';
}

module.exports = GameEvents;