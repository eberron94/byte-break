const CombatManager = require('./CombatManager');
const LuckManager = require('./LuckManager');

// Mock the LuckManager so we can deterministically control the RNG flow of battle
jest.mock('./LuckManager', () => ({
    rollCustomDice: jest.fn((poolInput) => {
        let count = 0;
        if (typeof poolInput === 'number') count = poolInput;
        else if (Array.isArray(poolInput)) count = poolInput.reduce((sum, g) => sum + (g.size || 0), 0);
        return Array(count).fill(2);
    }),
    countSuccesses: jest.fn((rolls) => rolls.length),
    opposedRoll: jest.fn((attackPool, defendPool) => {
        const getCount = (pool) => {
            if (typeof pool === 'number') return pool;
            if (Array.isArray(pool)) return pool.reduce((sum, g) => sum + (g.size || 0), 0);
            return 0;
        };
        const atk = getCount(attackPool);
        const def = getCount(defendPool);
        return {
            atkSuccesses: atk,
            defSuccesses: def,
            netSuccesses: atk - def
        };
    })
}));

describe('CombatManager', () => {
    let playerByte;
    let enemyByte;

    // Helper to quickly generate a standard Byte payload for combat
    const createMockByte = (id, name, hp, tf, skills = {}) => ({
        id,
        name,
        byteClass: 'demo',
        pools: {
            integrity: { value: hp, maxValue: hp },
            teraflops: { value: tf, maxValue: tf },
        },
        getSkills: () => ({
            assault: 10,
            firewall: 0,
            compile: 0,
            shred: 0,
            scan: 0,
            parse: 0,
            datamine: 0,
            override: 0,
            sync: 0,
            spoof: 0,
            compression: 0,
            ...skills,
        }),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Standard matchup: Player has 100 HP and deals 10 DMG. Enemy has 100 HP and deals 5 DMG.
        playerByte = createMockByte('p1', 'Player', 100, 100, { assault: 10 });
        enemyByte = createMockByte('e1', 'Enemy', 100, 100, { assault: 5 });
    });

    describe('Core Battle Loop', () => {
        it('should correctly simulate a basic combat where the stronger player wins', () => {
            // Player has 10 Assault = 20 dmg/turn. Enemy has 5 Assault = 10 dmg/turn.
            // Player will win in 5 turns. Enemy will deal 40 damage before dying.
            const result = CombatManager.simulate(playerByte, enemyByte);

            expect(result.winner).toBe('player');
            expect(result.finalState.enemy.hp).toBe(0);
            expect(result.finalState.player.hp).toBe(60); // 100 - (4 turns * 10 dmg)
        });

        it('should enforce the maximum turn limit and resolve as a draw', () => {
            // Both deal 1 damage minimum (due to high firewall), have 1000 HP. Will hit 50 turn cap.
            playerByte.pools.integrity.value = 1000;
            enemyByte.pools.integrity.value = 1000;
            enemyByte.getSkills = () => ({ assault: 1, firewall: 100 });
            playerByte.getSkills = () => ({ assault: 1, firewall: 100 });

            const result = CombatManager.simulate(playerByte, enemyByte);

            expect(result.winner).toBe('draw');
            expect(result.finalState.player.hp).toBeGreaterThan(0);
            expect(result.finalState.enemy.hp).toBeGreaterThan(0);
            expect(result.log.length).toBe(100); // 1 start + (49 * 2 turns) + 1 end
        });
    });

    describe('Combat Skills & Mechanics', () => {
        it('should allow Dodging to completely negate a base attack', () => {
            // Force the enemy to dodge every single attack
            enemyByte = createMockByte('e1', 'Enemy', 100, 100, { spoof: 10, assault: 0 }); // vs Player scan 0 = 10 net success
            playerByte.getSkills = () => ({ assault: 10, scan: 0 });

            const result = CombatManager.simulate(playerByte, enemyByte);

            const dodgeLogs = result.log.filter((l) => l.action === 'miss');
            expect(dodgeLogs.length).toBeGreaterThan(0);
            expect(result.finalState.enemy.hp).toBe(100); // Took 0 damage
        });

        it('should correctly calculate Critical Hits for 1.5x damage', () => {
            // Crit triggers if dodge check (Spoof vs Scan) nets <= -3.
            playerByte = createMockByte('p1', 'Player', 100, 100, { assault: 10, scan: 10 });
            enemyByte = createMockByte('e1', 'Enemy', 100, 100, { spoof: 0, firewall: 0 });

            const result = CombatManager.simulate(playerByte, enemyByte);

            const critLog = result.log.find(
                (l) => l.action === 'assault' && l.critical === true,
            );
            expect(critLog).toBeDefined();
            expect(critLog.damage).toBe(30); // 10 successes * 2 base dmg * 1.5 crit mult
        });

        it('should process Compile (healing) if HP is under 50%', () => {
            // Player starts at 10 HP (under 50%) and has 10 Compile skill
            playerByte = createMockByte('p1', 'Player', 10, 100, {
                compile: 10,
            });
            playerByte.pools.integrity.maxValue = 100;

            const result = CombatManager.simulate(playerByte, enemyByte);

            const compileLog = result.log.find((l) => l.action === 'compile');
            expect(compileLog).toBeDefined();
            expect(compileLog.amount).toBe(50); // 10 successes * 5 healing
        });

        it('should allow Override to consume TF and deal massive unavoidable damage', () => {
            playerByte = createMockByte('p1', 'Player', 100, 50, {
                override: 10,
            });
            enemyByte.pools.integrity.value = 60;

            const result = CombatManager.simulate(playerByte, enemyByte);

            const overrideLog = result.log.find((l) => l.action === 'override');
            expect(overrideLog).toBeDefined();
            expect(overrideLog.tfCost).toBe(25);
            expect(overrideLog.damage).toBe(60); // 10 successes * 5 dmg + 10 base
            expect(result.finalState.player.tf).toBe(25); // 50 start - 25 cost
        });

        it('should allow Compression to stun the opponent, causing them to skip a turn', () => {
            // Stun requires net success >= 2
            playerByte = createMockByte('p1', 'Player', 100, 100, { compression: 5 }); 
            enemyByte = createMockByte('e1', 'Enemy', 100, 100, { firewall: 0 });

            const result = CombatManager.simulate(playerByte, enemyByte);
            const stunLog = result.log.find(
                (l) => l.action === 'stunned' && l.actor === 'enemy',
            );

            expect(stunLog).toBeDefined();
        });
    });

    describe('Post-Match Results', () => {
        it('should grant Datamine bonus bits and apply Sync pacification upon victory', () => {
            playerByte = createMockByte('p1', 'Player', 100, 100, {
                datamine: 10,
                sync: 10
            });
            // Instant win for player. Give enemy firewall to test Sync vs static skill value.
            enemyByte = createMockByte('e1', 'Enemy', 5, 100, { firewall: 5 }); 

            const result = CombatManager.simulate(playerByte, enemyByte, [
                { type: 'bits', amount: 100 },
            ]);

            expect(result.winner).toBe('player');
            expect(result.pacified).toBe(true);

            // datamine bonus = 10 successes * 3 bits = 30 bits
            expect(result.winEffects).toContainEqual({
                type: 'bits',
                amount: 30,
            });
        });
    });
});
