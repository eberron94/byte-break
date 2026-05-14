class Room {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.allowedActivities = data.allowedActivities || [];
        this.tickEffects = data.tickEffects || null;
    }
}

module.exports = Room;
