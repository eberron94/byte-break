const  ByteBuilder  = require('../models/ByteBuilder');
const dbManager = require('../database/db');
const GameEvents = require('../util/GameEvents');

class SpawnManager {
    static async spawnByte(gameManager, userId, byteName, byteClass = 'demo') {
        if (
            !byteName ||
            typeof byteName !== 'string' ||
            byteName.trim().length === 0
        ) {
            throw new Error('A valid name must be provided for the new Byte.');
        }
        const sanitizedName = byteName.trim().replace(/[^a-zA-Z0-9 ]/g, '');
        if (sanitizedName.length === 0 || sanitizedName.length > 32) {
            throw new Error(
                'Byte name must be 1-32 characters and only contain letters/numbers.',
            );
        }

        const bytes = await gameManager.getBytes(userId);
        const player = await gameManager.getPlayer(userId);
        const livingBytes = bytes.filter((b) => b.isAlive);

        if (livingBytes.length >= (player.maxBytes || 2)) {
            throw new Error(
                `User already has ${player.maxBytes || 2} living bytes!`,
            );
        }

        // Put all existing living bytes to sleep
        for (const b of livingBytes) {
            if (!b.isAsleep) {
                b.isAsleep = true;
                await gameManager.saveByte(b);
            }
        }

        // Use the builder to generate a default byte with starting stats
        const byteId = `${userId}_${Date.now()}`;
        const byte = ByteBuilder.default(userId, sanitizedName)
            .withId(byteId)
            .withByteClass(byteClass)
            .build();
        const s = byte.serialize();

        // Insert the serialized byte data into the database
        await dbManager.insertByte(s);

        gameManager.emit(GameEvents.BYTE_SPAWNED, userId, byte);

        return byte;
    }
}
module.exports = SpawnManager;
