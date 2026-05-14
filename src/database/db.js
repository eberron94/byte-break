const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

/**
 * Handles all SQLite database connection and queries.
 */
class DatabaseManager {
    constructor() {
        this.db = null;
    }

    async init() {
        this.db = await open({
            filename: './bytes.db',
            driver: sqlite3.Database,
        });

        // Table for persisting digital monster data using JSON strings for nested objects
        await this.db.exec(`
        CREATE TABLE IF NOT EXISTS bytes (
          ownerId TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          byteClass TEXT NOT NULL,
          needs TEXT NOT NULL,
          stats TEXT NOT NULL,
          skills TEXT NOT NULL,
          pools TEXT NOT NULL,
          room TEXT NOT NULL,
          isAlive INTEGER NOT NULL,
          history TEXT NOT NULL,
          birthDate TEXT NOT NULL,
          lastInteraction TEXT NOT NULL
        )
        `);

        // Table for persisting player data (e.g., inventory tracking)
        await this.db.exec(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          inventory TEXT NOT NULL,
          energy INTEGER NOT NULL
        )
        `);

        // Ensure UI message tracking table exists for clean chat persistence
        await this.db.exec(`
        CREATE TABLE IF NOT EXISTS ui_messages (
            chatId TEXT PRIMARY KEY,
            messageId INTEGER,
            type TEXT
        )
        `);
    }

    // --- HELPERS ---

    _parseByteData(data) {
        if (!data) return null;
        return {
            ...data,
            ...JSON.parse(data.needs),
            ...JSON.parse(data.stats),
            ...JSON.parse(data.skills),
            ...JSON.parse(data.pools),
            history: JSON.parse(data.history),
        };
    }

    // --- BYTE QUERIES ---

    async getByteByOwner(ownerId) {
        const data = await this.db.get(
            'SELECT * FROM bytes WHERE ownerId = ?',
            [ownerId.toString()],
        );
        return this._parseByteData(data);
    }

    async getAliveBytes() {
        const rows = await this.db.all('SELECT * FROM bytes WHERE isAlive = 1');
        return rows.map((row) => this._parseByteData(row));
    }

    async deleteByte(ownerId) {
        return this.db.run('DELETE FROM bytes WHERE ownerId = ?', [
            ownerId.toString(),
        ]);
    }

    async insertByte(s) {
        return this.db.run(
            `INSERT INTO bytes (ownerId, name, byteClass, needs, stats, skills, pools, room, isAlive, history, birthDate, lastInteraction)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                s.ownerId,
                s.name,
                s.byteClass,
                JSON.stringify(s.needs),
                JSON.stringify(s.stats),
                JSON.stringify(s.skills),
                JSON.stringify(s.pools),
                s.room,
                s.isAlive,
                JSON.stringify(s.history),
                s.birthDate,
                s.lastInteraction,
            ],
        );
    }

    async updateByte(s) {
        return this.db.run(
            `UPDATE bytes 
             SET byteClass = ?, needs = ?, stats = ?, skills = ?, pools = ?, room = ?, isAlive = ?, history = ?, lastInteraction = ?
             WHERE ownerId = ?`,
            [
                s.byteClass,
                JSON.stringify(s.needs),
                JSON.stringify(s.stats),
                JSON.stringify(s.skills),
                JSON.stringify(s.pools),
                s.room,
                s.isAlive,
                JSON.stringify(s.history),
                s.lastInteraction,
                s.ownerId,
            ],
        );
    }

    // --- PLAYER QUERIES ---

    async getPlayer(id) {
        const data = await this.db.get('SELECT * FROM players WHERE id = ?', [
            id.toString(),
        ]);
        if (!data) return null;
        return {
            ...data,
            inventory: JSON.parse(data.inventory),
        };
    }

    async savePlayer(s) {
        return this.db.run(
            `INSERT INTO players (id, inventory, energy)
             VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET inventory = excluded.inventory, energy = excluded.energy`,
            [s.id, JSON.stringify(s.inventory), s.energy],
        );
    }

    // --- UI QUERIES ---

    async getUIMessage(chatId) {
        return this.db.get(
            'SELECT messageId, type FROM ui_messages WHERE chatId = ?',
            [chatId.toString()],
        );
    }

    async saveUIMessage(chatId, messageId, type) {
        return this.db.run(
            `INSERT INTO ui_messages (chatId, messageId, type)
             VALUES (?, ?, ?)
             ON CONFLICT(chatId) DO UPDATE SET messageId = excluded.messageId, type = excluded.type`,
            [chatId.toString(), messageId, type],
        );
    }
}

module.exports = new DatabaseManager();
