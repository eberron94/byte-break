const dbManager = require('../database/db');
const { Byte, ByteBuilder } = require('../models/Byte');
const Player = require('../models/Player');
const EventEmitter = require('events');
const GameEvents = require('../util/GameEvents');
const MergeManager = require('./MergeManager');
const SpawnManager = require('./SpawnManager');
const { getTimeContext } = require('../util/time');

class GameManager extends EventEmitter {
    constructor() {
        super();

        // Centralize console logging for all GameEvents
        Object.values(GameEvents).forEach((eventName) => {
            if (typeof eventName === 'string') {
                this.on(eventName, (...args) => {
                    const parsedArgs = args.map((arg) => {
                        if (arg && typeof arg === 'object') {
                            if (arg.name) return `'${arg.name}'`;
                            if (arg.id) return `'${arg.id}'`;
                            try {
                                return JSON.stringify(arg);
                            } catch (err) {
                                return '[Complex Object]';
                            }
                        }
                        return arg;
                    });
                    console.log(
                        `[GameEvent] ${eventName} -> ${parsedArgs.join(' | ')}`,
                    );
                });
            }
        });
    }

    // Factory method to initialize the database before creating the manager
    static async create() {
        try {
            await dbManager.init();
            return new GameManager();
        } catch (error) {
            console.error(
                '[GameManager] Failed to initialize database:',
                error,
            );
            throw error;
        }
    }

    // Returns the dynamic energy cost for merging bytes
    getMergeCost(player) {
        return MergeManager.getMergeCost(player);
    }

    // Creates a brand new byte for a user and saves it to the database
    async createByte(userId, byteName, byteClass = 'demo') {
        return await SpawnManager.spawnByte(this, userId, byteName, byteClass);
    }

    // Merges two bytes to create a stronger child byte
    async mergeBytes(userId, byte1Id, byte2Id, newName, player = null) {
        return await MergeManager.mergeBytes(
            this,
            userId,
            byte1Id,
            byte2Id,
            newName,
            player,
        );
    }

    // Returns all bytes a user currently owns
    async getBytes(userId) {
        try {
            const parsedDataArray = await dbManager.getBytesByOwner(userId);
            return (parsedDataArray || []).map((data) => new Byte(data));
        } catch (error) {
            console.error(
                `[GameManager] Failed to fetch bytes for user ${userId}:`,
                error,
            );
            throw error;
        }
    }

    // Returns the player's currently active (awake) byte, or null if all are in stasis
    async getByte(userId) {
        const bytes = await this.getBytes(userId);
        if (!bytes || bytes.length === 0) return null;
        return bytes.find((b) => !b.isAsleep && b.isAlive) || null;
    }

    // Serializes and updates an existing byte in the database
    async saveByte(byte) {
        try {
            const s = byte.serialize();
            await dbManager.updateByte(s);
        } catch (error) {
            console.error(
                `[GameManager] Failed to save byte ${byte.id}:`,
                error,
            );
            throw error;
        }
    }

    // Deletes a byte permanently from the database
    async deleteByte(userId, byteId) {
        try {
            const bytes = await this.getBytes(userId);
            const byteToDelete = bytes.find((b) => b.id === byteId);
            if (!byteToDelete) throw new Error('Byte not found.');

            await dbManager.deleteByte(byteId);
            this.emit(GameEvents.BYTE_DELETED, userId, byteToDelete);
        } catch (error) {
            console.error(
                `[GameManager] Failed to delete byte ${byteId}:`,
                error,
            );
            throw error;
        }
    }

    // Retrieves a player's inventory or creates a new empty player record
    async getPlayer(userId) {
        try {
            const data = await dbManager.getPlayer(userId);
            if (!data) {
                return new Player({
                    id: userId.toString(),
                    inventory: {},
                    energy: 100,
                });
            }
            return new Player(data);
        } catch (error) {
            console.error(
                `[GameManager] Failed to fetch player ${userId}:`,
                error,
            );
            throw error;
        }
    }

    // Saves a player's inventory back to the database, inserting if it doesn't exist
    async savePlayer(player) {
        try {
            const s = player.serialize();
            await dbManager.savePlayer(s);
        } catch (error) {
            console.error(
                `[GameManager] Failed to save player ${player.id}:`,
                error,
            );
            throw error;
        }
    }

