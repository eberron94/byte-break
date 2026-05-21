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
const {
    calculateEffects,
    applyEffects,
    evaluateExpression,
} = require('../util/effects');
const { getTimeContext } = require('../util/time');

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
                for (const h of value) {
                    const hDef = HediffManager.getHediff(h.id);
                    if (!hDef) continue;

                    if (h.action === 'escalate') {
                        if (!this.hediffs[h.id])
                            this.hediffs[h.id] = { stacks: 1 };
                        else this.hediffs[h.id].stacks += 1;

                        if (
                            hDef.maxStacks &&
                            this.hediffs[h.id].stacks > hDef.maxStacks
                        ) {
                            if (hDef.nextTier) {
                                delete this.hediffs[h.id];
                                this.hediffs[hDef.nextTier] = { stacks: 1 };
                            } else {
                                this.hediffs[h.id].stacks = hDef.maxStacks;
                            }
                        }
                    } else if (h.action === 'reduce') {
                        if (this.hediffs[h.id]) {
                            this.hediffs[h.id].stacks -= 1;
                            if (this.hediffs[h.id].stacks <= 0) {
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
                                    };
                                }
                            }
                        }
                    } else if (h.action === 'remove') {
                        delete this.hediffs[h.id];
                    }
                }
            }
        }

        this.updateLastInteraction();
        return true;
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
    tick(player = null, tickCounter = 1) {
        if (!this.isAlive) return;

        // Trigger natural decay across all loaded needs
        Object.values(this.needs).forEach((need) => need.tick(this, player));

        if (this.isDormant) {
            return;
        }

        // Offline/Asleep Bytes do not trigger active room environments or hediff ticks
        if (this.isAsleep) {
            return;
        }

        const locals = { ...getTimeContext(), tickCounter };

        const currentRoom = RoomManager.getRoom(this.room);
        if (currentRoom && currentRoom.tickEffects) {
            const activeTickEffects = currentRoom.tickEffects.filter(
                (effect) => {
                    const tpt =
                        effect.ticksPerTrigger !== undefined
                            ? evaluateExpression(
                                  effect.ticksPerTrigger,
                                  this,
                                  player,
                                  locals,
                              )
                            : 1;
                    return tpt <= 1 || locals.tickCounter % tpt === 0;
                },
            );
            if (activeTickEffects.length > 0) {
                const calculatedEffects = calculateEffects(
                    activeTickEffects,
                    this,
                    player,
                    locals,
                );
                applyEffects(calculatedEffects, this, player);
            }
        }

        // Process Passive Hediffs
        for (const [hId, hData] of Object.entries(this.hediffs)) {
            const hDef = HediffManager.getHediff(hId);
            if (hDef && hDef.tickEffects) {
                const activeTickEffects = hDef.tickEffects.filter((effect) => {
                    const tpt =
                        effect.ticksPerTrigger !== undefined
                            ? evaluateExpression(
                                  effect.ticksPerTrigger,
                                  this,
                                  player,
                                  { ...locals, stacks: hData.stacks },
                              )
                            : 1;
                    return tpt <= 1 || locals.tickCounter % tpt === 0;
                });
                if (activeTickEffects.length > 0) {
                    const calculatedEffects = calculateEffects(
                        activeTickEffects,
                        this,
                        player,
                        { ...locals, stacks: hData.stacks },
                    );
                    applyEffects(calculatedEffects, this, player);
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
                for (const mod of hDef.modifiers) {
                    if (mod.type === type && mod.key === key) {
                        modifier += evaluateExpression(mod.amount, this, null, {
                            stacks: hData.stacks,
                        });
                    }
                }
            }
        }
        return modifier;
    }

    // Helper method to extract flat core stats
    getStats() {
        return Object.fromEntries(
            Object.entries(this.stats).map(([k, stat]) => [k, stat.value]),
        );
    }

    // Helper method to extract flat calculated skill values
    getSkills() {
        return Object.fromEntries(
            Object.entries(this.skills).map(([k, skill]) => [k, skill.value]),
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
        };
    }
}

/**
 * Utility builder to construct a new byte cleanly with default starting state.
 */
class ByteBuilder {
    constructor() {
        this.byteData = {};
    }

    // Initializes a factory configuration for a generic level 1 byte
    static default(ownerId, name) {
        const now = new Date().toISOString();
        return new ByteBuilder()
            .withOwnerId(ownerId)
            .withName(name)
            .withByteClass('demo')
            .withCharge(50)
            .withThermal(50)
            .withDefrag(50)
            .withTelemetry(50)
            .withHistory({})
            .withRoom('charging_station')
            .withIsAlive(1)
            .withBirthDate(now)
            .withLastInteraction(now)
            .withGeneration(0)
            .withBufferOverflow(0);
    }

    withId(id) {
        this.byteData.id = id;
        return this;
    }

    withOwnerId(ownerId) {
        this.byteData.ownerId = ownerId.toString();
        return this;
    }

    withName(name) {
        this.byteData.name = name;
        return this;
    }

    withByteClass(byteClass) {
        this.byteData.byteClass = byteClass;
        return this;
    }

    withCharge(charge) {
        this.byteData.charge = charge;
        return this;
    }
    withThermal(thermal) {
        this.byteData.thermal = thermal;
        return this;
    }
    withDefrag(defrag) {
        this.byteData.defrag = defrag;
        return this;
    }
    withTelemetry(telemetry) {
        this.byteData.telemetry = telemetry;
        return this;
    }

    withStats(stats) {
        Object.assign(this.byteData, stats);
        return this;
    }

    withSkills(skills) {
        Object.assign(this.byteData, skills);
        return this;
    }

    withPools(pools) {
        Object.assign(this.byteData, pools);
        return this;
    }

    withHistory(history) {
        this.byteData.history = history;
        return this;
    }

    withRoom(room) {
        this.byteData.room = room;
        return this;
    }

    withIsAlive(isAlive) {
        this.byteData.isAlive = isAlive;
        return this;
    }

    withBirthDate(birthDate) {
        this.byteData.birthDate = birthDate;
        return this;
    }

    withLastInteraction(lastInteraction) {
        this.byteData.lastInteraction = lastInteraction;
        return this;
    }

    withGeneration(generation) {
        this.byteData.generation = generation;
        return this;
    }

    withBufferOverflow(bufferOverflow) {
        this.byteData.bufferOverflow = bufferOverflow;
        return this;
    }

    build() {
        return new Byte(this.byteData);
    }
}

module.exports = { Byte, ByteBuilder };
