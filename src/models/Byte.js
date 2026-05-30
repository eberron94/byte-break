const Charge = require('./needs/Charge');
const Thermal = require('./needs/Thermal');
const Defrag = require('./needs/Defrag');
const Telemetry = require('./needs/Telemetry');
const Focus = require('./stats/Focus');
const Aptitude = require('./stats/Aptitude');
const Logic = require('./stats/Logic');
const Curiosity = require('./stats/Curiosity');
const Syntax = require('./stats/Syntax');

const Skill = require('./skills/Skill');
const SkillManager = require('../managers/SkillManager');

const Integrity = require('./pools/Integrity');
const TeraFlops = require('./pools/TeraFlops');
const Bits = require('./pools/Bits');

const RoomManager = require('../managers/RoomManager');
const HediffManager = require('../managers/HediffManager');
const ByteClassManager = require('../managers/ByteClassManager');
const { checkRequirements } = require('../util/requirements');
const {
    calculateEffects,
    applyEffects,
    evaluateExpression,
} = require('../util/effects');
const GameContext = require('./GameContext');

/**
 * Represents a digital monster (byte), managing its nested stats, skills, needs, and pools.
 */
class Byte {
    constructor(data) {
        this.id = data.id || `${data.ownerId}_${data.name}`;
        this.ownerId = data.ownerId;
        this.name = data.name;
        this.byteClass = data.byteClass || 'demo';

        this.hediffs = data.hediffs || {};
        this.loadout = data.loadout || { hardware: [], software: [] };

        // Needs automatically decay over time
        this.needs = {
            charge: new Charge(data.charge, this),
            thermal: new Thermal(data.thermal, this),
            defrag: new Defrag(data.defrag, this),
            telemetry: new Telemetry(data.telemetry, this),
        };

        // Core attributes
        this.stats = {
            focus: new Focus(data.focus, this),
            aptitude: new Aptitude(data.aptitude, this),
            logic: new Logic(data.logic, this),
            curiosity: new Curiosity(data.curiosity, this),
            syntax: new Syntax(data.syntax, this),
        };
        // Skills are dynamically loaded from canonical definitions
        this.skills = {};
        SkillManager.getAllSkills().forEach((canonicalSkill) => {
            this.skills[canonicalSkill.id] = new Skill(
                canonicalSkill,
                data[canonicalSkill.id],
                this,
            );
        });
        // Vitals and progression pools
        this.pools = {
            integrity: new Integrity(data.integrity, this),
            teraflops: new TeraFlops(data.teraflops, this),
            bits: new Bits(data.bits, this),
        };

        this.room = data.room || 'charging_station';
        this.isAlive = data.isAlive === 1;
        this.birthDate = data.birthDate ? new Date(data.birthDate) : new Date();
        this.lastInteraction = data.lastInteraction
            ? new Date(data.lastInteraction)
            : new Date();

        this.history = data.history || {};

        this.isAsleep = data.isAsleep === 1 || data.isAsleep === true;
        this.generation = data.generation || 0;
        this.bufferOverflow = data.bufferOverflow || 0;
        this.pendingEvents = [];

        // Handle daily resets for temporary byte mechanics
        const today = new Date().toISOString().split('T')[0];
        if (this.history['last_active_date'] !== today) {
            for (const key of Object.keys(this.history)) {
                if (key.startsWith('daily_') || key.startsWith('temp_')) {
                    delete this.history[key];
                }
            }
            this.history['last_active_date'] = today;
        }
    }

    getHardwareCapacity(player = null) {
        const intervals = Math.floor(this.level / 3);
        const levelBonus = Math.floor(intervals / 2); // Increases on the 2nd, 4th, 6th interval...
        const talentBonus = player && player.talents ? (player.talents.hardware_capacity || 0) : 0;
        return 1 + levelBonus + talentBonus;
    }

    getSoftwareCapacity(player = null) {
        const intervals = Math.floor(this.level / 3);
        const levelBonus = Math.ceil(intervals / 2); // Increases on the 1st, 3rd, 5th interval...
        const talentBonus = player && player.talents ? (player.talents.software_capacity || 0) : 0;
        return 1 + levelBonus + talentBonus;
    }

