const LuckManager = require('./LuckManager');

describe('LuckManager', () => {
    describe('rollCustomDice', () => {
        it('should roll a standard numeric pool of dice', () => {
            const rolls = LuckManager.rollCustomDice(5, 6);
            expect(rolls.length).toBe(5);
            rolls.forEach((r) => {
                expect(r).toBeGreaterThanOrEqual(1);
                expect(r).toBeLessThanOrEqual(6);
            });
        });

        it('should roll a mixed pool of different sized dice', () => {
            // Mock Math.random to always roll maximum value on any die so we can mathematically verify the sides
            jest.spyOn(Math, 'random').mockReturnValue(0.999);

            const mixedPool = [
                { size: 2, sides: 6 }, // 2d6
                { size: 1, sides: 4 }, // 1d4
                { size: 3, sides: 8 }, // 3d8
            ];

            const rolls = LuckManager.rollCustomDice(mixedPool);
            expect(rolls.length).toBe(6);
            // Based on our Math.random mock, the rolls should equal the max sides of each die!
            expect(rolls).toEqual([6, 6, 4, 8, 8, 8]);

            jest.restoreAllMocks();
        });
    });

    describe('countSuccesses', () => {
        it('should count rolls less than or equal to the threshold as successes', () => {
            const rolls = [1, 2, 3, 4, 5, 6];
            const successes = LuckManager.countSuccesses(rolls, 3);
            expect(successes).toBe(3); // 1, 2, 3 are successes
        });
    });

    describe('opposedRoll', () => {
        it('should calculate net successes between two pools', () => {
            jest.spyOn(LuckManager, 'rollCustomDice')
                .mockReturnValueOnce([1, 2, 6, 6]) // Attack: 2 successes (<= 3)
                .mockReturnValueOnce([1, 5]); // Defend: 1 success (<= 3)

            const result = LuckManager.opposedRoll(4, 2, 6, 3);
            expect(result.netSuccesses).toBe(1); // 2 - 1

            jest.restoreAllMocks();
        });
    });
});
