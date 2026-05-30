class Enemy {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.enemyClass = data.enemyClass || 'virus';
        this.hp = data.hp || 100;
        this.tf = data.tf || 100;
        this.skills = data.skills || {};
        this.winEffects = data.winEffects || [];
    }

    getDicePool(type, key) {
        if (type === 'skill') {
            return [{ size: this.skills[key] || 0, sides: 6 }];
        }
        return [];
    }
}

module.exports = Enemy;
