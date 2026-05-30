const Item = require('./Item');

// Mock the effect evaluation so we don't need to load the full expression engine
jest.mock('../util/effects', () => ({
    calculateEffects: jest.fn(() => ({ integrity: 50 })),
    applyEffects: jest.fn(() => true),
}));

// Mock the LootManager to prevent external dependency calls
jest.mock('../managers/LootManager', () => ({
    processLoot: jest.fn(() => null),
}));

describe('Item Model', () => {
    let mockPlayer;
    let mockContext;

    beforeEach(() => {
        // Take control of Date.now() and new Date() so we can test cooldown math predictably
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T12:00:00Z')); // High noon

        mockPlayer = {
            history: {},
        };
        mockContext = {
            byte: { id: 'test_byte' },
            player: mockPlayer,
            locals: {},
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should default isConsumed to true if type is consumable', () => {
            const item = new Item({ name: 'Potion', type: 'consumable' });
            expect(item.isConsumed).toBe(true);
        });

        it('should respect an explicit isConsumed flag', () => {
            const item = new Item({
                name: 'Everlasting Potion',
                type: 'consumable',
                isConsumed: false,
            });
            expect(item.isConsumed).toBe(false);
        });
    });

    describe('Cooldown Mechanics', () => {
        it('should not enforce cooldowns on items with 0 cooldown', () => {
            const item = new Item({ name: 'NoCD', cooldown: 0 });
            // Pretend it was used exactly right now
            mockPlayer.history[`item_used_${item.id}`] =
                new Date().toISOString();

            expect(item.isOnCooldown(mockPlayer)).toBe(false);
            expect(item.getCooldownRemaining(mockPlayer)).toBe(0);
        });

        it('should accurately report cooldown status and remaining time', () => {
            const item = new Item({ name: 'Big CD', cooldown: 5 }); // 5 minutes
            // Set history to 2 minutes ago
            mockPlayer.history[`item_used_${item.id}`] = new Date(
                '2026-01-01T11:58:00Z',
            ).toISOString();

            expect(item.isOnCooldown(mockPlayer)).toBe(true);
            expect(item.getCooldownRemaining(mockPlayer)).toBe(3); // 3 minutes left

            // Instantly fast-forward time by exactly 3 minutes and 1 second
            jest.advanceTimersByTime(3.01 * 60 * 1000);

            expect(item.isOnCooldown(mockPlayer)).toBe(false);
            expect(item.getCooldownRemaining(mockPlayer)).toBe(0);
        });
    });

    describe('use() Function', () => {
        it('should throw an error if used while on an active cooldown', () => {
            const item = new Item({ name: 'StrictCD', cooldown: 10 });
            mockPlayer.history[`item_used_${item.id}`] = new Date(
                '2026-01-01T11:55:00Z',
            ).toISOString(); // 5 mins ago

            expect(() => item.use(mockContext)).toThrow(
                'Item is on cooldown. Wait 5 minute(s).',
            );
        });

        it('should apply effects and record usage timestamp if cooldown is configured', () => {
            const { applyEffects } = require('../util/effects');
            const item = new Item({
                name: 'Heal',
                cooldown: 10,
                useEffects: [{ type: 'integrity', amount: 50 }],
            });

            const result = item.use(mockContext);

            expect(applyEffects).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(mockPlayer.history[`item_used_${item.id}`]).toBe(
                '2026-01-01T12:00:00.000Z',
            );
        });
    });
});
