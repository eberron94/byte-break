/**
 * Base representation of a Core Stat (e.g. Strength, Dexterity).
 */
class Stat {
    constructor(name, value = 5.0) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.value = value;
    }
}

module.exports = Stat;
