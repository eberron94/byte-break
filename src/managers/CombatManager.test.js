const CombatManager = require('./CombatManager');
const LuckManager = require('./LuckManager');

// Mock the LuckManager so we can deterministically control the RNG flow of battle
jest.mock('./LuckManager', () => ({
    checkCombatCompile: jest.fn(() => false),
    checkCombatOverride: jest.fn(() => false),
    checkCombatDodge: jest.fn(() => false),
    checkCombatShred: jest.fn(() => false),
    checkCombatCompression: jest.fn(() => false),
    checkCombatCrit: jest.fn(() => false),
    checkCombatParse: jest.fn(() => false),
    checkCombatSync: jest.fn(() => false),
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
            // Player deals 10 dmg/turn. Enemy deals 5 dmg/turn.
            // Player will win in 10 turns. Enemy will only deal 45 damage before dying.
            const result = CombatManager.simulate(playerByte, enemyByte);

            expect(result.winner).toBe('player');
            expect(result.finalState.enemy.hp).toBe(0);
            expect(result.finalState.player.hp).toBe(55); // 100 - (9 turns * 5 dmg)
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
            expect(result.log.length).toBeGreaterThan(100); // 1 start + (50 * 2 turns) + 1 end
        });
    });

    describe('Combat Skills & Mechanics', () => {
        it('should allow Dodging to completely negate a base attack', () => {
            // Force the enemy to dodge every single attack
            LuckManager.checkCombatDodge.mockImplementation(
                (attacker, defender) => defender.id === 'e1',
            );

            const result = CombatManager.simulate(playerByte, enemyByte);

            const dodgeLogs = result.log.filter((l) => l.action === 'miss');
            expect(dodgeLogs.length).toBeGreaterThan(0);
            expect(result.finalState.enemy.hp).toBe(100); // Took 0 damage
        });

        it('should correctly calculate Critical Hits for 1.5x damage', () => {
            LuckManager.checkCombatCrit.mockReturnValue(true); // Every hit is a crit

            const result = CombatManager.simulate(playerByte, enemyByte);

            const critLog = result.log.find(
                (l) => l.action === 'assault' && l.critical === true,
            );
            expect(critLog).toBeDefined();
            expect(critLog.damage).toBe(15); // 10 base * 1.5 multiplier
        });

        it('should process Compile (healing) if HP is under 50%', () => {
            LuckManager.checkCombatCompile.mockReturnValue(true);
            // Player starts at 10 HP (under 50%) and has 10 Compile skill
            playerByte = createMockByte('p1', 'Player', 10, 100, {
                compile: 10,
            });

            const result = CombatManager.simulate(playerByte, enemyByte);

            const compileLog = result.log.find((l) => l.action === 'compile');
            expect(compileLog).toBeDefined();
            expect(compileLog.amount).toBe(25); // 10 skill * 2.5 multiplier
        });

        it('should allow Override to consume TF and deal massive unavoidable damage', () => {
            LuckManager.checkCombatOverride.mockReturnValue(true);
            playerByte = createMockByte('p1', 'Player', 100, 50, {
                override: 10,
            });

            const result = CombatManager.simulate(playerByte, enemyByte);

            const overrideLog = result.log.find((l) => l.action === 'override');
            expect(overrideLog).toBeDefined();
            expect(overrideLog.tfCost).toBe(25);
            expect(overrideLog.damage).toBe(35); // 10 skill * 3.5 multiplier
            expect(result.finalState.player.tf).toBe(25); // 50 start - 25 cost
        });

        it('should allow Compression to stun the opponent, causing them to skip a turn', () => {
            LuckManager.checkCombatCompression.mockImplementation(
                (attacker) => attacker.id === 'p1',
            );

            const result = CombatManager.simulate(playerByte, enemyByte);
            const stunLog = result.log.find(
                (l) => l.action === 'stunned' && l.actor === 'e1',
            );

            expect(stunLog).toBeDefined();
        });
    });

    describe('Post-Match Results', () => {
        it('should grant Datamine bonus bits and apply Sync pacification upon victory', () => {
            LuckManager.checkCombatSync.mockReturnValue(true);
            playerByte = createMockByte('p1', 'Player', 100, 100, {
                datamine: 10,
            });
            enemyByte.pools.integrity.value = 5; // Instant win for player

            const result = CombatManager.simulate(playerByte, enemyByte, [
                { type: 'bits', amount: 100 },
            ]);

            expect(result.winner).toBe('player');
            expect(result.pacified).toBe(true);

            // datamine bonus = floor(15 * 10 * 0.05) = floor(7.5) = 7
            expect(result.winEffects).toContainEqual({
                type: 'bits',
                amount: 7,
            });
        });
    });
});
