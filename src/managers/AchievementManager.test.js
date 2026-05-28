const AchievementManager = require('./AchievementManager');
const GameEvents = require('../util/GameEvents');

// Mock the JSON data so we have a completely predictable set of achievements to test against
jest.mock('../../data/achievements.json', () => [
    {
        id: 'test_ach',
        name: 'Test Achievement',
        description: 'A test.',
        tiers: [
            {
                requirement: 5,
                reward: 2,
                effects: [{ type: 'bits', amount: 10 }],
            },
            { requirement: 10, reward: 5 },
            { requirement: 50, reward: 10 },
        ],
    },
]);

// Mock the effect evaluation so we don't need to load the full expression engine
jest.mock('../util/effects', () => ({
    calculateEffects: jest.fn(() => ({ bits: 10 })),
    applyEffects: jest.fn(() => true),
}));

jest.mock('../models/GameContext', () => {
    return jest.fn().mockImplementation(() => ({}));
});

describe('AchievementManager', () => {
    let mockGameManager;
    let mockPlayer;
    let mockByte;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPlayer = {
            achievementPoints: { progress: {} },
            history: {},
        };

        mockByte = { id: 'test_byte' };

        mockGameManager = {
            getPlayer: jest.fn().mockResolvedValue(mockPlayer),
            getByte: jest.fn().mockResolvedValue(mockByte),
            savePlayer: jest.fn().mockResolvedValue(true),
            saveByte: jest.fn().mockResolvedValue(true),
            emit: jest.fn(),
            on: jest.fn(),
        };

        // Force the manager to reload and use our newly mocked JSON array
        AchievementManager.achievements.clear();
        const achievementsData = require('../../data/achievements.json');
        achievementsData.forEach((ach) =>
            AchievementManager.achievements.set(ach.id, ach),
        );
    });

    describe('processAchievement()', () => {
        it('should increment progress without triggering a tier if requirement is not met', async () => {
            await AchievementManager.processAchievement(
                mockGameManager,
                'user1',
                'test_ach',
                3,
            );

            expect(mockPlayer.achievementPoints.progress['test_ach']).toBe(3);
            expect(mockGameManager.emit).not.toHaveBeenCalledWith(
                GameEvents.ACHIEVEMENT_UNLOCKED,
                expect.anything(),
                expect.anything(),
            );
            expect(mockGameManager.savePlayer).toHaveBeenCalledWith(mockPlayer);
        });

        it('should trigger tier unlock and apply effects when progress precisely reaches a tier requirement', async () => {
            mockPlayer.achievementPoints.progress['test_ach'] = 4;

            await AchievementManager.processAchievement(
                mockGameManager,
                'user1',
                'test_ach',
                1,
            );

            expect(mockPlayer.achievementPoints.progress['test_ach']).toBe(5);
            expect(
                mockPlayer.history['ach_unlocked_test_ach_tier_1'],
            ).toBeDefined();

            // Verify the global announcement event was fired with the correct tier data
            expect(mockGameManager.emit).toHaveBeenCalledWith(
                GameEvents.ACHIEVEMENT_UNLOCKED,
                'user1',
                expect.objectContaining({
                    id: 'test_ach',
                    tier: 1,
                    reward: 2,
                }),
            );

            const {
                calculateEffects,
                applyEffects,
            } = require('../util/effects');
            expect(calculateEffects).toHaveBeenCalled();
            expect(applyEffects).toHaveBeenCalled();

            // Verify the byte was saved since it received 'bits' effects from the unlock
            expect(mockGameManager.saveByte).toHaveBeenCalledWith(mockByte);
        });

        it('should trigger multiple tiers simultaneously if progress jumps across multiple thresholds', async () => {
            // Instantly grant 15 progress, which clears both the Tier 1 (5) and Tier 2 (10) requirements!
            await AchievementManager.processAchievement(
                mockGameManager,
                'user1',
                'test_ach',
                15,
            );

            expect(mockPlayer.achievementPoints.progress['test_ach']).toBe(15);

            // The global event should have fired twice, once for each tier
            expect(mockGameManager.emit).toHaveBeenCalledTimes(2);

            // History records should be stamped for both unlocks
            expect(
                mockPlayer.history['ach_unlocked_test_ach_tier_1'],
            ).toBeDefined();
            expect(
                mockPlayer.history['ach_unlocked_test_ach_tier_2'],
            ).toBeDefined();
        });

        it('should NOT re-trigger tier unlocks if the progress was already securely above the threshold', async () => {
            mockPlayer.achievementPoints.progress['test_ach'] = 6; // They already beat tier 1

            await AchievementManager.processAchievement(
                mockGameManager,
                'user1',
                'test_ach',
                1,
            ); // Now they have 7

            expect(mockPlayer.achievementPoints.progress['test_ach']).toBe(7);
            expect(mockGameManager.emit).not.toHaveBeenCalledWith(
                GameEvents.ACHIEVEMENT_UNLOCKED,
                expect.anything(),
                expect.anything(),
            );
        });
    });
});
