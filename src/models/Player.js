const Energy = require('./Energy');
const AchievementPoints = require('./pools/AchievementPoints');
const ItemManager = require('../managers/ItemManager');

/**
 * Represents a Telegram user, tracking their id and personal inventory.
 */
class Player {
    constructor(data) {
        this.id = data.id.toString();
        this.inventory = data.inventory || {};
        const energyData =
            typeof data.energy === 'object' && data.energy !== null
                ? data.energy
                : {
                      value: data.energy !== undefined ? data.energy : 100,
                      maxValue: 100,
                  };
        this.energy = new Energy(energyData.value, energyData.maxValue);

        this.joinDate = data.joinDate ? new Date(data.joinDate) : new Date();

        this.history = data.history || {};
        this.maxBytes = data.maxBytes || 2;
        this.lastAction = data.lastAction
            ? new Date(data.lastAction)
            : new Date();
        this.achievementPoints = new AchievementPoints(
            {
                progress: data.achievements || {},
            },
            this,
        );
        this.talents = data.talents || {};
        this.settings = data.settings || {};
        this.hediffs = data.hediffs || {};
        this.pendingEvents = [];

        // Handle daily resets (resets shop stock at UTC midnight)
        const today = new Date().toISOString().split('T')[0];
        if (this.history['last_login_date'] !== today) {
            for (const key of Object.keys(this.history)) {
                if (key.startsWith('shop_')) {
                    delete this.history[key];
                }
            }
            this.history['last_login_date'] = today;
        }
    }

    // Restores energy over time
    tick(context = null) {
        const wasFull = this.energy.value >= this.energy.maxValue;
        this.energy.increase(1);

        if (!wasFull && this.energy.value >= this.energy.maxValue) {
            this.pendingEvents.push({ event: 'ENERGY_FULL', args: [this.id] });
        }

        if (this.hediffs && context) {
            // Lazy load utilities to prevent circular dependencies inside the tick loop
            const HediffManager = require('../managers/HediffManager');
            const GameContext = require('./GameContext');
            const {
                calculateEffects,
                applyEffects,
                evaluateExpression,
            } = require('../util/effects');
            const { checkRequirements } = require('../util/requirements');

            for (const [hId, hData] of Object.entries(this.hediffs)) {
                const hDef = HediffManager.getHediff(hId);
                if (!hDef) continue;

                hData.ticksAlive = (hData.ticksAlive || 0) + 1;

                const hediffContext = new GameContext(context.byte, this, {
                    ...context.locals,
                    stacks: hData.stacks,
                    ticksAlive: hData.ticksAlive,
                });

                let shouldDecay = false;
                if (hDef.decay) {
                    if (
                        hDef.decay.requirements &&
                        checkRequirements(
                            hDef.decay.requirements,
                            hediffContext,
                        )
                    ) {
                        shouldDecay = true;
                    } else if (hDef.decay.ticks !== undefined) {
                        const decayTicks = evaluateExpression(
                            hDef.decay.ticks,
                            hediffContext,
                        );
                        if (hData.ticksAlive >= decayTicks) {
                            shouldDecay = true;
                        }
                    }
                }

                if (shouldDecay) {
                    const action = hDef.decay.action || 'remove';
                    this.applyHediffs([{ id: hId, action }]);
                }

                if (this.hediffs[hId] && hDef.tickEffects) {
                    const activeTickEffects = hDef.tickEffects.filter(
                        (effect) => {
                            const tpt =
                                effect.ticksPerTrigger !== undefined
                                    ? evaluateExpression(
                                          effect.ticksPerTrigger,
                                          hediffContext,
                                      )
                                    : 1;
                            return (
                                tpt <= 1 ||
                                hediffContext.locals.tickCounter % tpt === 0
                            );
                        },
                    );
                    if (activeTickEffects.length > 0) {
                        const calculatedEffects = calculateEffects(
                            activeTickEffects,
                            hediffContext,
                        );
                        applyEffects(calculatedEffects, hediffContext);
                    }
                }
            }
        }
    }

