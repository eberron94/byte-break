const { Byte } = require('./Byte');

// Mock SkillManager to avoid loading real skills and deep dependencies during basic initialization tests
jest.mock('../managers/SkillManager', () => ({
    getAllSkills: jest.fn(() => [

jest.mock('../managers/ItemManager', () => ({
    getItem: jest.fn(),
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

    describe('Equipment & Capacities', () => {
        it('should correctly scale hardware and software capacities based on level', () => {
            const byte = new Byte({ ownerId: '123', name: 'Test' });
            
            // Level 1: 1 HW, 1 SW
            jest.spyOn(byte, 'level', 'get').mockReturnValue(1);
            expect(byte.getHardwareCapacity()).toBe(1);
            expect(byte.getSoftwareCapacity()).toBe(1);

            // Level 3: 1 HW, 2 SW
            jest.spyOn(byte, 'level', 'get').mockReturnValue(3);
            expect(byte.getHardwareCapacity()).toBe(1);
            expect(byte.getSoftwareCapacity()).toBe(2);

            // Level 6: 2 HW, 2 SW
            jest.spyOn(byte, 'level', 'get').mockReturnValue(6);
            expect(byte.getHardwareCapacity()).toBe(2);
            expect(byte.getSoftwareCapacity()).toBe(2);

            // Level 9: 2 HW, 3 SW
            jest.spyOn(byte, 'level', 'get').mockReturnValue(9);
            expect(byte.getHardwareCapacity()).toBe(2);
            expect(byte.getSoftwareCapacity()).toBe(3);
        });

        it('should correctly apply talent bonuses to capacities', () => {
            const byte = new Byte({ ownerId: '123', name: 'Test' });
            jest.spyOn(byte, 'level', 'get').mockReturnValue(1);

            const mockPlayer = {
                talents: {
                    hardware_capacity: 1,
                    software_capacity: 2,
                },
            };

            expect(byte.getHardwareCapacity(mockPlayer)).toBe(2); // 1 base + 1 talent
            expect(byte.getSoftwareCapacity(mockPlayer)).toBe(3); // 1 base + 2 talent
        });

        it('should aggregate modifiers from equipped items', () => {
            const ItemManager = require('../managers/ItemManager');
            ItemManager.getItem.mockImplementation((id) => {
                if (id === 'hw_item') return { modifiers: [{ type: 'skill', key: 'assault', amount: 3 }] };
                if (id === 'sw_item') return { modifiers: [{ type: 'skill', key: 'assault', amount: 2 }] };
                return null;
            });

            const byte = new Byte({ 
                ownerId: '123', 
                name: 'Test',
                loadout: { hardware: ['hw_item'], software: ['sw_item'] },
            });

            expect(byte.getEquipmentModifier('skill', 'assault')).toBe(5); // 3 + 2
        });

        it('should process tickEffects from equipped items during the global tick', () => {
            const ItemManager = require('../managers/ItemManager');
            ItemManager.getItem.mockImplementation((id) => {
                if (id === 'daemon_item') return { tickEffects: [{ type: 'charge', amount: 10, ticksPerTrigger: 2 }] };
                return null;
            });

            const byte = new Byte({ ownerId: '123', name: 'Test', loadout: { hardware: [], software: ['daemon_item'] }});
            jest.spyOn(byte.needs.charge, 'satisfy');
            byte.tick({ player: {}, locals: { tickCounter: 2 } });
            expect(byte.needs.charge.satisfy).toHaveBeenCalledWith(10);
        });

        it('should assemble a mixed dice pool from base stats and equipment', () => {
            const ItemManager = require('../managers/ItemManager');
            ItemManager.getItem.mockImplementation((id) => {
                if (id === 'broadsword') return { modifiers: [{ type: 'skill', key: 'assault', amount: 3, sides: 8 }] };
                return null;
            });

            const byte = new Byte({ 
                ownerId: '123', 
                name: 'Test',
                assault: 10,
                loadout: { hardware: ['broadsword'], software: [] },
            });

            const pool = byte.getDicePool('skill', 'assault');
            expect(pool).toEqual([
                { size: 10, sides: 6 },
                { size: 3, sides: 8 }
            ]);
        });
    });
});
