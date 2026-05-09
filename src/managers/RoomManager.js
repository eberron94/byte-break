const Room = require('../models/Room');
const roomsData = require('../../data/rooms.json');

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.load();
    }

    load() {
        roomsData.forEach((data) => {
            this.rooms.set(data.id, new Room(data));
        });
    }

    getRoom(id) {
        return this.rooms.get(id);
    }

    getAllRooms() {
        return Array.from(this.rooms.values());
    }
}
module.exports = RoomManager;
