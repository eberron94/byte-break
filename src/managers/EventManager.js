const Event = require('../models/Event');
const eventsData = require('../../data/events.json');

/**
 * Loads and manages random events from the JSON configuration file.
 */
class EventManager {
    constructor() {
        this.events = new Map();
        this.load();
    }

    // Ingests events from the data store into memory
    load() {
        eventsData.forEach((data) => {
            this.events.set(data.id, new Event(data));
        });
    }

    // Finds a single event by ID
    getEvent(id) {
        return this.events.get(id);
    }

    // Returns all loaded events as an array
    getAllEvents() {
        return Array.from(this.events.values());
    }

    /**
     * Filters down the events to only those that can currently occur
     * based on the context's time of day, pet status, and player inventory.
     */
    getAvailableEvents(context = {}) {
        return this.getAllEvents().filter((event) => event.canOccur(context));
    }

    // Selects a valid random event by rolling against its configured probability
    getRandomEvent(context = {}) {
        const events = this.getAvailableEvents(context);
        for (const event of events) {
            if (Math.random() < event.probability) {
                return event;
            }
        }
        return null;
    }
}
module.exports = EventManager;
