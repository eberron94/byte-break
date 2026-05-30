const Enemy = require('../models/Enemy');
const enemiesData = require('../../data/enemies.json');

class EnemyManager {
    constructor() {
        this.enemies = new Map();
        this.load();
    }

    load() {
        if (!Array.isArray(enemiesData)) {
            console.error(
                '[EnemyManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        enemiesData.forEach((data, index) => {
            if (!data.id || !data.name) {
                console.warn(
                    `[EnemyManager] Skipping invalid enemy at index ${index}: Missing required 'id' or 'name'`,
                );
                return;
            }
            this.enemies.set(data.id, new Enemy(data));
        });
    }

    getEnemy(id) {
        return this.enemies.get(id);
    }

    getAllEnemies() {
        return Array.from(this.enemies.values());
    }
}

module.exports = new EnemyManager();
