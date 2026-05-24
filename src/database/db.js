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
          id TEXT PRIMARY KEY,
          ownerId TEXT NOT NULL,
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
          lastInteraction TEXT NOT NULL,
          isAsleep INTEGER NOT NULL DEFAULT 0,
          generation INTEGER NOT NULL DEFAULT 0,
          bufferOverflow INTEGER NOT NULL DEFAULT 0
        )
        `);

        try {
            await this.db.exec(`ALTER TABLE bytes ADD COLUMN hediffs TEXT DEFAULT '{}'`);
        } catch (e) {
            // Column might already exist
        }

        // Table for persisting player data (e.g., inventory tracking)
        await this.db.exec(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          inventory TEXT NOT NULL,
          energy INTEGER NOT NULL,
          history TEXT DEFAULT '{}',
          maxBytes INTEGER DEFAULT 2,
          lastAction TEXT DEFAULT '',
          talents TEXT DEFAULT '{}',
          settings TEXT DEFAULT '{}',
          achievements TEXT DEFAULT '{}'
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
        
        try {
            await this.db.exec(`ALTER TABLE players ADD COLUMN hediffs TEXT DEFAULT '{}'`);
        } catch (e) {
            // Column might already exist
        }

        // Table for logging all game events for auditing and player history
        await this.db.exec(`
        CREATE TABLE IF NOT EXISTS event_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            playerId TEXT NOT NULL,
            byteId TEXT,
            timestamp TEXT NOT NULL,
            params TEXT
        )
        `);

        // Table for long-term storage of merged/dead bytes, keeping primitive stats for family trees
        await this.db.exec(`
        CREATE TABLE IF NOT EXISTS archived_bytes (
            id TEXT PRIMARY KEY,
            ownerId TEXT NOT NULL,
            name TEXT NOT NULL,
            byteClass TEXT NOT NULL,
            generation INTEGER NOT NULL,
            level INTEGER NOT NULL,
            birthDate TEXT NOT NULL,
            deathDate TEXT NOT NULL,
            archivedDate TEXT NOT NULL
        )
        `);

        try {
            await this.db.exec(`ALTER TABLE event_logs ADD COLUMN byteId TEXT`);
        } catch (e) {
            // Column might already exist
        }

        await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_bytes_ownerId ON bytes(ownerId);
        CREATE INDEX IF NOT EXISTS idx_bytes_alive_only ON bytes(ownerId) WHERE isAlive = 1;
        CREATE INDEX IF NOT EXISTS idx_players_lastAction ON players(lastAction);
        CREATE INDEX IF NOT EXISTS idx_event_logs_playerId ON event_logs(playerId);
        CREATE INDEX IF NOT EXISTS idx_event_logs_byteId ON event_logs(byteId);
        CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(type);
        CREATE INDEX IF NOT EXISTS idx_archived_bytes_ownerId ON archived_bytes(ownerId);
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
            isAsleep: data.isAsleep === 1,
            generation: data.generation || 0,
            bufferOverflow: data.bufferOverflow || 0,
            hediffs: data.hediffs ? (typeof data.hediffs === 'string' ? JSON.parse(data.hediffs) : data.hediffs) : {},
        };
    }

    // --- BYTE QUERIES ---

    async getBytesByOwner(ownerId) {
        const rows = await this.db.all(
            'SELECT * FROM bytes WHERE ownerId = ?',
            [ownerId.toString()],
        );
        return rows.map((row) => this._parseByteData(row));
    }

    async getAliveBytes() {
        const rows = await this.db.all('SELECT * FROM bytes WHERE isAlive = 1');
        return rows.map((row) => this._parseByteData(row));
    }

    async getOldDeadBytes(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const rows = await this.db.all(
            `SELECT * FROM bytes WHERE isAlive = 0 AND lastInteraction < ?`,
            [cutoffDate.toISOString()]
        );
        return rows.map((row) => this._parseByteData(row));
    }

    async deleteByte(id) {
        return this.db.run('DELETE FROM bytes WHERE id = ?', [id.toString()]);
    }

    async insertByte(s) {
        return this.db.run(
            `INSERT INTO bytes (id, ownerId, name, byteClass, needs, stats, skills, pools, room, isAlive, history, birthDate, lastInteraction, isAsleep, generation, bufferOverflow, hediffs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                s.id,
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
                s.isAsleep,
                s.generation,
                s.bufferOverflow,
                JSON.stringify(s.hediffs || {})
            ],
        );
    }

    async updateByte(s) {
        return this.db.run(
            `UPDATE bytes 
             SET name = ?, byteClass = ?, needs = ?, stats = ?, skills = ?, pools = ?, room = ?, isAlive = ?, history = ?, lastInteraction = ?, isAsleep = ?, generation = ?, bufferOverflow = ?, hediffs = ?
             WHERE id = ?`,
            [
                s.name,
                s.byteClass,
                JSON.stringify(s.needs),
                JSON.stringify(s.stats),
                JSON.stringify(s.skills),
                JSON.stringify(s.pools),
                s.room,
                s.isAlive,
                JSON.stringify(s.history),
                s.lastInteraction,
                s.isAsleep,
                s.generation,
                s.bufferOverflow,
                JSON.stringify(s.hediffs || {}),
                s.id,
            ],
        );
    }

    // --- PLAYER QUERIES ---

    _safeParse(val) {
        if (!val) return {};
        try {
            let parsed = JSON.parse(val);
            // Correctly unwrap double-stringified objects on the fly
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            return parsed || {};
        } catch (e) {
            return {};
        }
    }

    async getPlayer(id) {
        const data = await this.db.get('SELECT * FROM players WHERE id = ?', [
            id.toString(),
        ]);
        if (!data) return null;
        return {
            ...data,
            inventory: this._safeParse(data.inventory),
            energy: typeof data.energy === 'string' && data.energy.startsWith('{') ? this._safeParse(data.energy) : data.energy,
            history: this._safeParse(data.history),
            maxBytes: data.maxBytes || 2,
            lastAction: data.lastAction || new Date().toISOString(),
            talents: this._safeParse(data.talents),
            settings: this._safeParse(data.settings),
            achievements: this._safeParse(data.achievements),
            hediffs: this._safeParse(data.hediffs),
        };
    }

    async savePlayer(s) {
        return this.db.run(
            `INSERT INTO players (id, inventory, energy, history, maxBytes, lastAction, talents, settings, achievements, hediffs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET inventory = excluded.inventory, energy = excluded.energy, history = excluded.history, maxBytes = excluded.maxBytes, lastAction = excluded.lastAction, talents = excluded.talents, settings = excluded.settings, achievements = excluded.achievements, hediffs = excluded.hediffs`,
            [
                s.id,
                JSON.stringify(s.inventory),
                typeof s.energy === 'object' ? JSON.stringify(s.energy) : s.energy,
                JSON.stringify(s.history || {}),
                s.maxBytes,
                s.lastAction,
                JSON.stringify(s.talents || {}),
                JSON.stringify(s.settings || {}),
                JSON.stringify(s.achievements || {}),
                JSON.stringify(s.hediffs || {}),
            ]
        );
    }

    async getActivePlayers(sinceIsoString) {
        const rows = await this.db.all(
            'SELECT * FROM players WHERE lastAction >= ?',
            [sinceIsoString],
        );
        return rows.map((row) => ({
            ...row,
            inventory: this._safeParse(row.inventory),
            energy: typeof row.energy === 'string' && row.energy.startsWith('{') ? this._safeParse(row.energy) : row.energy,
            history: this._safeParse(row.history),
            maxBytes: row.maxBytes || 2,
            lastAction: row.lastAction || new Date().toISOString(),
            talents: this._safeParse(row.talents),
            settings: this._safeParse(row.settings),
            achievements: this._safeParse(row.achievements),
            hediffs: this._safeParse(row.hediffs),
        }));
    }

    async updatePlayerActivity(id) {
        const now = new Date().toISOString();
        return this.db.run(`UPDATE players SET lastAction = ? WHERE id = ?`, [
            now,
            id.toString(),
        ]);
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

    // --- EVENT LOG QUERIES ---

    async logEvent(type, playerId, byteId, params) {
        const now = new Date().toISOString();
        return this.db.run(
            `INSERT INTO event_logs (type, playerId, byteId, timestamp, params) VALUES (?, ?, ?, ?, ?)`,
            [type, playerId.toString(), byteId ? byteId.toString() : null, now, JSON.stringify(params)],
        );
    }

    async getEventLogs(playerId, limit, offset) {
        return this.db.all(
            `SELECT * FROM event_logs WHERE playerId = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            [playerId.toString(), limit, offset]
        );
    }

    async pruneOldEventLogs(days = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return this.db.run(
            `DELETE FROM event_logs WHERE timestamp < ?`,
            [cutoffDate.toISOString()]
        );
    }

    async insertArchivedByte(b) {
        return this.db.run(
            `INSERT INTO archived_bytes (id, ownerId, name, byteClass, generation, level, birthDate, deathDate, archivedDate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [b.id, b.ownerId, b.name, b.byteClass, b.generation, b.level, b.birthDate, b.deathDate, b.archivedDate]
        );
    }
}

module.exports = new DatabaseManager();
