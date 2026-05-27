const Shop = require('./Shop');

// Mock the external dependencies to isolate the Shop logic
jest.mock('../managers/GameObjectManager', () => ({
    formatEffectsList: jest.fn(() => 'Mocked Effects'),
}));

jest.mock('../util/requirements', () => ({
    checkRequirements: jest.fn(() => true),
}));

describe('Shop Model', () => {
    let mockItemManager;
    let mockPlayer;

    beforeEach(() => {
        jest.clearAllMocks();

        // Provide a predictable catalog of items
        mockItemManager = {
            getAllItems: jest.fn(() => [
                { id: 'potion', type: 'consumable', cost: 100 },
                { id: 'sword', type: 'weapon', cost: 500 },
                { id: 'key_item', type: 'key', cost: 1000 },
            ]),
        };

        // Provide a mock player with an adjustable purchase history
        mockPlayer = {
            history: {},
            hasItem: jest.fn((id) => id === 'key_item'), // Pretend the player already owns the key
        };
    });

    describe('getAvailableItems()', () => {
        it('should correctly calculate the price of items using priceMultiplier', () => {
            const shop = new Shop({
                id: 'test_shop',
                priceMultiplier: 1.5,
                categories: ['consumable'],
            });
            const items = shop.getAvailableItems(mockItemManager, mockPlayer);

            expect(items.length).toBe(1);
            expect(items[0].id).toBe('potion');
            expect(items[0].calculatedCost).toBe(150); // 100 base * 1.5 multiplier
        });

        it('should apply specific stock limits and reduce them based on player history', () => {
            const shop = new Shop({
                id: 'test_shop',
                categories: ['weapon'],
                stock: { sword: 5 },
            });

            // Pretend the player has already bought 2 swords from this specific shop
            mockPlayer.history['shop_test_shop_sword'] = 2;

            const items = shop.getAvailableItems(mockItemManager, mockPlayer);
            expect(items[0].remainingStock).toBe(3); // 5 total - 2 bought
        });

        it('should safely fall back to defaultStock for items missing from the stock dictionary', () => {
            const shop = new Shop({
                id: 'test_shop',
                categories: ['consumable', 'weapon'],
                stock: { sword: 5 },
                defaultStock: 10,
            });

            const items = shop.getAvailableItems(mockItemManager, mockPlayer);

            const potion = items.find((i) => i.id === 'potion');
            const sword = items.find((i) => i.id === 'sword');

            expect(potion.remainingStock).toBe(10); // Inherits defaultStock
            expect(sword.remainingStock).toBe(5); // Overrides defaultStock with specific limit
        });

        it('should cap remainingStock at 0 if the player has bought the limit or more', () => {
            const shop = new Shop({
                id: 'test_shop',
                categories: ['consumable'],
                defaultStock: 2,
            });
            mockPlayer.history['shop_test_shop_potion'] = 5; // Bought way over the limit

            const items = shop.getAvailableItems(mockItemManager, mockPlayer);
            expect(items[0].remainingStock).toBe(0); // Safely clamped to 0
        });

        it('should automatically filter out "key" items if the player already owns them', () => {
            const shop = new Shop({ id: 'test_shop', categories: ['key'] });
            const items = shop.getAvailableItems(mockItemManager, mockPlayer);

            // The mockItemManager provides 'key_item', but mockPlayer.hasItem('key_item') returns true
            expect(items.length).toBe(0);
        });
    });
});
