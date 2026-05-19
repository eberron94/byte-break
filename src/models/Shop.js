const { checkRequirements } = require('../util/requirements');

class Shop {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.timeAvailable = data.timeAvailable || {};
        this.categories = data.categories || [];
        this.items = data.items || [];
        this.priceMultiplier =
            data.priceMultiplier !== undefined ? data.priceMultiplier : 1.0;
        this.sellMultiplier =
            data.sellMultiplier !== undefined ? data.sellMultiplier : 0.5;
        this.requirements = data.requirements || [];
        this.stock = data.stock || {};
    }

    canAppear(context = {}) {
        const { byte, player, timePhase, dayOfWeek } = context;

        // Check time availability
        if (
            this.timeAvailable.daysOfWeek &&
            !this.timeAvailable.daysOfWeek.includes(dayOfWeek)
        )
            return false;
        if (
            this.timeAvailable.timePhase &&
            !this.timeAvailable.timePhase.includes(timePhase)
        )
            return false;

        // Check prerequisites
        if (
            !checkRequirements(
                this.requirements,
                byte,
                player,
                context.itemManager,
                context,
            )
        ) {
            return false;
        }

        return true;
    }

    acceptsItem(item) {
        if (!item) return false;
        return (
            this.categories.includes(item.type) || this.items.includes(item.id)
        );
    }

    // Finds all items valid for this shop and applies the price multiplier
    getAvailableItems(itemManager, player) {
        const allItems = itemManager.getAllItems();
        return allItems
            .filter((item) => {
                if (item.cost === undefined) return false;
                if (item.type === 'key' && player && player.hasItem(item.id, 1))
                    return false;
                return this.acceptsItem(item);
            })
            .map((item) => {
                let remainingStock = undefined;
                if (this.stock[item.id] !== undefined) {
                    const bought =
                        player && player.history
                            ? player.history[`shop_${this.id}_${item.id}`] || 0
                            : 0;
                    remainingStock = Math.max(0, this.stock[item.id] - bought);
                }
                return {
                    ...item,
                    calculatedCost: Math.ceil(item.cost * this.priceMultiplier),
                    remainingStock: remainingStock,
                };
            });
    }
}

module.exports = Shop;
