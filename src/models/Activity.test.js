const Activity = require('./Activity');
const { checkRequirements } = require('../util/requirements');
const ItemManager = require('../managers/ItemManager');
const { calculateEffects, applyEffects } = require('../util/effects');
const LootManager = require('../managers/LootManager');

// Mock dependencies to isolate Activity testing
jest.mock('../util/requirements', () => ({
    checkRequirements: jest.fn(),
}));

jest.mock('../managers/ItemManager', () => ({
    getItem: jest.fn(),
}));

jest.mock('../util/effects', () => ({
    calculateEffects: jest.fn(),
    applyEffects: jest.fn(),
}));

jest.mock('../managers/LootManager', () => ({
    processLoot: jest.fn(),
}));

describe('Activity Model', () => {
    let mockContext;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = {
            byte: { id: 'test_byte', recordHistory: jest.fn() },
            player: {
                inventory: {},
                hasItem: jest.fn(),
                removeItem: jest.fn(),
            },
            locals: {},
        };
        
        // Default setup: requirements are met
        checkRequirements.mockReturnValue(true);

        // Default setup: effects are processed successfully without any loot
        calculateEffects.mockReturnValue({});
        applyEffects.mockReturnValue(true);
        LootManager.processLoot.mockReturnValue(null);
    });

    describe('canPerform()', () => {
        it('should return true if there are no requirements and no itemSelect', () => {
            const activity = new Activity({ id: 'basic_act', name: 'Basic' });
            expect(activity.canPerform(mockContext)).toBe(true);
            expect(checkRequirements).toHaveBeenCalledWith([], mockContext);
        });

        it('should return false if standard checkRequirements fails', () => {
            checkRequirements.mockReturnValue(false);
            const activity = new Activity({ id: 'hard_act', name: 'Hard', requirements: [{ type: 'energy', min: 10 }] });
            expect(activity.canPerform(mockContext)).toBe(false);
        });

        describe('with itemSelect', () => {
            it('should return false if player has no items', () => {
                const activity = new Activity({ id: 'feed_act', name: 'Feed', itemSelect: { type: 'consumable' } });
                mockContext.player.inventory = {}; // Empty inventory
                expect(activity.canPerform(mockContext)).toBe(false);
            });

            it('should return false if player has items, but none match the required type', () => {
                const activity = new Activity({ id: 'feed_act', name: 'Feed', itemSelect: { type: 'consumable' } });
                mockContext.player.inventory = { 'metal_scrap': 1 };
                ItemManager.getItem.mockReturnValue({ id: 'metal_scrap', type: 'material', isOnCooldown: () => false });
                expect(activity.canPerform(mockContext)).toBe(false);
            });

            it('should return false if player has a matching item, but it is on cooldown', () => {
                const activity = new Activity({ id: 'feed_act', name: 'Feed', itemSelect: { type: 'consumable' } });
                mockContext.player.inventory = { 'potion': 1 };
                ItemManager.getItem.mockReturnValue({ id: 'potion', type: 'consumable', isOnCooldown: () => true });
                expect(activity.canPerform(mockContext)).toBe(false);
            });

            it('should return true if player has at least one matching item by type', () => {
                const activity = new Activity({ id: 'feed_act', name: 'Feed', itemSelect: { type: 'consumable' } });
                mockContext.player.inventory = { 'potion': 1 };
                ItemManager.getItem.mockReturnValue({ id: 'potion', type: 'consumable', isOnCooldown: () => false });
                expect(activity.canPerform(mockContext)).toBe(true);
            });

            it('should return true if player has at least one matching item by explicit IDs', () => {
                const activity = new Activity({ id: 'unlock_act', name: 'Unlock', itemSelect: { ids: ['special_key'] } });
                mockContext.player.inventory = { 'special_key': 1 };
                ItemManager.getItem.mockReturnValue({ id: 'special_key', type: 'key', isOnCooldown: () => false });
                expect(activity.canPerform(mockContext)).toBe(true);
            });
        });
    });

    describe('perform()', () => {
        it('should return failure if canPerform is false and override is false', () => {
            const activity = new Activity({ id: 'test', name: 'Test' });
            checkRequirements.mockReturnValue(false); // Make canPerform fail

            const result = activity.perform(mockContext);
            expect(result.success).toBe(false);
            expect(calculateEffects).not.toHaveBeenCalled();
        });

        it('should proceed if canPerform is false but override is true', () => {
            const activity = new Activity({ id: 'test', name: 'Test' });
            checkRequirements.mockReturnValue(false); 

            const result = activity.perform(mockContext, null, true);
            expect(result.success).toBe(true);
            expect(calculateEffects).toHaveBeenCalled();
            expect(applyEffects).toHaveBeenCalled();
        });

        it('should process loot if calculateEffects returns loot, bits, or inventory', () => {
            const activity = new Activity({ id: 'test', name: 'Test' });
            calculateEffects.mockReturnValue({ bits: 100 });
            LootManager.processLoot.mockReturnValue({ bits: 100, items: [] });

            const result = activity.perform(mockContext);
            expect(LootManager.processLoot).toHaveBeenCalledWith({ bits: 100 }, mockContext);
            expect(result.grantedLoot).toEqual({ bits: 100, items: [] });
        });

        it('should record history if applyEffects is successful', () => {
            const activity = new Activity({ id: 'test', name: 'Test' });

            activity.perform(mockContext);
            expect(mockContext.byte.recordHistory).toHaveBeenCalledWith('test');
        });

        describe('item consumption', () => {
            it('should use the selected item and consume it if it is a consumable', () => {
                const activity = new Activity({ id: 'feed', name: 'Feed', itemSelect: { type: 'consumable' } });
                
                const mockItem = {
                    type: 'consumable',
                    isOnCooldown: jest.fn().mockReturnValue(false),
                    use: jest.fn().mockReturnValue({ success: true }),
                    isConsumed: true
                };
                ItemManager.getItem.mockReturnValue(mockItem);
                mockContext.player.hasItem.mockReturnValue(true);
                mockContext.player.inventory = { 'potion': 1 };

                activity.perform(mockContext, 'potion');

                expect(mockItem.use).toHaveBeenCalledWith(mockContext);
                expect(mockContext.player.removeItem).toHaveBeenCalledWith('potion', 1);
            });

            it('should use the selected item but NOT consume it if isConsumed is false', () => {
                const activity = new Activity({ id: 'feed', name: 'Feed', itemSelect: { type: 'consumable' } });
                
                const mockItem = {
                    type: 'consumable',
                    isOnCooldown: jest.fn().mockReturnValue(false),
                    use: jest.fn().mockReturnValue({ success: true }),
                    isConsumed: false
                };
                ItemManager.getItem.mockReturnValue(mockItem);
                mockContext.player.hasItem.mockReturnValue(true);
                mockContext.player.inventory = { 'everlasting_potion': 1 };

                activity.perform(mockContext, 'everlasting_potion');

                expect(mockItem.use).toHaveBeenCalledWith(mockContext);
                expect(mockContext.player.removeItem).not.toHaveBeenCalled();
            });

            it('should consume the item if activity itemSelect overrides isConsumed to true', () => {
                const activity = new Activity({ id: 'toss_coin', name: 'Toss Coin', itemSelect: { type: 'currency', isConsumed: true } });
                
                const mockItem = {
                    type: 'currency',
                    isOnCooldown: jest.fn().mockReturnValue(false),
                    use: jest.fn().mockReturnValue({ success: true }),
                    isConsumed: false // The item itself does not get consumed natively
                };
                ItemManager.getItem.mockReturnValue(mockItem);
                mockContext.player.hasItem.mockReturnValue(true);
                mockContext.player.inventory = { 'gold_coin': 1 };

                activity.perform(mockContext, 'gold_coin');

                expect(mockItem.use).toHaveBeenCalledWith(mockContext);
                expect(mockContext.player.removeItem).toHaveBeenCalledWith('gold_coin', 1);
            });
        });
    });
});