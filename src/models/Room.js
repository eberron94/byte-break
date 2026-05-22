const { checkRequirements } = require('../util/requirements');

class Room {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.allowedActivities = data.allowedActivities || [];
        this.tickEffects = data.tickEffects || null;
        this.requirements = data.requirements || [];
    }

    canEnter(context) {
        return checkRequirements(this.requirements, context);
    }
}

module.exports = Room;
