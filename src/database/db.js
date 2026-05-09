const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

/**
 * Initializes the SQLite database connection and defines the required schema.
 */
async function initDB() {
    const db = await open({
        filename: './pets.db',
        driver: sqlite3.Database,
    });

    // Table for persisting virtual pet data using JSON strings for nested objects
    await db.exec(`
    CREATE TABLE IF NOT EXISTS pets (
      ownerId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      needs TEXT NOT NULL,
      stats TEXT NOT NULL,
      skills TEXT NOT NULL,
      pools TEXT NOT NULL,
      energy INTEGER NOT NULL,
      room TEXT NOT NULL,
      isAlive INTEGER NOT NULL,
      history TEXT NOT NULL,
      birthDate TEXT NOT NULL,
      lastInteraction TEXT NOT NULL
    )
  `);
    // Table for persisting player data (e.g., inventory tracking)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      inventory TEXT NOT NULL
    )
  `);
    return db;
}

module.exports = initDB;