    applyHediffs(hediffList) {
        const HediffManager = require('../managers/HediffManager');
        for (const h of hediffList) {
            const hDef = HediffManager.getHediff(h.id);
            if (!hDef) continue;

            if (h.action === 'escalate') {
                if (!this.hediffs[h.id])
                    this.hediffs[h.id] = { stacks: 1, ticksAlive: 0 };
                else {
                    this.hediffs[h.id].stacks += 1;
                    this.hediffs[h.id].ticksAlive = 0;
                }

                if (
                    hDef.maxStacks &&
                    this.hediffs[h.id].stacks > hDef.maxStacks
                ) {
                    if (hDef.nextTier || hDef.nextHediff) {
                        const nextId = hDef.nextTier || hDef.nextHediff;
                        this.pendingEvents.push({ event: 'PLAYER_HEDIFF_ESCALATED', args: [this.id, hDef, HediffManager.getHediff(nextId)] });
                        delete this.hediffs[h.id];
                        this.hediffs[nextId] = {
                            stacks: 1,
                            ticksAlive: 0,
                        };
                    } else {
                        this.hediffs[h.id].stacks = hDef.maxStacks;
                    }
                }
            } else if (h.action === 'reduce') {
                if (this.hediffs[h.id]) {
                    this.hediffs[h.id].stacks -= 1;
                    this.hediffs[h.id].ticksAlive = 0;
                    if (this.hediffs[h.id].stacks <= 0) {
                        this.pendingEvents.push({ event: 'PLAYER_HEDIFF_EXPIRED', args: [this.id, hDef] });
                        delete this.hediffs[h.id];
                        if (hDef.prevTier) {
                            const prevDef = HediffManager.getHediff(
                                hDef.prevTier,
                            );
                            this.hediffs[hDef.prevTier] = {
                                stacks:
                                    prevDef && prevDef.maxStacks
                                        ? prevDef.maxStacks
                                        : 1,
                                ticksAlive: 0,
                            };
                        }
                    }
                }
            } else if (h.action === 'remove') {
                if (this.hediffs[h.id]) this.pendingEvents.push({ event: 'PLAYER_HEDIFF_EXPIRED', args: [this.id, hDef] });
                delete this.hediffs[h.id];
            }
        }
    }

    // Checks if the player holds at least the requested amount of an item
    hasItem(itemId, amount = 1) {
        return (this.inventory[itemId] || 0) >= amount;
    }

    // Safely increments an item's quantity in the inventory, abiding by max count limits
    addItem(itemId, amount = 1) {
        if (!this.inventory[itemId]) {
            this.inventory[itemId] = 0;
        }
        this.inventory[itemId] += amount;

        const item = ItemManager.getItem(itemId);
        if (item && item.maxCount !== undefined) {
            this.inventory[itemId] = Math.min(
                this.inventory[itemId],
                item.maxCount,
            );
        }
    }

    // Removes an item quantity, fully deleting the key if empty
    removeItem(itemId, amount = 1) {
        if (!this.hasItem(itemId, amount)) return false;
        this.inventory[itemId] -= amount;
        if (this.inventory[itemId] <= 0) {
            delete this.inventory[itemId];
        }
        return true;
    }

    // Logs an activity or event occurrence to the player's historical record
    recordHistory(id) {
        if (!this.history[id]) {
            this.history[id] = 0;
        }
        this.history[id]++;
    }

    /**
     * Refunds all invested achievement points from Talents.
     * @returns {boolean} True if talents were refunded, false if there were none to refund.
     */
    refundAchievementPoints() {
        let hasInvestments = false;
        for (const key of Object.keys(this.talents)) {
            if (this.talents[key] > 0) {
                hasInvestments = true;
                break;
            }
        }

        if (!hasInvestments) return false;

        this.talents = {};
        return true;
    }

    // Prepares the player object to be saved directly to the database
    serialize() {
        return {
            id: this.id,
            inventory: this.inventory,
            energy: {
                value: this.energy.value,
                maxValue: this.energy.maxValue,
            },
            joinDate: this.joinDate.toISOString(),
            history: this.history,
            maxBytes: this.maxBytes,
            lastAction: this.lastAction.toISOString(),
            talents: this.talents,
            settings: this.settings,
            achievements: this.achievementPoints.progress,
            hediffs: this.hediffs,
        };
    }

    // Prepares the player object with additional calculated properties for the Web API
    toWeb() {
        const data = this.serialize();
        data.availableAchievementPoints = this.achievementPoints.available;
        data.achievementPoints = this.achievementPoints.value;

        const HediffManager = require('../managers/HediffManager');
        const formattedHediffs = {};
        for (const [hId, hData] of Object.entries(this.hediffs)) {
            const hDef = HediffManager.getHediff(hId);
            formattedHediffs[hId] = {
                ...hData,
                name: hDef ? hDef.name : hId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
            };
        }
        data.hediffs = formattedHediffs;

        return data;
    }
}

module.exports = Player;
