const Event = require('../models/Event');
const eventsData = require('../../data/events.json');
const LuckManager = require('./LuckManager');
const { evaluateExpression } = require('../util/effects');

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
        if (!Array.isArray(eventsData)) {
            console.error(
                '[EventManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        eventsData.forEach((data, index) => {
            if (!data.id || !data.name) {
                console.warn(
                    `[EventManager] Skipping invalid event at index ${index}: Missing required 'id' or 'name'`,
                );
                return;
            }
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

        // Extract context variables for dynamic probability evaluation
        const locals = { ...context, ...(context.locals || {}) };
        delete locals.byte;
        delete locals.player;

        for (const event of events) {
            if (event.ticksPerCheck && context.tickCounter) {
                const tpc = evaluateExpression(
                    event.ticksPerCheck,
                    context.byte,
                    context.player,
                    locals,
                );
                // If tpc is greater than 1, only check on the appropriate tick interval
                if (tpc > 1 && context.tickCounter % tpc !== 0) {
                    continue;
                }
            }

            const evaluatedProb =
                typeof event.probability === 'string'
                    ? evaluateExpression(
                          event.probability,
                          context.byte,
                          context.player,
                          locals,
                      )
                    : event.probability;

            if (LuckManager.checkEvent(evaluatedProb, context)) {
                return event;
            }
        }
        return null;
    }
}
module.exports = new EventManager();
