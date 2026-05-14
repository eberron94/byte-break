const Room = require('../models/Room');
const roomsData = require('../../data/rooms.json');

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.load();
    }

    load() {
        if (!Array.isArray(roomsData)) {
            console.error(
                '[RoomManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        roomsData.forEach((data, index) => {
            if (!data.id || !data.name) {
                console.warn(
                    `[RoomManager] Skipping invalid room at index ${index}: Missing required 'id' or 'name'`,
                );
                return;
            }
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
module.exports = new RoomManager();
