const Activity = require('../models/Activity');
const activitiesData = require('../../data/activities.json');

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
        itemManager,
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
            activity.canPerform(byte, player, itemManager),
        );
    }

    // Formats the inline keyboard button for an activity, appending web parameters if needed
    getActivityButton(activity, webAppUrl) {
        if (activity.isWebView && webAppUrl) {
            const separator = webAppUrl.includes('?') ? '&' : '?';
            return {
                text: `📱 ${activity.name}`,
                web_app: {
                    url: `${webAppUrl}${separator}activity=${activity.id}`,
                },
            };
        }
        return {
            text: activity.name,
            callback_data: `act_${activity.id}`,
        };
    }
}
module.exports = new ActivityManager();
