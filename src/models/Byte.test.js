const { Byte } = require('./Byte');

// Mock SkillManager to avoid loading real skills and deep dependencies during basic initialization tests
jest.mock('../managers/SkillManager', () => ({
    getAllSkills: jest.fn(() => []),
}));

describe('Byte Model', () => {
    beforeEach(() => {
        // Take control of the system clock so "today" is always deterministic
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-05-27T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('Daily History Reset', () => {
        it('should retain history if activated on the same day', () => {
            const data = {
                ownerId: '123',
                name: 'TestByte',
                history: {
                    last_active_date: '2026-05-27',
                    daily_training: 1,
                    temp_boost: 2,
                    permanent_flag: 5,
                },
            };
            const byte = new Byte(data);

            expect(byte.history['daily_training']).toBe(1);
            expect(byte.history['temp_boost']).toBe(2);
            expect(byte.history['permanent_flag']).toBe(5);
        });

        it('should prune temporary and daily keys if activated on a new day', () => {
            const data = {
                ownerId: '123',
                name: 'TestByte',
                history: {
                    last_active_date: '2026-05-26', // Yesterday
                    daily_training: 1,
                    temp_boost: 2,
                    permanent_flag: 5,
                },
            };
            const byte = new Byte(data);

            // Verified Pruned Keys
            expect(byte.history['daily_training']).toBeUndefined();
            expect(byte.history['temp_boost']).toBeUndefined();

            // Verified Retained Keys
            expect(byte.history['permanent_flag']).toBe(5);

            // Verified Date Bump
            expect(byte.history['last_active_date']).toBe('2026-05-27');
        });
    });
});
