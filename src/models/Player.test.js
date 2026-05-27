const Player = require('./Player');

// Mock the ItemManager so we can explicitly test the item cooldown pruning logic
jest.mock('../managers/ItemManager', () => {
    return {
        getItem: jest.fn((id) => {
            if (id === 'active_cd') {
                return { isOnCooldown: () => true };
            }
            if (id === 'expired_cd') {
                return { isOnCooldown: () => false };
            }
            return null; // Item no longer exists
        }),
    };
});

describe('Player Model', () => {
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
        it('should retain history if logging in on the same day', () => {
            const data = {
                id: '123',
                history: {
                    last_login_date: '2026-05-27',
                    shop_general_store_patch_kit: 3,
                    daily_login_bonus: 1,
                    temp_buff: 1,
                },
            };
            const player = new Player(data);

            expect(player.history['shop_general_store_patch_kit']).toBe(3);
            expect(player.history['daily_login_bonus']).toBe(1);
            expect(player.history['temp_buff']).toBe(1);
        });

        it('should prune temporary and shop keys if logging in on a new day', () => {
            const data = {
                id: '123',
                history: {
                    last_login_date: '2026-05-26', // Yesterday
                    shop_general_store_patch_kit: 3,
                    daily_login_bonus: 1,
                    temp_buff: 1,
                    permanent_flag: 1,
                    item_used_active_cd: '2026-05-27T11:59:00Z',
                    item_used_expired_cd: '2026-05-26T12:00:00Z',
                    item_used_deleted_item: '2026-05-26T12:00:00Z',
                },
            };
            const player = new Player(data);

            // Verified Pruned Keys
            expect(
                player.history['shop_general_store_patch_kit'],
            ).toBeUndefined();
            expect(player.history['daily_login_bonus']).toBeUndefined();
            expect(player.history['temp_buff']).toBeUndefined();
            expect(player.history['item_used_expired_cd']).toBeUndefined();
            expect(player.history['item_used_deleted_item']).toBeUndefined();

            // Verified Retained Keys
            expect(player.history['permanent_flag']).toBe(1);
            expect(player.history['item_used_active_cd']).toBe(
                '2026-05-27T11:59:00Z',
            );

            // Verified Date Bump
            expect(player.history['last_login_date']).toBe('2026-05-27');
        });
    });
});
