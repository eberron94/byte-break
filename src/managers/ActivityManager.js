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
        activitiesData.forEach((data) => {
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

    // Returns a filtered list of activities that the given pet and player can currently perform
    getPerformableActivities(
        pet,
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
            activity.canPerform(pet, player, itemManager),
        );
    }
}
module.exports = ActivityManager;
