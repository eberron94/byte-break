const { checkRequirements } = require('../util/requirements');
const { getTimeContext } = require('../util/time');

class Room {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.allowedActivities = data.allowedActivities || [];
        this.tickEffects = data.tickEffects || null;
        this.requirements = data.requirements || [];
    }

    canEnter(byte, player = null, itemManager = null) {
        const context = getTimeContext();
        return checkRequirements(this.requirements, byte, player, itemManager, context);
    }
}

module.exports = Room;
