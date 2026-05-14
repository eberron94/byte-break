const dbManager = require('../database/db');
const { Byte, ByteBuilder } = require('../models/Byte');
const Player = require('../models/Player');

class GameManager {
    constructor() {
        // Database is now handled via the dbManager singleton
    }

    // Factory method to initialize the database before creating the manager
    static async create() {
        await dbManager.init();
        return new GameManager();
    }

    // Creates a brand new byte for a user and saves it to the database
    async createByte(userId, byteName) {
        const existing = await dbManager.getByteByOwner(userId);
        if (existing) {
            if (existing.isAlive === 1) {
                throw new Error('User already has a living byte!');
            } else {
                // Remove the passed away byte to make room for a new one
                await dbManager.deleteByte(userId);
            }
        }

        // Use the builder to generate a default byte with starting stats
        const byte = ByteBuilder.default(userId, byteName).build();
        const s = byte.serialize();

        // Insert the serialized byte data into the database
        await dbManager.insertByte(s);

        console.log(
            `[System] Created new byte '${byte.name}' for user ${byte.ownerId}`,
        );

        return byte;
    }

    // Retrieves a byte from the database and reconstructs the Byte object
    async getByte(userId) {
        const parsedData = await dbManager.getByteByOwner(userId);
        if (!parsedData) return null;

        return new Byte(parsedData);
    }

    // Serializes and updates an existing byte in the database
    async saveByte(byte) {
        const s = byte.serialize();
        await dbManager.updateByte(s);
    }

    // Retrieves a player's inventory or creates a new empty player record
    async getPlayer(userId) {
        const data = await dbManager.getPlayer(userId);
        if (!data) {
            return new Player({
                id: userId.toString(),
                inventory: {},
                energy: 100,
            });
        }
        return new Player(data);
    }

    // Saves a player's inventory back to the database, inserting if it doesn't exist
    async savePlayer(player) {
        const s = player.serialize();
        await dbManager.savePlayer(s);
    }

    // Processes a single global tick for all active bytes
    async processTick(
        eventManager = null,
        itemManager = null,
        onEventCallback = null,
    ) {
        // Retrieve all currently living bytes
        const aliveBytesData = await dbManager.getAliveBytes();
        for (const parsedData of aliveBytesData) {
            const byte = new Byte(parsedData);

            // Process time-based decay for needs
            byte.tick();

            const player = await this.getPlayer(byte.ownerId);
            player.tick();

            if (eventManager) {
                // Determine time of day based on current server time
                const now = new Date();
                const hour = now.getHours();
                let timePhase = 'night';
                if (hour >= 6 && hour < 18) timePhase = 'day';
                else if (hour >= 18 && hour < 21) timePhase = 'evening';

                // Build the context for event generation
                const context = {
                    byte,
                    player,
                    timePhase,
                    dayOfWeek: now.getDay(),
                    itemManager,
                };

                // Attempt to trigger a random event
                const event = eventManager.getRandomEvent(context);
                if (event) {
                    const success = event.occur(context);
                    if (success) {
                        console.log(
                            `[Event] '${event.name}' occurred for byte of owner ${byte.ownerId}`,
                        );
                        if (onEventCallback) onEventCallback(byte, event);
                    }
                }
            }

            // Save the mutated state
            await this.saveByte(byte);
            await this.savePlayer(player);
        }
    }

    // Starts the continuous global game loop that drives time and events
    startGameLoop(
        tickIntervalMs = 60000,
        eventManager = null,
        itemManager = null,
        onEventCallback = null,
    ) {
        setInterval(async () => {
            await this.processTick(eventManager, itemManager, onEventCallback);
        }, tickIntervalMs);
    }
}

module.exports = GameManager;
