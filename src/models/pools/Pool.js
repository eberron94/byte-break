/**
 * Base representation for expandable capacities and cumulative trackers
 * like Lifepoints, Mana, and XP.
 */
class Pool {
    constructor(name, value = 100) {
        this.id = name.toLowerCase().replace(/\s+/g, '_');
        this.name = name;
        this.value = value;
    }
}

module.exports = Pool;