    get investedBits() {
        let totalInvestedBits = 0;
        Object.values(this.skills).forEach((skill) => {
            totalInvestedBits += skill.bitsInvested;
        });
        Object.values(this.pools).forEach((pool) => {
            totalInvestedBits += pool.bitsInvested || 0; // Ignore Knowledge pools that don't have this property
        });
        return totalInvestedBits;
    }

    get level() {
        // Base level 1 + 1 level per 100 invested bits (can be tuned later)
        return 1 + Math.floor(this.investedBits / 100);
    }

    get bitsToNextLevel() {
        return this.level * 100 - this.investedBits;
    }

    get isDormant() {
        return Object.values(this.needs).some((need) => need.value === 0);
    }

    /**
     * Iterates over a flat effects object and routes changes to the proper sub-system.
     * Examples: { "hunger": 20, "energy": -10, "strike": 5 }
     */
    applyEffects(effects) {
        if (!this.isAlive) return false;

        const oldLevel = this.level;
        const bitsWasFull = this.pools.bits.value >= this.pools.bits.maxValue;

        for (const [key, value] of Object.entries(effects)) {
            if (this.needs[key]) {
                if (value > 0) this.needs[key].satisfy(value);
                else this.needs[key].deplete(Math.abs(value));
            } else if (this.pools[key]) {
                if (value > 0) {
                    this.pools[key].increase(value);
                } else {
                    const amount = Math.abs(value);
                    if (key === 'bits' && this.bufferOverflow > 0) {
                        if (this.bufferOverflow >= amount) {
                            this.bufferOverflow -= amount;
                        } else {
                            const remaining = amount - this.bufferOverflow;
                            this.bufferOverflow = 0;
                            this.pools[key].decrease(remaining);
                        }
                    } else {
                        this.pools[key].decrease(amount);
                    }
                }
            } else if (this.stats[key]) {
                this.stats[key].baseValue = Math.max(
                    0,
                    this.stats[key].baseValue + value,
                );
            } else if (this.skills[key]) {
                this.skills[key].investedValue = Math.max(
                    0,
                    this.skills[key].investedValue + value,
                );
            } else if (key.startsWith('upgrade_')) {
                const target = key.replace('upgrade_', '');
                if (this.skills[target]) {
                    this.skills[target].investedValue = Math.max(
                        0,
                        this.skills[target].investedValue + value,
                    );
                } else if (this.pools[target]) {
                    this.pools[target].investedValue = Math.max(
                        0,
                        (this.pools[target].investedValue || 0) + value,
                    );
                    if (value > 0) this.pools[target].increase(value);
                    else this.pools[target].decrease(Math.abs(value));
                }
            } else if (key === 'isAsleep') {
                this.isAsleep = value;
            } else if (key === 'hediffs' && Array.isArray(value)) {
                this.applyHediffs(value);
            }
        }

        if (this.level > oldLevel) {
            this.pendingEvents.push({ event: 'levelUp', args: [this.ownerId, this.level, this.name] });
        }

        if (!bitsWasFull && this.pools.bits.value >= this.pools.bits.maxValue) {
            this.pendingEvents.push({ event: 'BIT_BUFFER_FULL', args: [this.ownerId, this] });
        }

        this.updateLastInteraction();
        return true;
    }