    // Records an active action taken by the player
    async recordPlayerActivity(userId) {
        try {
            await dbManager.updatePlayerActivity(userId);
        } catch (error) {
            console.error(
                `[GameManager] Failed to record activity for user ${userId}:`,
                error,
            );
            throw error;
        }
    }

    // Checks for players active in the last hour and rewards them with energy
    async rewardActivePlayers() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        let activePlayerData;
        try {
            activePlayerData = await dbManager.getActivePlayers(oneHourAgo);
        } catch (error) {
            console.error(
                '[GameManager] Failed to fetch active players for rewards:',
                error,
            );
            return;
        }

        if (!activePlayerData || !Array.isArray(activePlayerData)) return;
        const activePlayersCount = activePlayerData.length;
        if (activePlayersCount === 0) return;

        const energyReward = Math.min(Math.ceil(100 / activePlayersCount), 20);

        for (const data of activePlayerData) {
            try {
                // Fetch the latest player state to avoid overwriting recent activity with an old snapshot
                const player = await this.getPlayer(data.id);
                const initialEnergy = player.energy.value;
                player.energy.increase(energyReward);
                const actualGain = player.energy.value - initialEnergy;
                await this.savePlayer(player);
                if (actualGain > 0) {
                    this.emit(GameEvents.ENERGY_REWARD, player.id, actualGain);
                }
            } catch (err) {
                console.error(
                    `[GameManager] Error rewarding player ${data.id}:`,
                    err,
                );
            }
        }
    }

    // Processes a single global tick for all active bytes
    async processTick(eventManager = null) {
        this.tickCounter = (this.tickCounter || 0) + 1;
        if (this.tickCounter % 10 === 0) {
            await this.rewardActivePlayers();
        }

        const tickedPlayers = new Set();

        // Retrieve all currently living bytes
        let aliveBytesData;
        try {
            aliveBytesData = await dbManager.getAliveBytes();
        } catch (error) {
            console.error(
                '[GameManager] Failed to fetch alive bytes for tick:',
                error,
            );
            return;
        }

        if (!aliveBytesData || !Array.isArray(aliveBytesData)) return;

        for (const parsedData of aliveBytesData) {
            try {
                // Use Promise.all to fetch the most up-to-date state immediately before mutation.
                // This eliminates the wide race condition gap caused by processing stale data
                // from the initial bulk getAliveBytes() snapshot.
                const [player, bytes] = await Promise.all([
                    this.getPlayer(parsedData.ownerId),
                    this.getBytes(parsedData.ownerId),
                ]);

                const byte = bytes.find((b) => b.id === parsedData.id);
                if (!byte) continue; // Byte might have been deleted or merged during the tick gap

                if (byte.isAsleep) {
                    if (this.tickCounter % 10 === 0) {
                        byte.tick(player, this.tickCounter);
                    }
                } else {
                    byte.tick(player, this.tickCounter);
                }

                if (!tickedPlayers.has(player.id)) {
                    player.tick(byte);
                    tickedPlayers.add(player.id);
                }

                if (eventManager && !byte.isAsleep) {
                    const timeContext = getTimeContext();

                    // Build the context for event generation
                    const context = {
                        byte,
                        player,
                        ...timeContext,
                        tickCounter: this.tickCounter,
                    };

                    // Attempt to trigger a random event
                    const event = eventManager.getRandomEvent(context);
                    if (event) {
                        const success = event.occur(context);
                        if (success) {
                            this.emit(GameEvents.RANDOM_EVENT, byte, event);
                        }
                    }
                }

                // Save the mutated state concurrently to minimize write-gap
                await Promise.all([
                    this.saveByte(byte),
                    this.savePlayer(player),
                ]);
            } catch (err) {
                console.error(
                    `[GameManager] Error processing tick for byte ${parsedData.id}:`,
                    err,
                );
            }
        }
    }

    // Starts the continuous global game loop that drives time and events
    startGameLoop(
        tickIntervalMs = 60000,
        eventManager = null,
    ) {
        setInterval(async () => {
            try {
                await this.processTick(eventManager);
            } catch (error) {
                console.error(
                    '[GameManager] Fatal error during global tick:',
                    error,
                );
            }
        }, tickIntervalMs);
    }
}

module.exports = GameManager;
