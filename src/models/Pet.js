const Hunger = require('./needs/Hunger');
const Thirst = require('./needs/Thirst');
const Enrichment = require('./needs/Enrichment');
const Stimulation = require('./needs/Stimulation');
const Exertion = require('./needs/Exertion');
const Energy = require('./Energy');
const Strength = require('./stats/Strength');
const Constitution = require('./stats/Constitution');
const Dexterity = require('./stats/Dexterity');
const Agility = require('./stats/Agility');
const Focus = require('./stats/Focus');
const Willpower = require('./stats/Willpower');
const Instinct = require('./stats/Instinct');
const Aptitude = require('./stats/Aptitude');

const Skill = require('./skills/Skill');
const SkillManager = require('../managers/SkillManager');

const Lifepoints = require('./pools/Lifepoints');
const Mana = require('./pools/Mana');
const Ki = require('./pools/Ki');
const Potential = require('./pools/Potential');
const XP = require('./pools/XP');

/**
 * Represents a virtual pet, managing its nested stats, skills, needs, and pools.
 */
class Pet {
    constructor(data) {
        this.ownerId = data.ownerId;
        this.name = data.name;
        // Needs automatically decay over time
        this.needs = {
            hunger: new Hunger(data.hunger),
            thirst: new Thirst(data.thirst),
            enrichment: new Enrichment(data.enrichment),
            stimulation: new Stimulation(data.stimulation),
            exertion: new Exertion(data.exertion),
        };
        this.energy = new Energy(data.energy !== undefined ? data.energy : 100);

        // Core attributes
        this.stats = {
            strength: new Strength(data.strength),
            constitution: new Constitution(data.constitution),
            dexterity: new Dexterity(data.dexterity),
            agility: new Agility(data.agility),
            focus: new Focus(data.focus),
            willpower: new Willpower(data.willpower),
            instinct: new Instinct(data.instinct),
            aptitude: new Aptitude(data.aptitude),
        };
        // Skills are dynamically loaded from canonical definitions
        this.skills = {};
        const skillManager = new SkillManager();
        skillManager.getAllSkills().forEach((canonicalSkill) => {
            this.skills[canonicalSkill.id] = new Skill(
                canonicalSkill,
                data[canonicalSkill.id],
                this.stats,
            );
        });
        // Vitals and progression pools
        this.pools = {
            lifepoints: new Lifepoints(data.lifepoints),
            mana: new Mana(data.mana),
            ki: new Ki(data.ki),
            potential: new Potential(data.potential),
            xp: new XP(data.xp),
        };

        this.room = data.room || 'living_room';
        this.isAlive = data.isAlive === 1;
        this.birthDate = new Date(data.birthDate);
        this.lastInteraction = new Date(data.lastInteraction);

        this.history =
            typeof data.history === 'string'
                ? JSON.parse(data.history)
                : data.history || {};
    }

    /**
     * Iterates over a flat effects object and routes changes to the proper sub-system.
     * Examples: { "hunger": 20, "energy": -10, "strike": 5 }
     */
    applyEffects(effects) {
        if (!this.isAlive) return false;

        for (const [key, value] of Object.entries(effects)) {
            if (key === 'energy') {
                if (value > 0) this.energy.increase(value);
                else this.energy.decrease(Math.abs(value));
            } else if (this.needs[key]) {
                if (value > 0) this.needs[key].satisfy(value);
                else this.needs[key].deplete(Math.abs(value));
            } else if (this.pools[key]) {
                this.pools[key].value = Math.max(
                    0,
                    this.pools[key].value + value,
                );
            } else if (this.stats[key]) {
                this.stats[key].value += value;
            } else if (this.skills[key]) {
                this.skills[key].investedValue += value;
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
     * Global clock cycle action for the pet. Drives need decay over time.
     */
    tick() {
        if (!this.isAlive) return;

        // Trigger natural decay across all loaded needs
        Object.values(this.needs).forEach((need) => need.tick());

        // Pet passes away if basic survival needs drop to 0
        if (this.needs.hunger.value === 0 && this.needs.thirst.value === 0) {
            this.isAlive = false;
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
            Object.entries(this.pools).map(([k, pool]) => [k, pool.value]),
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
            Object.entries(this.pools).map(([k, pool]) => [k, pool.value]),
        );

        return {
            ownerId: this.ownerId,
            name: this.name,
            needs: JSON.stringify(needs),
            stats: JSON.stringify(stats),
            skills: JSON.stringify(skills),
            pools: JSON.stringify(pools),
            energy: this.energy.value,
            room: this.room,
            isAlive: this.isAlive ? 1 : 0,
            history: JSON.stringify(this.history),
            birthDate: this.birthDate.toISOString(),
            lastInteraction: this.lastInteraction.toISOString(),
        };
    }

    // Formats relevant display data for front-end rendering
    getStatus() {
        return {
            name: this.name,
            hunger: this.needs.hunger.value,
            thirst: this.needs.thirst.value,
            enrichment: this.needs.enrichment.value,
            stimulation: this.needs.stimulation.value,
            exertion: this.needs.exertion.value,
            energy: this.energy.value,
            room: this.room,
            stats: this.getStats(),
            skills: this.getSkills(),
            pools: this.getPools(),
            isAlive: this.isAlive,
        };
    }
}

/**
 * Utility builder to construct a new pet cleanly with default starting state.
 */
class PetBuilder {
    constructor() {
        this.petData = {};
    }

    // Initializes a factory configuration for a generic level 1 pet
    static default(ownerId, name) {
        const now = new Date().toISOString();
        return new PetBuilder()
            .withOwnerId(ownerId)
            .withName(name)
            .withHunger(50)
            .withThirst(50)
            .withEnrichment(50)
            .withStimulation(50)
            .withExertion(100)
            .withEnergy(100)
            .withHistory({})
            .withRoom('living_room')
            .withIsAlive(1)
            .withBirthDate(now)
            .withLastInteraction(now);
    }

    withOwnerId(ownerId) {
        this.petData.ownerId = ownerId.toString();
        return this;
    }

    withName(name) {
        this.petData.name = name;
        return this;
    }

    withHunger(hunger) {
        this.petData.hunger = hunger;
        return this;
    }
    withThirst(thirst) {
        this.petData.thirst = thirst;
        return this;
    }
    withEnrichment(enrichment) {
        this.petData.enrichment = enrichment;
        return this;
    }
    withStimulation(stimulation) {
        this.petData.stimulation = stimulation;
        return this;
    }
    withExertion(exertion) {
        this.petData.exertion = exertion;
        return this;
    }
    withEnergy(energy) {
        this.petData.energy = energy;
        return this;
    }

    withStats(stats) {
        Object.assign(this.petData, stats);
        return this;
    }

    withSkills(skills) {
        Object.assign(this.petData, skills);
        return this;
    }

    withPools(pools) {
        Object.assign(this.petData, pools);
        return this;
    }

    withHistory(history) {
        this.petData.history = history;
        return this;
    }

    withRoom(room) {
        this.petData.room = room;
        return this;
    }

    withIsAlive(isAlive) {
        this.petData.isAlive = isAlive;
        return this;
    }

    withBirthDate(birthDate) {
        this.petData.birthDate = birthDate;
        return this;
    }

    withLastInteraction(lastInteraction) {
        this.petData.lastInteraction = lastInteraction;
        return this;
    }

    build() {
        return new Pet(this.petData);
    }
}

module.exports = { Pet, PetBuilder };
