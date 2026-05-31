const Enemy = require('../models/Enemy');
const enemiesData = require('../../data/enemies.json');
const Item = require('../models/Item');
const ItemManager = require('./ItemManager');

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

            if (data.primaryDrop) {
                const dropId = data.primaryDrop.id || `drop_${data.id}`;
                const dropItem = new Item({
                    id: dropId,
                    name: data.primaryDrop.name || `Codex [${data.name}]`,
                    description:
                        data.primaryDrop.description ||
                        `A material dropped by ${data.name}.`,
                    type: 'mob_drop',
                    cost: data.primaryDrop.cost || 10,
                    maxCount: data.primaryDrop.maxCount || Infinity,
                    isConsumed: false,
                    ...data.primaryDrop,
                });
                ItemManager.registerItem(dropItem);
                data.primaryDrop.id = dropId; // Update the reference so the Enemy object knows the actual ID
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

    getUnlockedEnemies(context) {
        return this.getAllEnemies().filter((e) => e.isUnlocked(context));
    }
}

module.exports = new EnemyManager();
