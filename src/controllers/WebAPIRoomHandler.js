const RoomManager = require('../managers/RoomManager');
const GameContext = require('../models/GameContext');

/**
 * @mixin WebAPIRoomHandler
 */
const WebAPIRoomHandler = {
    async getRooms(req, res) {
        try {
            const userId = req.params.id;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const byte = await this.gameManager.getByte(userId);

            if (!player || !byte)
                return res.status(404).json({ error: 'Not found' });

            const context = new GameContext(byte, player);
            const rooms = RoomManager.getAllRooms().map((room) =>
                room.toWeb(context),
            );

            res.json(rooms);
        } catch (error) {
            console.error('Rooms API Error:', error);
            res.status(500).json({ error: 'Failed to fetch rooms' });
        }
    },
};

module.exports = WebAPIRoomHandler;
