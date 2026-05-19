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
        this.requirements = data.requirements || {};
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
        const req = this.requirements;
        if (!req || Object.keys(req).length === 0) return true;

        const categories = ['needs', 'stats', 'skills', 'pools'];
        for (const category of categories) {
            if (req[category] && byte && byte[category]) {
                for (const [key, range] of Object.entries(req[category])) {
                    const item = byte[category][key];
                    if (!item) continue;
                    if (item.value !== undefined) {
                        if (range.min !== undefined && item.value < range.min)
                            return false;
                        if (range.max !== undefined && item.value > range.max)
                            return false;
                    }
                }
            }
        }

        if (req.energy && player && player.energy) {
            if (
                req.energy.min !== undefined &&
                player.energy.value < req.energy.min
            )
                return false;
            if (
                req.energy.max !== undefined &&
                player.energy.value > req.energy.max
            )
                return false;
        }

        if (req.history && byte && byte.history) {
            for (const [key, range] of Object.entries(req.history)) {
                const historyValue = byte.history[key] || 0;
                if (range.min !== undefined && historyValue < range.min)
                    return false;
                if (range.max !== undefined && historyValue > range.max)
                    return false;
            }
        }

        return true;
    }

    acceptsItem(item) {
        if (!item) return false;
        return this.categories.includes(item.type) || this.items.includes(item.id);
    }

    // Finds all items valid for this shop and applies the price multiplier
    getAvailableItems(itemManager, player) {
        const allItems = itemManager.getAllItems();
        return allItems
            .filter((item) => {
                if (item.cost === undefined) return false;
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
