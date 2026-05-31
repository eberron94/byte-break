const { checkRequirements } = require('../util/requirements');
const GameObjectManager = require('../managers/GameObjectManager');
const GameContext = require('./GameContext');

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
        this.defaultStock = data.defaultStock;
    }

    canAppear(context) {
        const { timePhase, dayOfWeek } = context.locals;

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
        if (!checkRequirements(this.requirements, context)) {
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

    buyItem(byte, player, item) {
        const context = new GameContext(byte, player);

        if (!this.canAppear(context)) {
            throw new Error('Shop is currently closed');
        }
        if (!this.acceptsItem(item)) {
            throw new Error('Shop does not trade this item');
        }

        if (item.cost === undefined) {
            throw new Error('Item is not for sale');
        }

        const calculatedCost = Math.ceil(item.cost * this.priceMultiplier);

        const totalBits = byte.pools.bits.value + (byte.bufferOverflow || 0);
        if (totalBits < calculatedCost) {
            throw new Error('Insufficient bits');
        }

        const itemStock =
            this.stock[item.id] !== undefined
                ? this.stock[item.id]
                : this.defaultStock;
        if (itemStock !== undefined) {
            const bought = player.history[`shop_${this.id}_${item.id}`] || 0;
            if (bought >= itemStock) {
                throw new Error('Item is sold out');
            }
        }

        if (
            item.maxCount !== undefined &&
            (player.inventory[item.id] || 0) >= item.maxCount
        ) {
            throw new Error('Inventory full for this item');
        }

        if (item.type === 'key' && player.hasItem(item.id, 1)) {
            throw new Error('You already own this key');
        }

        // Deduct cost and add item
        if (byte.bufferOverflow && byte.bufferOverflow > 0) {
            if (byte.bufferOverflow >= calculatedCost) {
                byte.bufferOverflow -= calculatedCost;
            } else {
                const remainingCost = calculatedCost - byte.bufferOverflow;
                byte.bufferOverflow = 0;
                byte.pools.bits.decrease(remainingCost);
            }
        } else {
            byte.pools.bits.decrease(calculatedCost);
        }
        player.addItem(item.id, 1);

        if (itemStock !== undefined) {
            player.recordHistory(`shop_${this.id}_${item.id}`);
        }

        return calculatedCost;
    }

    sellItem(byte, player, item) {
        const context = new GameContext(byte, player);

        if (!this.canAppear(context)) {
            throw new Error('Shop is currently closed');
        }
        if (!this.acceptsItem(item)) {
            throw new Error('Shop does not trade this item');
        }

        if (!player.hasItem(item.id, 1)) {
            throw new Error('Item not in inventory');
        }

        if (item.cost === undefined) {
            throw new Error('Item cannot be sold');
        }

        const sellPrice = Math.floor(item.cost * this.sellMultiplier);

        const wasFull = byte.pools.bits.value >= byte.pools.bits.maxValue;
        player.removeItem(item.id, 1);
        byte.pools.bits.increase(sellPrice);
        if (!wasFull && byte.pools.bits.value >= byte.pools.bits.maxValue) {
            byte.pendingEvents.push({
                event: 'BIT_BUFFER_FULL',
                args: [player.id, byte],
            });
        }

        return sellPrice;
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
                const itemStock =
                    this.stock[item.id] !== undefined
                        ? this.stock[item.id]
                        : this.defaultStock;
                if (itemStock !== undefined) {
                    const bought =
                        player && player.history
                            ? player.history[`shop_${this.id}_${item.id}`] || 0
                            : 0;
                    remainingStock = Math.max(0, itemStock - bought);
                }
                return {
                    ...item,
                    calculatedCost: Math.ceil(item.cost * this.priceMultiplier),
                    remainingStock: remainingStock,
                    formattedEffects:
                        item.effects && item.effects.length > 0
                            ? GameObjectManager.formatEffectsList(item.effects)
                            : null,
                };
            });
    }

    toWeb(player) {
        const ItemManager = require('../managers/ItemManager');
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            items: this.getAvailableItems(ItemManager, player),
        };
    }
}

module.exports = Shop;
