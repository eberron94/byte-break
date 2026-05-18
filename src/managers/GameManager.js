const dbManager = require('../database/db');
const { Byte, ByteBuilder } = require('../models/Byte');
const Player = require('../models/Player');
const EventEmitter = require('events');
const GameEvents = require('../util/GameEvents');
const MergeManager = require('./MergeManager');
const SpawnManager = require('./SpawnManager');

class GameManager extends EventEmitter {
    constructor() {
        super();
        
        // Centralize console logging for all GameEvents
        Object.values(GameEvents).forEach((eventName) => {
            this.on(eventName, (...args) => {
                const parsedArgs = args.map((arg) => {
                    if (arg && typeof arg === 'object') {
                        if (arg.name) return `'${arg.name}'`;
                        if (arg.id) return `'${arg.id}'`;
                        return JSON.stringify(arg);
                    }
                    return arg;
                });
                console.log(`[GameEvent] ${eventName} -> ${parsedArgs.join(' | ')}`);
            });
        });
    }

    // Factory method to initialize the database before creating the manager
    static async create() {
        await dbManager.init();
        return new GameManager();
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
        const parsedDataArray = await dbManager.getBytesByOwner(userId);
        return parsedDataArray.map((data) => new Byte(data));
    }

    // Returns the player's currently active (awake) byte, or null if all are in stasis
    async getByte(userId) {
        const bytes = await this.getBytes(userId);
        if (!bytes || bytes.length === 0) return null;
        return bytes.find((b) => !b.isAsleep && b.isAlive) || null;
    }

    // Serializes and updates an existing byte in the database
    async saveByte(byte) {
        const s = byte.serialize();
        await dbManager.updateByte(s);
    }

    // Deletes a byte permanently from the database
    async deleteByte(userId, byteId) {
        const bytes = await this.getBytes(userId);
        const byteToDelete = bytes.find((b) => b.id === byteId);
        if (!byteToDelete) throw new Error('Byte not found.');

        await dbManager.deleteByte(byteId);
        this.emit(GameEvents.BYTE_DELETED, userId, byteToDelete);
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

    // Records an active action taken by the player
    async recordPlayerActivity(userId) {
        await dbManager.updatePlayerActivity(userId);
    }

    // Checks for players active in the last hour and rewards them with energy
    async rewardActivePlayers() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const activePlayerData = await dbManager.getActivePlayers(oneHourAgo);
        const activePlayersCount = activePlayerData.length;
        if (activePlayersCount === 0) return;

        const energyReward = Math.min(Math.ceil(100 / activePlayersCount), 20);

        for (const data of activePlayerData) {
            const player = new Player(data);
            const initialEnergy = player.energy.value;
            player.energy.increase(energyReward);
            const actualGain = player.energy.value - initialEnergy;
            await this.savePlayer(player);
            if (actualGain > 0) {
                this.emit(GameEvents.ENERGY_REWARD, player.id, actualGain);
            }
        }
    }

    // Processes a single global tick for all active bytes
    async processTick(eventManager = null, itemManager = null) {
        this.tickCounter = (this.tickCounter || 0) + 1;
        if (this.tickCounter % 10 === 0) {
            await this.rewardActivePlayers();
        }

        const tickedPlayers = new Set();

        // Retrieve all currently living bytes
        const aliveBytesData = await dbManager.getAliveBytes();
        for (const parsedData of aliveBytesData) {
            const byte = new Byte(parsedData);
            const player = await this.getPlayer(byte.ownerId);

            if (byte.isAsleep) {
                if (this.tickCounter % 10 === 0) {
                    byte.tick(player);
                }
            } else {
                byte.tick(player);
            }

            if (!tickedPlayers.has(player.id)) {
                player.tick(byte);
                tickedPlayers.add(player.id);
            }

            if (eventManager && !byte.isAsleep) {
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
                        this.emit(GameEvents.RANDOM_EVENT, byte, event);
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
    ) {
        setInterval(async () => {
            await this.processTick(eventManager, itemManager);
        }, tickIntervalMs);
    }
}

module.exports = GameManager;
