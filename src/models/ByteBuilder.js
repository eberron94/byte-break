const { Byte } = require('./Byte');

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

    withLoadout(loadout) {
        this.byteData.loadout = loadout;
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

module.exports = ByteBuilder;