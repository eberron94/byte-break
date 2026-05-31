const { checkRequirements } = require('./requirements');

describe('Requirements Utility', () => {
    let mockContext;

    beforeEach(() => {
        mockContext = {
            byte: {
                pools: {
                    integrity: { value: 50, maxValue: 100 },
                },
                stats: {
                    logic: { value: 10 },
                },
            },
            player: {
                energy: { value: 20 },
            },
            locals: {},
        };
    });

    it('should return true if requirements are empty or null', () => {
        expect(checkRequirements([], mockContext)).toBe(true);
        expect(checkRequirements(null, mockContext)).toBe(true);
    });

    describe('Bounds Evaluation (min / max)', () => {
        it('should evaluate min bounds correctly', () => {
            const passReq = [{ type: 'pool', key: 'integrity', min: 40 }];
            const failReq = [{ type: 'pool', key: 'integrity', min: 60 }];
            expect(checkRequirements(passReq, mockContext)).toBe(true);
            expect(checkRequirements(failReq, mockContext)).toBe(false);
        });

        it('should evaluate max bounds correctly', () => {
            const passReq = [{ type: 'pool', key: 'integrity', max: 60 }];
            const failReq = [{ type: 'pool', key: 'integrity', max: 40 }];
            expect(checkRequirements(passReq, mockContext)).toBe(true);
            expect(checkRequirements(failReq, mockContext)).toBe(false);
        });

        it('should handle exact boundary matches', () => {
            const exactMinReq = [{ type: 'pool', key: 'integrity', min: 50 }];
            const exactMaxReq = [{ type: 'pool', key: 'integrity', max: 50 }];
            expect(checkRequirements(exactMinReq, mockContext)).toBe(true);
            expect(checkRequirements(exactMaxReq, mockContext)).toBe(true);
        });
    });

    describe('Capacity Bounds Evaluation (maxValueMin / maxValueMax)', () => {
        it('should evaluate maxValueMin correctly', () => {
            const passReq = [
                { type: 'pool', key: 'integrity', maxValueMin: 90 },
            ];
            const failReq = [
                { type: 'pool', key: 'integrity', maxValueMin: 110 },
            ];
            expect(checkRequirements(passReq, mockContext)).toBe(true);
            expect(checkRequirements(failReq, mockContext)).toBe(false);
        });

        it('should evaluate maxValueMax correctly', () => {
            const passReq = [
                { type: 'pool', key: 'integrity', maxValueMax: 110 },
            ];
            const failReq = [
                { type: 'pool', key: 'integrity', maxValueMax: 90 },
            ];
            expect(checkRequirements(passReq, mockContext)).toBe(true);
            expect(checkRequirements(failReq, mockContext)).toBe(false);
        });
    });

    describe('Dynamic Math Expressions', () => {
        it('should accurately evaluate bounds using context expressions', () => {
            // min: player.energy.value * 2 (20 * 2 = 40) <= 50 (true)
            const passReq = [
                {
                    type: 'pool',
                    key: 'integrity',
                    min: 'player.energy.value * 2',
                },
            ];
            // max: byte.stats.logic.value * 4 (10 * 4 = 40) >= 50 (false)
            const failReq = [
                {
                    type: 'pool',
                    key: 'integrity',
                    max: 'byte.stats.logic.value * 4',
                },
            ];

            expect(checkRequirements(passReq, mockContext)).toBe(true);
            expect(checkRequirements(failReq, mockContext)).toBe(false);
        });
    });

    describe('History Evaluation', () => {
        it('should correctly fallback to byte history if not in player history', () => {
            mockContext.byte.history = { 'battle_wins': 5 };
            mockContext.player.history = {};
            const req = [{ type: 'history', key: 'battle_wins', min: 5 }];
            expect(checkRequirements(req, mockContext)).toBe(true);
        });

        it('should evaluate strictly player history if target is player', () => {
            mockContext.byte.history = { 'battle_wins': 5 };
            mockContext.player.history = {};
            const req = [{ type: 'history', target: 'player', key: 'battle_wins', min: 5 }];
            expect(checkRequirements(req, mockContext)).toBe(false);
        });

        it('should evaluate strictly byte history if target is byte', () => {
            mockContext.player.history = { 'battle_wins': 5 };
            mockContext.byte.history = {};
            const req = [{ type: 'history', target: 'byte', key: 'battle_wins', min: 5 }];
            expect(checkRequirements(req, mockContext)).toBe(false);
        });
    });
});
