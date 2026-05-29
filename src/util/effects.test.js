const { evaluateExpression, calculateEffects } = require('./effects');

describe('Effects Utility', () => {
    describe('evaluateExpression', () => {
        it('should return raw numbers and booleans natively', () => {
            expect(evaluateExpression(42, { locals: {} })).toBe(42);
            expect(evaluateExpression(true, { locals: {} })).toBe(true);
        });

        it('should evaluate standard math strings', () => {
            expect(evaluateExpression('10 + 15', { locals: {} })).toBe(25);
            expect(evaluateExpression('Math.floor(10.5)', { locals: {} })).toBe(
                10,
            );
        });

        it('should correctly inject byte and player properties', () => {
            const context = {
                byte: { level: 5, stats: { logic: { value: 10 } } },
                player: { energy: { value: 50 } },
                locals: {},
            };

            expect(evaluateExpression('byte.level * 10', context)).toBe(50);
            expect(
                evaluateExpression('player.energy.value - 10', context),
            ).toBe(40);
        });

        it('should inject root-level environment locals', () => {
            const context = {
                byte: null,
                player: null,
                locals: { tickCounter: 10, stacks: 3 },
            };

            // Notice how 'tickCounter' and 'stacks' are evaluated directly, without needing a 'locals.' prefix!
            expect(evaluateExpression('tickCounter * 2', context)).toBe(20);
            expect(evaluateExpression('stacks + 5', context)).toBe(8);
        });
    });

    describe('calculateEffects', () => {
        it('should correctly calculate dynamic amounts into a flat delta object', () => {
            const effects = [{ type: 'bits', amount: 'byte.level * 100' }];
            const context = { byte: { level: 3 }, player: null, locals: {} };
            const result = calculateEffects(effects, context);

            expect(result.bits).toBe(300);
        });

        it('should correctly process dicePool mechanics and inject successCount', () => {
            const LuckManager = require('../managers/LuckManager');
            jest.spyOn(LuckManager, 'rollCustomDice').mockReturnValue([
                5, 6, 2,
            ]); // 2 successes (>= 4)
            jest.spyOn(LuckManager, 'countSuccesses').mockReturnValue(2);

            const effects = [
                { type: 'bits', dicePool: 3, amount: 'successCount * 10' },
            ];
            const context = { byte: { level: 3 }, player: null, locals: {} };
            const result = calculateEffects(effects, context);

            // 2 successes * 10 multiplier = 20 bits total
            expect(result.bits).toBe(20);
        });
    });
});
