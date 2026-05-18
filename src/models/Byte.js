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
const Bandwidth = require('./pools/Bandwidth');
const Bits = require('./pools/Bits');

const RoomManager = require('../managers/RoomManager');
const { calculateEffects, applyEffects } = require('../util/effects');

/**
 * Represents a digital monster (byte), managing its nested stats, skills, needs, and pools.
 */
class Byte {
    constructor(data) {
        this.id = data.id || `${data.ownerId}_${data.name}`;
        this.ownerId = data.ownerId;
        this.name = data.name;
        this.byteClass = data.byteClass || 'demo';
        // Needs automatically decay over time
        this.needs = {
            charge: new Charge(data.charge),
            thermal: new Thermal(data.thermal),
            defrag: new Defrag(data.defrag),
            telemetry: new Telemetry(data.telemetry),
        };

        // Core attributes
        this.stats = {
            focus: new Focus(data.focus),
            aptitude: new Aptitude(data.aptitude),
            logic: new Logic(data.logic),
            curiosity: new Curiosity(data.curiosity),
            syntax: new Syntax(data.syntax),
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
            bandwidth: new Bandwidth(data.bandwidth, this),
            bits: new Bits(data.bits, this),
        };

        this.room = data.room || 'charging_station';
        this.isAlive = data.isAlive === 1;
        this.birthDate = new Date(data.birthDate);
        this.lastInteraction = new Date(data.lastInteraction);

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
                this.stats[key].value += value;
            } else if (this.skills[key]) {
                this.skills[key].investedValue += value;
            } else if (key.startsWith('upgrade_')) {
                const target = key.replace('upgrade_', '');
                if (this.skills[target]) {
                    this.skills[target].investedValue += value;
                } else if (this.pools[target]) {
                    this.pools[target].maxValue += value;
                    this.pools[target].investedValue =
                        (this.pools[target].investedValue || 0) + value;
                    this.pools[target].increase(value);
                }
            } else if (key === 'isAsleep') {
                this.isAsleep = value;
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
    tick(player = null, itemManager = null) {
        if (!this.isAlive) return;

        // Trigger natural decay across all loaded needs
        Object.values(this.needs).forEach((need) => need.tick(this, player));

        if (this.isDormant) {
            return;
        }

        const currentRoom = RoomManager.getRoom(this.room);
        if (currentRoom && currentRoom.tickEffects) {
            const calculatedEffects = calculateEffects(
                currentRoom.tickEffects,
                this,
                player,
            );
            applyEffects(calculatedEffects, this, player, itemManager);
        }
    }

    updateLastInteraction() {
        this.lastInteraction = new Date();
    }

    /**
     * Refunds all invested bits back into the buffer overflow.
     * @param {Object} byteClass The canonical class definition for this byte
     * @returns {number} The total bits refunded.
     */
    refundBits(byteClass) {
        const refundedBits = this.investedBits;

        for (const [key, cost] of Object.entries(byteClass.investmentRates)) {
            if (this.pools[key] && this.pools[key].investedValue > 0) {
                this.pools[key].maxValue -= this.pools[key].investedValue;
                this.pools[key].value = Math.min(
                    this.pools[key].value,
                    this.pools[key].maxValue,
                );
                this.pools[key].investedValue = 0;
            } else if (this.skills[key] && this.skills[key].investedValue > 0) {
                this.skills[key].investedValue = 0;
            }
        }

        if (refundedBits > 0) {
            this.bufferOverflow = (this.bufferOverflow || 0) + refundedBits;
        }

        return refundedBits;
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
            Object.entries(this.stats).map(([k, stat]) => [k, stat.value]),
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
                    value: pool.value,
                    maxValue: pool.maxValue,
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
