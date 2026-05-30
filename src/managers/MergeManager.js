const ByteBuilder = require('../models/ByteBuilder');
const dbManager = require('../database/db');
const GameEvents = require('../util/GameEvents');
const ByteClassManager = require('./ByteClassManager');

class MergeManager {
    static getMergeCost(player) {
        if (!player) return 100;
        const talentBonus = player.talents['merge_optimization'] || 0;
        return Math.max(25, 100 - talentBonus * 15);
    }

    static async mergeBytes(
        gameManager,
        userId,
        byte1Id,
        byte2Id,
        newName,
        player = null,
    ) {
        if (
            !newName ||
            typeof newName !== 'string' ||
            newName.trim().length === 0
        ) {
            throw new Error('A valid name must be provided for the new Byte.');
        }
        const sanitizedName = newName.trim().replace(/[^a-zA-Z0-9 ]/g, '');
        if (sanitizedName.length === 0 || sanitizedName.length > 32) {
            throw new Error(
                'Byte name must be 1-32 characters and only contain letters/numbers.',
            );
        }

        const bytes = await gameManager.getBytes(userId);
        const b1 = bytes.find((b) => b.id === byte1Id && b.isAlive);
        const b2 = bytes.find((b) => b.id === byte2Id && b.isAlive);

        if (!b1 || !b2)
            throw new Error('One or both bytes not found or not alive.');
        if (b1.id === b2.id)
            throw new Error('Cannot merge a byte with itself.');

        if (b1.level < b1.generation)
            throw new Error(
                `${b1.name} must be at least level ${b1.generation} to merge.`,
            );
        if (b2.level < b2.generation)
            throw new Error(
                `${b2.name} must be at least level ${b2.generation} to merge.`,
            );

        if (!player) {
            player = await gameManager.getPlayer(userId);
        }

        const cost = this.getMergeCost(player);
        if (player.energy.value < cost) {
            throw new Error(`Not enough Energy. Requires ${cost} ε.`);
        }

        const talentBonus = (player.talents['genetic_memory'] || 0) * 1;

        // Calculate inherited core stats
        const inheritedStats = {};
        for (const stat of Object.keys(b1.stats)) {
            const val1 = b1.stats[stat].baseValue || 0;
            const val2 = b2.stats[stat] ? b2.stats[stat].baseValue : 0;
            inheritedStats[stat] = Math.floor((val1 + val2) / 2) + talentBonus;
        }

        const secondaryClass = ByteClassManager.getClass(b2.byteClass);
        if (
            secondaryClass &&
            secondaryClass.enhanceStat &&
            inheritedStats[secondaryClass.enhanceStat] !== undefined
        ) {
            inheritedStats[secondaryClass.enhanceStat] +=
                (b2.generation || 0) + 1;
        }

        const gen1 = b1.generation || 0;
        const gen2 = b2.generation || 0;
        const childGeneration = Math.max(gen1, gen2) + 1;

        // Buffer Overflow Calculation
        const minParentLevel = Math.min(b1.level, b2.level);
        const overflowTalentBonus = (player.talents['overflow_bonus'] || 0) * 5;
        const bufferOverflow = minParentLevel * 10 + overflowTalentBonus;

        // Deduct energy
        player.energy.decrease(cost);

        // Unequip items from parents to return to inventory
        const unequipByte = (byte) => {
            const equippedIds = [
                ...(byte.loadout.hardware || []),
                ...(byte.loadout.software || []),
            ];
            for (const itemId of equippedIds) {
                player.addItem(itemId, 1);
            }
            byte.loadout = { hardware: [], software: [] };
        };
        unequipByte(b1);
        unequipByte(b2);

        // Retire the parents
        b1.isAlive = false;
        b2.isAlive = false;
        await gameManager.saveByte(b1);
        await gameManager.saveByte(b2);

        // Put all other existing living bytes to sleep
        for (const b of bytes) {
            if (b.isAlive && b.id !== b1.id && b.id !== b2.id && !b.isAsleep) {
                b.isAsleep = true;
                await gameManager.saveByte(b);
            }
        }

        // Create new child byte
        const newId = `${userId}_${Date.now()}`;
        const newByte = ByteBuilder.default(userId, sanitizedName)
            .withId(newId)
            .withStats(inheritedStats)
            .withGeneration(childGeneration)
            .withBufferOverflow(bufferOverflow)
            .withByteClass(b1.byteClass)
            .build();

        await dbManager.insertByte(newByte.serialize());
        await gameManager.savePlayer(player);
        gameManager.emit(GameEvents.BYTE_MERGED, userId, newByte);

        return newByte;
    }
}

module.exports = MergeManager;
