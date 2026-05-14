/**
 * Base representation of a Core Stat (e.g. Strength, Dexterity).
 */
class Stat {
    constructor(name, data) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.value = typeof data === 'object' && data !== null ? data.value : (data !== undefined ? data : 5.0);
    }
}

module.exports = Stat;
