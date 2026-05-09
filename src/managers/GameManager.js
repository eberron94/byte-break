const initDB = require('../database/db');
const { Pet, PetBuilder } = require('../models/Pet');
const Player = require('../models/Player');

class GameManager {
    constructor(db) {
        // Store the initialized SQLite database connection
        this.db = db;
    }

    // Factory method to initialize the database before creating the manager
    static async create() {
        const db = await initDB();
        return new GameManager(db);
    }

    // Creates a brand new pet for a user and saves it to the database
    async createPet(userId, petName) {
        const existing = await this.db.get(
            'SELECT * FROM pets WHERE ownerId = ?',
            [userId.toString()],
        );
        if (existing) {
            throw new Error('User already has a pet!');
        }

        // Use the builder to generate a default pet with starting stats
        const pet = PetBuilder.default(userId, petName).build();
        const s = pet.serialize();

        // Insert the serialized pet data into the database
        await this.db.run(
            `
      INSERT INTO pets (ownerId, name, needs, stats, skills, pools, energy, room, isAlive, history, birthDate, lastInteraction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
            [
                s.ownerId,
                s.name,
                s.needs,
                s.stats,
                s.skills,
                s.pools,
                s.energy,
                s.room,
                s.isAlive,
                s.history,
                s.birthDate,
                s.lastInteraction,
            ],
        );

        console.log(
            `[System] Created new pet '${pet.name}' for user ${pet.ownerId}`,
        );

        return pet;
    }

    // Retrieves a pet from the database and reconstructs the Pet object
    async getPet(userId) {
        const data = await this.db.get('SELECT * FROM pets WHERE ownerId = ?', [
            userId.toString(),
        ]);
        if (!data) return null;

        // Parse the serialized JSON strings back into objects so the Pet constructor can map them
        const parsedData = {
            ...data,
            ...JSON.parse(data.needs),
            ...JSON.parse(data.stats),
            ...JSON.parse(data.skills),
            ...JSON.parse(data.pools),
        };

        return new Pet(parsedData);
    }

    // Serializes and updates an existing pet in the database
    async savePet(pet) {
        const s = pet.serialize();
        await this.db.run(
            `
      UPDATE pets 
      SET needs = ?, stats = ?, skills = ?, pools = ?, energy = ?, room = ?, isAlive = ?, history = ?, lastInteraction = ?
      WHERE ownerId = ?
    `,
            [
                s.needs,
                s.stats,
                s.skills,
                s.pools,
                s.energy,
                s.room,
                s.isAlive,
                s.history,
                s.lastInteraction,
                s.ownerId,
            ],
        );
    }

    // Retrieves a player's inventory or creates a new empty player record
    async getPlayer(userId) {
        const data = await this.db.get('SELECT * FROM players WHERE id = ?', [
            userId.toString(),
        ]);
        if (!data) {
            return new Player({ id: userId.toString(), inventory: '{}' });
        }
        return new Player(data);
    }

    // Saves a player's inventory back to the database, inserting if it doesn't exist
    async savePlayer(player) {
        const s = player.serialize();
        await this.db.run(
            `
      INSERT INTO players (id, inventory)
      VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET inventory = excluded.inventory
    `,
            [s.id, s.inventory],
        );
    }

    // Starts the continuous global game loop that drives time and events
    startGameLoop(
        tickIntervalMs = 60000,
        eventManager = null,
        itemManager = null,
    ) {
        setInterval(async () => {
            // Retrieve all currently living pets
            const alivePetsData = await this.db.all(
                'SELECT * FROM pets WHERE isAlive = 1',
            );
            for (const data of alivePetsData) {
                // Parse the serialized JSON strings back into objects to prevent data corruption
                const parsedData = {
                    ...data,
                    ...JSON.parse(data.needs),
                    ...JSON.parse(data.stats),
                    ...JSON.parse(data.skills),
                    ...JSON.parse(data.pools),
                };
                const pet = new Pet(parsedData);

                // Process time-based decay for needs
                pet.tick();

                const player = await this.getPlayer(pet.ownerId);

                if (eventManager) {
                    // Determine time of day based on current server time
                    const now = new Date();
                    const hour = now.getHours();
                    let timePhase = 'night';
                    if (hour >= 6 && hour < 18) timePhase = 'day';
                    else if (hour >= 18 && hour < 21) timePhase = 'evening';

                    // Build the context for event generation
                    const context = {
                        pet,
                        player,
                        timePhase,
                        dayOfWeek: now.getDay(),
                        itemManager,
                    };

                    // Attempt to trigger a random event
                    const event = eventManager.getRandomEvent(context);
                    if (event) {
                        event.occur(context);
                        console.log(
                            `[Event] '${event.name}' occurred for pet of owner ${pet.ownerId}`,
                        );
                    }
                }

                // Save the mutated state
                await this.savePet(pet);
                await this.savePlayer(player);
            }
        }, tickIntervalMs);
    }
}

module.exports = GameManager;
