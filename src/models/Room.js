const { checkRequirements } = require('../util/requirements');

class Room {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.allowedActivities = data.allowedActivities || [];
        this.tickEffects = data.tickEffects || null;
        this.requirements = data.requirements || [];
    }

    canEnter(context) {
        return checkRequirements(this.requirements, context);
    }

    toWeb(context) {
        const ActivityManager = require('../managers/ActivityManager');
        const GameObjectManager = require('../managers/GameObjectManager');

        const activities = this.allowedActivities
            .map((actId) => {
                const activity = ActivityManager.getActivity(actId);
                return activity ? activity.toWeb(context) : null;
            })
            .filter(Boolean);

        return {
            id: this.id,
            name: this.name,
            description: this.description,
            canEnter: this.canEnter(context),
            formattedRequirements: GameObjectManager.formatRequirementsList(
                this.requirements,
            ),
            formattedTickEffects: this.tickEffects
                ? GameObjectManager.formatEffectsList(this.tickEffects)
                : null,
            activities,
        };
    }
}

module.exports = Room;
