class Room {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.allowedActivities = data.allowedActivities || [];
    }
}

module.exports = Room;
