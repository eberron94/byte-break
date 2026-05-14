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
const { calculateEffects } = require('../util/effects');

/**
 * Represents a digital monster (byte), managing its nested stats, skills, needs, and pools.
 */
class Byte {
    constructor(data) {
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
            bits: new Bits(data.bits || data.xp, this), // Fallback to 'xp' data for legacy bytes
        };

        this.room = data.room || 'charging_station';
        if (this.room === 'living_room') this.room = 'charging_station'; // Migrate legacy bytes
        this.isAlive = data.isAlive === 1;
        this.birthDate = new Date(data.birthDate);
        this.lastInteraction = new Date(data.lastInteraction);

        this.history = data.history || {};
    }

    get level() {
        // Calculate total Bits invested so far
        let totalInvestedBits = 0;
        Object.values(this.skills).forEach((skill) => {
            totalInvestedBits += skill.bitsInvested;
        });
        Object.values(this.pools).forEach((pool) => {
            totalInvestedBits += pool.bitsInvested || 0; // Ignore Knowledge pools that don't have this property
        });
        // Base level 1 + 1 level per 100 invested bits (can be tuned later)
        return 1 + Math.floor(totalInvestedBits / 100);
    }

    get bitsToNextLevel() {
        let totalInvestedBits = 0;
        Object.values(this.skills).forEach((skill) => {
            totalInvestedBits += skill.bitsInvested;
        });
        Object.values(this.pools).forEach((pool) => {
            totalInvestedBits += pool.bitsInvested || 0;
        });
        return this.level * 100 - totalInvestedBits;
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
                    this.pools[key].decrease(Math.abs(value));
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
    tick() {
        if (!this.isAlive) return;

        // Trigger natural decay across all loaded needs
        Object.values(this.needs).forEach((need) => need.tick());

        const isDormant = Object.values(this.needs).some(
            (need) => need.value === 0,
        );
        if (isDormant) {
            return;
        }

        const currentRoom = RoomManager.getRoom(this.room);
        if (currentRoom && currentRoom.tickEffects) {
            const calculatedEffects = calculateEffects(
                currentRoom.tickEffects,
                this,
                null,
            );
            this.applyEffects(calculatedEffects);
        }
    }

    updateLastInteraction() {
        this.lastInteraction = new Date();
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
                {
                    investedValue: skill.investedValue,
                    innateValue: skill.innateValue,
                },
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
        };
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
            .withLastInteraction(now);
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

    build() {
        return new Byte(this.byteData);
    }
}

module.exports = { Byte, ByteBuilder };
