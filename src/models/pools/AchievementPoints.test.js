const bindAchievementPoints = require('./AchievementPoints');

// Mock the managers so we have a predictable, isolated economy
jest.mock('../../managers/AchievementManager', () => ({
    getAllAchievements: jest.fn(() => [
        {
            id: 'ach_tiers',
            tiers: [
                { requirement: 5, reward: 10 },
                { requirement: 10, reward: 20 },
            ],
        },
        {
            id: 'ach_legacy',
            requirement: 100,
            reward: 50,
        },
    ]),
}));

jest.mock('../../managers/TalentManager', () => ({
    getTalent: jest.fn((id) => {
        if (id === 'talent_cheap') return { cost: 5 };
        if (id === 'talent_expensive') return { cost: 20 };
        return null;
    }),
}));

describe('AchievementPoints Binding', () => {
    let mockPlayer;

    beforeEach(() => {
        mockPlayer = {
            talents: {},
        };
    });

    it('should calculate total earned AP (value) correctly from tiers and legacy achievements', () => {
        const progressData = {
            ach_tiers: 7, // Unlocks tier 1 (req 5, reward 10), but not tier 2 (req 10)
            ach_legacy: 105, // Unlocks legacy (req 100, reward 50)
        };
        bindAchievementPoints(mockPlayer, progressData);

        expect(mockPlayer.achievementPoints.value).toBe(60); // 10 + 50
    });

    it('should correctly sum multiple tiers', () => {
        const progressData = {
            ach_tiers: 15, // Unlocks tier 1 (req 5, reward 10) AND tier 2 (req 10, reward 20)
        };
        bindAchievementPoints(mockPlayer, progressData);

        expect(mockPlayer.achievementPoints.value).toBe(30); // 10 + 20
    });

    it('should calculate invested AP based on player talents and their costs', () => {
        bindAchievementPoints(mockPlayer, {});

        mockPlayer.talents = {
            talent_cheap: 2, // 2 levels * 5 cost = 10
            talent_expensive: 1, // 1 level * 20 cost = 20
            talent_missing: 5, // Missing from manager, shouldn't add to cost
        };

        expect(mockPlayer.achievementPoints.invested).toBe(30);
    });

    it('should correctly derive available AP', () => {
        const progressData = {
            ach_tiers: 15, // Earns 30 AP total
        };
        bindAchievementPoints(mockPlayer, progressData);

        mockPlayer.talents = {
            talent_cheap: 3, // Spends 15 AP
        };

        expect(mockPlayer.achievementPoints.available).toBe(15); // 30 - 15
    });

    it('should cap available AP at 0 if invested somehow exceeds value', () => {
        const progressData = {
            ach_tiers: 5, // Earns 10 AP total
        };
        bindAchievementPoints(mockPlayer, progressData);

        mockPlayer.talents = {
            talent_expensive: 1, // Spends 20 AP
        };

        expect(mockPlayer.achievementPoints.available).toBe(0); // 10 - 20 = -10 -> capped at 0
    });
});
