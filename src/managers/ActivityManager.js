const Activity = require('../models/Activity');
const activitiesData = require('../../data/activities.json');
const { calculateEffects } = require('../util/effects');
const { getTimeContext } = require('../util/time');

/**
 * Loads and manages all activities available in the game from JSON configuration.
 */
class ActivityManager {
    constructor() {
        this.activities = new Map();
        this.load();
    }

    // Loads activities from the JSON source file into memory
    load() {
        if (!Array.isArray(activitiesData)) {
            console.error(
                '[ActivityManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        activitiesData.forEach((data, index) => {
            if (!data.id || !data.name) {
                console.warn(
                    `[ActivityManager] Skipping invalid activity at index ${index}: Missing required 'id' or 'name'`,
                );
                return;
            }
            this.activities.set(data.id, new Activity(data));
        });
    }

    // Retrieves an activity by its unique identifier
    getActivity(id) {
        return this.activities.get(id);
    }

    // Retrieves all loaded activities as an array
    getAllActivities() {
        return Array.from(this.activities.values());
    }

    // Returns a filtered list of activities that the given byte and player can currently perform
    getPerformableActivities(
        byte,
        player,
        allowedActivityIds = null,
    ) {
        let activities = this.getAllActivities();

        // Filter by explicitly allowed IDs (e.g., restricted by current room)
        if (allowedActivityIds) {
            activities = activities.filter((activity) =>
                allowedActivityIds.includes(activity.id),
            );
        }

        // Final check to see if the game state meets prerequisites
        return activities.filter((activity) =>
            activity.canPerform(byte, player),
        );
    }

    // Formats the inline keyboard button for an activity, appending web parameters if needed
    getActivityButton(activity, byte = null, player = null) {
        const webAppUrl = process.env.WEB_APP_URL;
        let energyCostStr = '';
        if (activity.effects && activity.effects.energy) {
            const locals = getTimeContext();
            const effects = calculateEffects(
                activity.effects,
                byte,
                player,
                locals,
            );
            if (effects.energy < 0) {
                energyCostStr = ` (-${Math.abs(effects.energy)} ε)`;
            } else if (effects.energy > 0) {
                energyCostStr = ` (+${effects.energy} ε)`;
            }
        }

        if (activity.isWebView && webAppUrl) {
            const separator = webAppUrl.includes('?') ? '&' : '?';
            return {
                text: `📱 ${activity.name}${energyCostStr}`,
                web_app: {
                    url: `${webAppUrl}${separator}activity=${activity.id}`,
                },
            };
        }
        return {
            text: `${activity.isMinigame ? '🎮 ' : ''}${activity.name}${energyCostStr}`,
            callback_data: `act_${activity.id}`,
        };
    }
}
module.exports = new ActivityManager();
