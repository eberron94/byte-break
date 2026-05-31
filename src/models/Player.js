const Energy = require('./Energy');
const bindAchievementPoints = require('./pools/AchievementPoints');
const ItemManager = require('../managers/ItemManager');

/**
 * Represents a Telegram user, tracking their id and personal inventory.
 */
class Player {
    constructor(data) {
        this.id = data.id.toString();
        this.inventory = data.inventory || {};

        // Scrub legacy "undefined" string keys caused by missing item IDs
        if (this.inventory.hasOwnProperty('undefined')) {
            delete this.inventory['undefined'];
        }

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
            
        bindAchievementPoints(this, data.achievements || {});
        
        this.talents = data.talents || {};
        this.settings = data.settings || {};
        this.hediffs = data.hediffs || {};
        this.pendingEvents = [];

        // Handle daily resets (resets shop stock at UTC midnight)
        const today = new Date().toISOString().split('T')[0];
        if (this.history['last_login_date'] !== today) {
            for (const key of Object.keys(this.history)) {
                if (
                    key.startsWith('shop_') ||
                    key.startsWith('daily_') ||
                    key.startsWith('temp_')
                ) {
                    delete this.history[key];
                } else if (key.startsWith('item_used_')) {
                    const itemId = key.replace('item_used_', '');
                    const item = ItemManager.getItem(itemId);
                    if (!item || !item.isOnCooldown(this)) {
                        delete this.history[key];
                    }
                }
            }

            for (const itemId of Object.keys(this.inventory)) {
                const itemDef = ItemManager.getItem(itemId);
                if (!itemDef) {
                    console.warn(`[Player] Missing item definition for ID: '${itemId}' in player ${this.id}'s inventory.`);
                    if (process.env.PRUNE === 'true') {
                        delete this.inventory[itemId];
                        continue;
                    }
                }
                if (!this.history[`ever_owned_${itemId}`]) {
                    this.history[`ever_owned_${itemId}`] = 1;
                    this.pendingEvents.push({ event: 'uniqueItemCollected', args: [this.id, itemId] });
                }
            }

            this.history['last_login_date'] = today;
        }
    }

    // Restores energy over time
    tick(context = null) {
        const wasFull = this.energy.value >= this.energy.maxValue;
        this.energy.increase(1);

        if (process.env.DEBUG_INF_ENERGY === 'true') {
            this.energy.value = this.energy.maxValue;
        }

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

            const amount = h.amount !== undefined ? h.amount : 1;

            if (h.action === 'escalate') {
                if (!this.hediffs[h.id])
                    this.hediffs[h.id] = { stacks: amount, ticksAlive: 0 };
                else {
                    this.hediffs[h.id].stacks += amount;
                    this.hediffs[h.id].ticksAlive = 0;
                }

                if (
                    hDef.maxStacks &&
                    this.hediffs[h.id].stacks > hDef.maxStacks
                ) {
                    if (hDef.nextTier || hDef.nextHediff) {
                        const nextId = hDef.nextTier || hDef.nextHediff;
                        this.pendingEvents.push({
                            event: 'PLAYER_HEDIFF_ESCALATED',
                            args: [
                                this.id,
                                hDef,
                                HediffManager.getHediff(nextId),
                            ],
                        });
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
                    this.hediffs[h.id].stacks -= amount;
                    this.hediffs[h.id].ticksAlive = 0;
                    if (this.hediffs[h.id].stacks <= 0) {
                        this.pendingEvents.push({
                            event: 'PLAYER_HEDIFF_EXPIRED',
                            args: [this.id, hDef],
                        });
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
                if (this.hediffs[h.id])
                    this.pendingEvents.push({
                        event: 'PLAYER_HEDIFF_EXPIRED',
                        args: [this.id, hDef],
                    });
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

        if (!this.history[`ever_owned_${itemId}`]) {
            this.history[`ever_owned_${itemId}`] = 1;
            this.pendingEvents.push({ event: 'uniqueItemCollected', args: [this.id, itemId] });
        }

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
    recordHistory(id, amount = 1, mode = 'add') {
        if (!this.history[id]) {
            this.history[id] = 0;
        }
        if (mode === 'max') {
            this.history[id] = Math.max(this.history[id], amount);
        } else {
            this.history[id] += amount;
        }
    }

    addCombatMetrics(metrics) {
        const CombatMetrics = require('./CombatMetrics');
        const current = new CombatMetrics(this.history.combatMetrics);
        current.add(metrics);

        // Expunge loot to prevent indefinite growth in history storage
        current.earnedBits = 0;
        current.earnedItems = {};

        this.history.combatMetrics = current;
    }

    /**
     * Buys a talent, consuming achievement points and abiding by requirements.
     */
    buyTalent(talentId, byte) {
        const TalentManager = require('../managers/TalentManager');
        const GameObjectManager = require('../managers/GameObjectManager');
        const GameContext = require('./GameContext');
        const { checkRequirements } = require('../util/requirements');

        const talent = TalentManager.getTalent(talentId);
        if (!talent) throw new Error('Talent not found');

        const currentLevel = this.talents[talentId] || 0;
        if (currentLevel >= talent.maxLevel)
            throw new Error('Talent maxed out');
        if (this.achievementPoints.available < talent.cost)
            throw new Error('Not enough α');

        const context = new GameContext(byte, this);

        if (!checkRequirements(talent.requirements, context)) {
            const reqStr = GameObjectManager.formatRequirementsList(
                talent.requirements,
            );
            throw new Error(`Prerequisites not met.\nRequires:\n• ${reqStr}`);
        }

        this.talents[talentId] = currentLevel + 1;
        return true;
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

    /**
     * Uses a User Mutator item to refund all invested achievement points.
     */
    useMutator() {
        if (!this.hasItem('user_mutator', 1)) {
            throw new Error('You do not have a User Mutator.');
        }

        const success = this.refundAchievementPoints();
        if (!success) {
            throw new Error('No talents to refund.');
        }

        this.removeItem('user_mutator', 1);
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
        const { getAvatarColors } = require('../util/avatar');
        const formattedHediffs = {};
        for (const [hId, hData] of Object.entries(this.hediffs)) {
            const hDef = HediffManager.getHediff(hId);
            formattedHediffs[hId] = {
                ...hData,
                name: hDef
                    ? hDef.name
                    : hId
                          .split('_')
                          .map(
                              (word) =>
                                  word.charAt(0).toUpperCase() + word.slice(1),
                          )
                          .join(' '),
                colors: getAvatarColors(hId, 'player_hediff', 0),
            };
        }
        data.hediffs = formattedHediffs;

        return data;
    }
}

module.exports = Player;
