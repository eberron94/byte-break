const GameContext = require('./GameContext');

// Mock the external dependencies so we can test GameContext in complete isolation
jest.mock('../managers/HediffManager', () => ({
    getHediff: jest.fn((id) => {
        if (id === 'solar_eclipse') {
            return { localOverrides: { timePhase: 'night' } };
        }
        return null;
    }),
}));

jest.mock('../util/time', () => ({
    getTimeContext: jest.fn(() => ({
        timePhase: 'day',
        dayOfWeek: 1,
    })),
}));

describe('GameContext Builder', () => {
    it('should initialize with default time properties from the time utility', () => {
        const context = new GameContext();
        expect(context.locals.timePhase).toBe('day');
        expect(context.locals.dayOfWeek).toBe(1);
    });

    it('should seamlessly merge extra locals', () => {
        const context = new GameContext(null, null, {
            tickCounter: 50,
            customVar: 'test',
        });
        expect(context.locals.tickCounter).toBe(50);
        expect(context.locals.customVar).toBe('test');
    });

    it('should apply local overrides from active player hediffs', () => {
        const player = { hediffs: { solar_eclipse: { stacks: 1 } } };
        const context = new GameContext(null, player);
        expect(context.locals.timePhase).toBe('night'); // Successfully overridden!
    });
});
