const PacketSniffer = require('./PacketSniffer');

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