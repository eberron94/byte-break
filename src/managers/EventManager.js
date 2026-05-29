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
    getAvailableEvents(context) {
        return this.getAllEvents().filter((event) => event.canOccur(context));
    }

    // Selects a valid random event by rolling against its configured probability
    getRandomEvent(context) {
        const events = this.getAvailableEvents(context);

        for (const event of events) {
            if (event.ticksPerCheck && context.locals.tickCounter) {
                const tpc = evaluateExpression(event.ticksPerCheck, context);
                // If tpc is greater than 1, only check on the appropriate tick interval
                if (tpc > 1 && context.locals.tickCounter % tpc !== 0) {
                    continue;
                }
            }

            if (event.diceCheck) {
                const poolSize = evaluateExpression(event.diceCheck.pool || 1, context);
                const requiredSuccesses = evaluateExpression(event.diceCheck.successes || 1, context);
                const threshold = evaluateExpression(event.diceCheck.threshold || 3, context);
                const sides = evaluateExpression(event.diceCheck.sides || 6, context);
                if (poolSize > 0) {
                    const rolls = LuckManager.rollCustomDice(poolSize, sides);
                    const successes = LuckManager.countSuccesses(rolls, threshold);
                    if (successes >= requiredSuccesses) {
                        return event;
                    }
                }
            } else if (event.probability !== undefined) {
                const evaluatedProb =
                    typeof event.probability === 'string'
                        ? evaluateExpression(
                              event.probability, context
                          )
                        : event.probability;
    
                if (LuckManager.checkEvent(evaluatedProb, context)) {
                    return event;
                }
            }
        }
        return null;
    }
}
module.exports = new EventManager();
