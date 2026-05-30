const LootManager = require('./LootManager');
const ItemManager = require('./ItemManager');

// Mock the external JSON data so we have predictable, isolated loot tables
jest.mock('../../data/loot.json', () => ({
    guaranteed_table: {
        bits: 100,
        items: [{ id: 'basic_item', amount: 2, chance: 1.0 }],
    },
    chance_table: {
        bits: 50,
        items: [
            { id: 'common_item', amount: 1, chance: 0.5 },
            { id: 'rare_item', amount: 1, chance: 0.1 },
        ],
    },
}));

// Mock the ItemManager so we can define predictable maxCount limitations
jest.mock('./ItemManager', () => ({
    getItem: jest.fn((id) => {
        if (id === 'capped_item') return { id: 'capped_item', maxCount: 5 };
        return { id, maxCount: undefined };
    }),
}));

describe('LootManager', () => {
    beforeAll(() => {
        // Force LootManager to re-ingest the mocked data
        LootManager.load();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('rollLoot', () => {
        it('should return empty results for missing tables', () => {
            const result = LootManager.rollLoot('invalid_table');
            expect(result).toEqual({ bits: 0, items: [] });
        });

        it('should guarantee items with 1.0 drop chance', () => {
            // Even on the absolute worst possible roll, it should succeed
            jest.spyOn(Math, 'random').mockReturnValue(0.99);
            const result = LootManager.rollLoot('guaranteed_table');

            expect(result.bits).toBe(100);
            expect(result.items.length).toBe(1);
            expect(result.items[0]).toEqual({ id: 'basic_item', amount: 2 });
        });

        it('should evaluate fractional chances correctly against Math.random', () => {
            // Force a 40% roll. 0.4 <= 0.5 (common succeeds), but 0.4 > 0.1 (rare fails)
            jest.spyOn(Math, 'random').mockReturnValue(0.4);
            const result = LootManager.rollLoot('chance_table');

            expect(result.items.length).toBe(1);
            expect(result.items[0].id).toBe('common_item');
        });
    });

    describe('processLoot', () => {
        it('should accurately process explicit inventory payloads without a loot table', () => {
            const effectsObj = { inventory: { extra_item: 3 }, bits: 25 };
            const result = LootManager.processLoot(effectsObj);

            expect(result.bits).toBe(25);
            expect(result.items).toContainEqual({
                id: 'extra_item',
                amount: 3,
            });
        });

        it('should aggregate explicit inventory payloads with rolled loot tables', () => {
            const effectsObj = {
                inventory: { basic_item: 1 },
                loot: ['guaranteed_table'],
            };
            const result = LootManager.processLoot(effectsObj);

            expect(result.bits).toBe(100);
            // LootManager groups duplicate item IDs dynamically. (1 from payload + 2 from table)
            expect(result.items).toContainEqual({
                id: 'basic_item',
                amount: 3,
            });
        });

        it('should actively enforce maxCount inventory constraints if a player is provided', () => {
            const player = { inventory: { capped_item: 4 } }; // Has room for exactly 1 more
            const effectsObj = { inventory: { capped_item: 3 } }; // Trying to grant 3

            const result = LootManager.processLoot(effectsObj, { player });

            expect(result.items).toContainEqual({
                id: 'capped_item',
                amount: 1,
            }); // Blocked at 1
            expect(effectsObj.inventory['capped_item']).toBe(1); // Payload safely clamped for down-stream processing
        });
    });
});
