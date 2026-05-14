const ByteClass = require('../models/ByteClass');
const classesData = require('../../data/classes.json');

/**
 * Loads and manages all character classes available in the game.
 */
class ByteClassManager {
    constructor() {
        this.classes = new Map();
        this.load();
    }

    load() {
        if (!Array.isArray(classesData)) {
            console.error(
                '[ByteClassManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        classesData.forEach((data, index) => {
            if (!data.name) {
                console.warn(
                    `[ByteClassManager] Skipping invalid class at index ${index}: Missing required 'name'`,
                );
                return;
            }
            const byteClass = new ByteClass(data);
            this.classes.set(byteClass.id, byteClass);
        });
    }

    getClass(id) {
        return this.classes.get(id);
    }

    getAllClasses() {
        return Array.from(this.classes.values());
    }
}
module.exports = new ByteClassManager();