    applyHediffs(hediffList) {
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

                if (hDef.maxStacks && this.hediffs[h.id].stacks > hDef.maxStacks) {
                    if (hDef.nextTier || hDef.nextHediff) {
                        const nextId = hDef.nextTier || hDef.nextHediff;
                        this.pendingEvents.push({ event: 'HEDIFF_ESCALATED', args: [this.ownerId, this, hDef, HediffManager.getHediff(nextId)] });
                        delete this.hediffs[h.id];
                        this.hediffs[nextId] = { stacks: 1, ticksAlive: 0 };
                    } else {
                        this.hediffs[h.id].stacks = hDef.maxStacks;
                    }
                }
            } else if (h.action === 'reduce') {
                if (this.hediffs[h.id]) {
                    this.hediffs[h.id].stacks -= amount;
                    this.hediffs[h.id].ticksAlive = 0;
                    if (this.hediffs[h.id].stacks <= 0) {
                        this.pendingEvents.push({ event: 'HEDIFF_EXPIRED', args: [this.ownerId, this, hDef] });
                        delete this.hediffs[h.id];
                        if (hDef.prevTier) {
                            const prevDef = HediffManager.getHediff(hDef.prevTier);
                            this.hediffs[hDef.prevTier] = { stacks: prevDef && prevDef.maxStacks ? prevDef.maxStacks : 1, ticksAlive: 0 };
                        }
                    }
                }
            } else if (h.action === 'remove') {
                if (this.hediffs[h.id]) this.pendingEvents.push({ event: 'HEDIFF_EXPIRED', args: [this.ownerId, this, hDef] });
                delete this.hediffs[h.id];
            }
        }
    }

    // Logs an activity or event occurrence to the pet's condensed historical record
    recordHistory(id) {
        if (!this.history[id]) {
            this.history[id] = 0;
        }
        this.history[id]++;
    }

    /**
     * Global clock cycle action for the byte. Drives need decay over time.
     */
    tick(context) {
        if (!this.isAlive) return;

        const wasDormant = this.isDormant;

        // Trigger natural decay across all loaded needs
        Object.values(this.needs).forEach((need) => need.tick(this, context.player));

        if (process.env.DEBUG_INF_NEEDS === 'true') {
            Object.values(this.needs).forEach((need) => { need.value = 100; });
        }

        if (process.env.DEBUG_INF_INTEGRITY === 'true') {
            if (this.pools.integrity) {
                this.pools.integrity.value = this.pools.integrity.maxValue;
            }
        }

        if (process.env.DEBUG_INF_BITS === 'true') {
            if (this.pools.bits.value < this.pools.bits.maxValue) {
                this.pools.bits.value = this.pools.bits.maxValue;
                this.pendingEvents.push({ event: 'BIT_BUFFER_FULL', args: [this.ownerId, this] });
            }
        }

        if (!wasDormant && this.isDormant) {
            this.pendingEvents.push({ event: 'BYTE_DORMANT', args: [this.ownerId, this] });
        }

        if (this.isDormant) {
            return;
        }

        // Offline/Asleep Bytes do not trigger active room environments or hediff ticks
        if (this.isAsleep) {
            return;
        }

        const currentRoom = RoomManager.getRoom(this.room);
        if (currentRoom && currentRoom.tickEffects) {
            const activeTickEffects = currentRoom.tickEffects.filter(
                (effect) => {
                    const tpt =
                        effect.ticksPerTrigger !== undefined
                            ? evaluateExpression(effect.ticksPerTrigger, context)
                            : 1;
                    return tpt <= 1 || context.locals.tickCounter % tpt === 0;
                },
            );
            if (activeTickEffects.length > 0) {
                const calculatedEffects = calculateEffects(activeTickEffects, context);
                applyEffects(calculatedEffects, context);
            }
        }

        // Process Passive Hediffs
        for (const [hId, hData] of Object.entries(this.hediffs)) {
            const hDef = HediffManager.getHediff(hId);
            if (!hDef) continue;

            hData.ticksAlive = (hData.ticksAlive || 0) + 1;

            const hediffContext = new GameContext(this, context.player, {
                ...context.locals,
                stacks: hData.stacks,
                ticksAlive: hData.ticksAlive,
            });

            let shouldDecay = false;
            if (hDef.decay) {
                if (hDef.decay.requirements && checkRequirements(hDef.decay.requirements, hediffContext)) {
                    shouldDecay = true;
                } else if (hDef.decay.ticks !== undefined) {
                    const decayTicks = evaluateExpression(hDef.decay.ticks, hediffContext);
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
                const activeTickEffects = hDef.tickEffects.filter((effect) => {
                    const tpt = effect.ticksPerTrigger !== undefined ? evaluateExpression(effect.ticksPerTrigger, hediffContext) : 1;
                    return tpt <= 1 || hediffContext.locals.tickCounter % tpt === 0;
                });
                if (activeTickEffects.length > 0) {
                    const calculatedEffects = calculateEffects(activeTickEffects, hediffContext);
                    applyEffects(calculatedEffects, hediffContext);
                }
            }
        }

        // Process Equipment Tick Effects (Software)
        const ItemManager = require('../managers/ItemManager');
        const equippedIds = [...(this.loadout.hardware || []), ...(this.loadout.software || [])];
        for (const itemId of equippedIds) {
            const item = ItemManager.getItem(itemId);
            if (item && item.tickEffects) {
                const activeTickEffects = item.tickEffects.filter((effect) => {
                    const tpt = effect.ticksPerTrigger !== undefined ? evaluateExpression(effect.ticksPerTrigger, context) : 1;
                    return tpt <= 1 || context.locals.tickCounter % tpt === 0;
                });
                if (activeTickEffects.length > 0) {
                    const calculatedEffects = calculateEffects(activeTickEffects, context);
                    applyEffects(calculatedEffects, context);
                }
            }
        }
    }

    updateLastInteraction() {
        this.lastInteraction = new Date();
    }

    /**
     * Refunds all invested bits back into the buffer overflow.
     * @returns {number} The total bits refunded.
     */
    refundBits() {
        const byteClass = ByteClassManager.getClass(this.byteClass);
        if (!byteClass) return 0;
        const refundedBits = this.investedBits;

        for (const [key, cost] of Object.entries(byteClass.investmentRates)) {
            if (this.pools[key] && this.pools[key].investedValue > 0) {
                this.pools[key].investedValue = 0;
                this.pools[key].value = this.pools[key].value;
            } else if (this.skills[key] && this.skills[key].investedValue > 0) {
                this.skills[key].investedValue = 0;
            }
        }

        if (refundedBits > 0) {
            this.bufferOverflow = (this.bufferOverflow || 0) + refundedBits;
        }

        return refundedBits;
    }

    getHediffModifier(type, key) {
        let modifier = 0;
        for (const [hId, hData] of Object.entries(this.hediffs)) {
            const hDef = HediffManager.getHediff(hId);
            if (hDef && hDef.modifiers) {
                const relevantMods = hDef.modifiers.filter(m => m.type === type && m.key === key);
                if (relevantMods.length > 0) {
                    const context = new GameContext(this, null, { stacks: hData.stacks });
                    for (const mod of relevantMods) {
                        modifier += evaluateExpression(mod.amount, context);
                    }
                }
            }
        }
        return modifier;
    }

    getEquipmentModifier(type, key) {
        const ItemManager = require('../managers/ItemManager');
        let modifier = 0;
        const equippedIds = [...(this.loadout.hardware || []), ...(this.loadout.software || [])];
        
        for (const itemId of equippedIds) {
            const item = ItemManager.getItem(itemId);
            if (item && item.modifiers) {
                const relevantMods = item.modifiers.filter(m => m.type === type && m.key === key);
                if (relevantMods.length > 0) {
                    const context = new GameContext(this, null);
                    for (const mod of relevantMods) {
                        modifier += evaluateExpression(mod.amount, context);
                    }
                }
            }
        }
        return modifier;
    }

    getDicePool(type, key) {
        const diceCounts = { 6: 0 };
        
        // 1. Add Base Stats
        if (type === 'stat' && this.stats[key]) diceCounts[6] += this.stats[key].value;
        else if (type === 'skill' && this.skills[key]) diceCounts[6] += this.skills[key].value;

        // 2. Add Hediff Modifiers
        for (const [hId, hData] of Object.entries(this.hediffs)) {
            const hDef = HediffManager.getHediff(hId);
            if (hDef && hDef.modifiers) {
                const relevantMods = hDef.modifiers.filter(m => m.type === type && m.key === key);
                if (relevantMods.length > 0) {
                    const context = new GameContext(this, null, { stacks: hData.stacks });
                    for (const mod of relevantMods) {
                        const size = evaluateExpression(mod.amount, context);
                        const sides = mod.sides ? evaluateExpression(mod.sides, context) : 6;
                        diceCounts[sides] = (diceCounts[sides] || 0) + size;
                    }
                }
            }
        }

        // 3. Add Equipment Modifiers
        const ItemManager = require('../managers/ItemManager');
        const equippedIds = [...(this.loadout.hardware || []), ...(this.loadout.software || [])];
        
        for (const itemId of equippedIds) {
            const item = ItemManager.getItem(itemId);
            if (item && item.modifiers) {
                const relevantMods = item.modifiers.filter(m => m.type === type && m.key === key);
                for (const mod of relevantMods) {
                    const context = new GameContext(this, null);
                    const size = evaluateExpression(mod.amount, context);
                    const sides = mod.sides ? evaluateExpression(mod.sides, context) : 6;
                    diceCounts[sides] = (diceCounts[sides] || 0) + size;
                }
            }
        }

        const pool = [];
        for (const [sidesStr, size] of Object.entries(diceCounts)) {
            if (size > 0) {
                pool.push({ size, sides: parseInt(sidesStr, 10) });
            }
        }
        return pool;
    }

    // Helper method to extract flat core stats
    getStats() {
        return Object.fromEntries(
            Object.entries(this.stats).map(([k, stat]) => [
                k, 
                Math.max(0, stat.value + this.getHediffModifier('stat', k) + this.getEquipmentModifier('stat', k))
            ]),
        );
    }

    // Helper method to extract flat calculated skill values
    getSkills() {
        return Object.fromEntries(
            Object.entries(this.skills).map(([k, skill]) => [
                k, 
                Math.max(0, skill.value + this.getHediffModifier('skill', k) + this.getEquipmentModifier('skill', k))
            ]),
        );
    }

    // Helper method to extract flat pool capacities
    getPools() {
        return Object.fromEntries(
            Object.entries(this.pools).map(([k, pool]) => [
                k,
                { value: pool.value, maxValue: pool.maxValue },
            ]),
        );
    }

    // Converts nested objects back into flat JSON strings for SQLite storage
    serialize() {
        const needs = Object.fromEntries(
            Object.entries(this.needs).map(([k, need]) => [k, need.value]),
        );
        const stats = Object.fromEntries(
            Object.entries(this.stats).map(([k, stat]) => [k, stat.baseValue]),
        );
        const skills = Object.fromEntries(
            Object.entries(this.skills).map(([k, skill]) => [
                k,
                skill.investedValue,
            ]),
        );
        const pools = Object.fromEntries(
            Object.entries(this.pools).map(([k, pool]) => [
                k,
                {
                    baseValue: pool.baseValue,
                    value: pool.value,
                    investedValue: pool.investedValue,
                },
            ]),
        );

        return {
            id: this.id,
            ownerId: this.ownerId,
            name: this.name,
            byteClass: this.byteClass,
            needs: needs,
            stats: stats,
            skills: skills,
            pools: pools,
            room: this.room,
            isAlive: this.isAlive ? 1 : 0,
            history: this.history,
            birthDate: this.birthDate.toISOString(),
            lastInteraction: this.lastInteraction.toISOString(),
            isAsleep: this.isAsleep ? 1 : 0,
            generation: this.generation,
            bufferOverflow: this.bufferOverflow,
            hediffs: this.hediffs,
            loadout: this.loadout,
        };
    }

    // Prepares the byte object with additional calculated properties for the Web API
    toWeb() {
        const data = this.serialize();
        data.level = this.level;
        data.investedBits = this.investedBits;
        return data;
    }

    // Formats relevant display data for front-end rendering
    getStatus() {
        const formattedHediffs = {};
        for (const [hId, hData] of Object.entries(this.hediffs)) {
            const hDef = HediffManager.getHediff(hId);
            formattedHediffs[hId] = {
                ...hData,
                name: hDef ? hDef.name : hId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
            };
        }

        return {
            name: this.name,
            byteClass: this.byteClass,
            level: this.level,
            bitsToNextLevel: this.bitsToNextLevel,
            charge: this.needs.charge.value,
            thermal: this.needs.thermal.value,
            defrag: this.needs.defrag.value,
            telemetry: this.needs.telemetry.value,
            room: this.room,
            stats: this.getStats(),
            skills: this.getSkills(),
            pools: this.getPools(),
            isAlive: this.isAlive,
            generation: this.generation,
            isDormant: this.isDormant,
            bufferOverflow: this.bufferOverflow,
            hediffs: formattedHediffs,
            loadout: this.loadout,
        };
    }
}

module.exports = { Byte };
