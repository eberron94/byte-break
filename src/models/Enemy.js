const { checkRequirements } = require('../util/requirements');

class Enemy {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.enemyClass = data.enemyClass || 'virus';
        this.hp = data.hp || 100;
        this.tf = data.tf || 100;
        this.skills = data.skills || {};
        this.winEffects = data.winEffects || [];
        
        if (data.primaryDrop) {
            this.primaryDrop = { ...data.primaryDrop };
            if (!this.primaryDrop.id) this.primaryDrop.id = `drop_${this.id}`;
        } else {
            this.primaryDrop = null;
        }
        this.requirements = data.requirements || [];
    }

    getDicePool(type, key) {
        if (type === 'skill') {
            return [{ size: this.skills[key] || 0, sides: 6 }];
        }
        return [];
    }

    isUnlocked(context) {
        return checkRequirements(this.requirements, context);
    }
}

module.exports = Enemy;
