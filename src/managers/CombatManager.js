const LuckManager = require('./LuckManager');

class CombatManager {
    /**
     * Simulates an entire battle instantly and returns the combat log.
     * @param {Byte} playerByte - The player's Byte model
     * @param {Byte} enemyByte - The NPC Byte model
     */
    static simulate(playerByte, enemyByte, winEffectsConfig = []) {
        const log = [];
        let turn = 1;
        const maxTurns = 50; // Safety cap to prevent infinite loops

        // Wrapper objects so we don't mutate the actual Bytes until the simulation is approved
        const p = this.createCombatant(playerByte, 'player');
        const e = this.createCombatant(enemyByte, 'enemy');

        log.push({
            action: 'start',
            message: `COMBAT INITIATED: ${p.name} vs ${e.name}!`,
            state: {
                player: {
                    hp: p.hp,
                    maxHp: p.maxHp,
                    tf: p.tf,
                    maxTf: p.maxTf,
                },
                enemy: {
                    hp: e.hp,
                    maxHp: e.maxHp,
                    tf: e.tf,
                    maxTf: e.maxTf,
                },
            },
        });

        while (p.hp > 0 && e.hp > 0 && turn < maxTurns) {
            // Player Turn
            this.executeTurn(p, e, log);
            if (e.hp <= 0) break;

            // Enemy Turn
            this.executeTurn(e, p, log);
            turn++;
        }

        const winner = p.hp > 0 ? (e.hp > 0 ? 'draw' : 'player') : 'enemy';

        // Calculate Post-Match Loot and Pacification
        let pacified = false;
        let winEffects = [];

        if (winner === 'player') {
            winEffects = JSON.parse(JSON.stringify(winEffectsConfig || []));

            // Datamine increases the loot modifier
            if (this.getPoolSize(p.skills.datamine) > 0) {
                const rolls = LuckManager.rollCustomDice(p.skills.datamine);
                const bonusBits = LuckManager.countSuccesses(rolls) * 3;
                if (bonusBits > 0) {
                    winEffects.push({ type: 'bits', amount: bonusBits });
                }
            }

            if (this.getPoolSize(p.skills.sync) > 0) {
                const rolls = LuckManager.rollCustomDice(p.skills.sync);
                const syncSuccesses = LuckManager.countSuccesses(rolls);
                if (syncSuccesses > 0 && syncSuccesses >= this.getPoolSize(e.skills.firewall)) {
                    pacified = true;
                    log.push({
                        action: 'sync',
                        message: `${p.name} successfully Synced with the target, pacifying them!`,
                    });
                }
            }
        }

        log.push({
            action: 'end',
            message:
                winner === 'draw'
                    ? 'Combat ended in a stalemate!'
                    : `${winner === 'player' ? p.name : e.name} is the victor!`,
            winner,
        });

        return {
            winner,
            log,
            pacified,
            winEffects,
            enemyConfig: { name: enemyByte.name, byteClass: enemyByte.byteClass },
            finalState: {
                player: { hp: p.hp, tf: p.tf },
                enemy: { hp: e.hp, tf: e.tf },
            },
        };
    }

    static createCombatant(byte, id) {
        const skills = {};
        const skillKeys = ['assault', 'firewall', 'compile', 'shred', 'scan', 'parse', 'datamine', 'override', 'sync', 'spoof', 'compression'];
        skillKeys.forEach(k => {
            skills[k] = byte.getDicePool ? byte.getDicePool('skill', k) : [{ size: (byte.getSkills ? byte.getSkills()[k] : byte.skills[k]) || 0, sides: 6 }];
        });

        return {
            id,
            name: byte.name,
            hp: byte.pools.integrity.value,
            maxHp: byte.pools.integrity.maxValue || 100,
            tf: byte.pools.teraflops.value,
            maxTf: byte.pools.teraflops.maxValue || 100,
            skills,
            modifiers: {
                firewallShred: 0,
                stunned: false,
            },
        };
    }

    static getPoolSize(pool) {
        if (typeof pool === 'number') return pool;
        if (Array.isArray(pool)) return pool.reduce((sum, g) => sum + (g.size || 0), 0);
        return 0;
    }

    static applyShredToPool(pool, shredAmount) {
        if (shredAmount <= 0) return pool;
        let flatDice = [];
        if (typeof pool === 'number') {
            for (let i = 0; i < pool; i++) flatDice.push(6);
        } else if (Array.isArray(pool)) {
            pool.forEach(g => {
                for (let i = 0; i < (g.size || 0); i++) flatDice.push(g.sides || 6);
            });
        }
        flatDice.sort((a, b) => b - a); // Sort descending to remove largest first
        flatDice = flatDice.slice(shredAmount);
        
        const newPool = [];
        flatDice.forEach(sides => {
            const existing = newPool.find(g => g.sides === sides);
            if (existing) existing.size++;
            else newPool.push({ size: 1, sides });
        });
        return newPool;
    }

    static executeTurn(attacker, defender, log) {
        // 1. Check for Stun (Compression)
        if (attacker.modifiers.stunned) {
            log.push({
                actor: attacker.id,
                action: 'stunned',
                message: `${attacker.name} is condensed by compression and skips their cycle!`,
            });
            attacker.modifiers.stunned = false;
            return;
        }

        // 2. Heal / Shield Check (Compile)
        if (attacker.hp < attacker.maxHp * 0.5 && this.getPoolSize(attacker.skills.compile) > 0) {
            const rolls = LuckManager.rollCustomDice(attacker.skills.compile);
            const successes = LuckManager.countSuccesses(rolls);
            
            if (successes > 0) {
                const heal = successes * 5;
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                log.push({
                    actor: attacker.id,
                    action: 'compile',
                    amount: heal,
                    message: `${attacker.name} compiles emergency patches, restoring ${heal} Integrity (${successes} successes)!`,
                });
                return;
            }
        }

        // 3. Ultimate Attack (Override)
        if (attacker.tf >= 25 && this.getPoolSize(attacker.skills.override) > 0) {
            const rolls = LuckManager.rollCustomDice(attacker.skills.override);
            const successes = LuckManager.countSuccesses(rolls);
            
            if (successes > 0) {
                attacker.tf -= 25;
                const dmg = successes * 5 + 10;
                defender.hp -= dmg;
                log.push({
                    actor: attacker.id,
                    target: defender.id,
                    action: 'override',
                    damage: dmg,
                    tfCost: 25,
                    message: `${attacker.name} burns 25 TF to execute an OVERRIDE! Deals ${dmg} massive unavoidable damage to ${defender.name} (${successes} successes)!`,
                });
                return;
            }
        }

        // 4. Dodge Check (Spoof vs Scan)
        const dodgeCheck = LuckManager.opposedRoll(defender.skills.spoof, attacker.skills.scan);
        if (dodgeCheck.netSuccesses > 0) {
            log.push({
                actor: attacker.id,
                target: defender.id,
                action: 'miss',
                message: `${defender.name} spoofed their location (${dodgeCheck.netSuccesses} net successes)! ${attacker.name}'s assault missed.`,
            });
            return;
        }

        // 5. Debuff / Utility Rolls
        let activeFirewall = this.applyShredToPool(defender.skills.firewall, defender.modifiers.firewallShred);

        if (this.getPoolSize(activeFirewall) > 0 && this.getPoolSize(attacker.skills.shred) > 0) {
            const shredCheck = LuckManager.opposedRoll(attacker.skills.shred, activeFirewall);
            if (shredCheck.netSuccesses > 0) {
                defender.modifiers.firewallShred += shredCheck.netSuccesses;
                activeFirewall = this.applyShredToPool(defender.skills.firewall, defender.modifiers.firewallShred);
                log.push({
                    actor: attacker.id,
                    action: 'shred',
                    amount: shredCheck.netSuccesses,
                    message: `${attacker.name} shreds ${defender.name}'s Firewall by ${shredCheck.netSuccesses}!`,
                });
            }
        }
        
        if (this.getPoolSize(attacker.skills.compression) > 0) {
            const compCheck = LuckManager.opposedRoll(attacker.skills.compression, activeFirewall);
            // Stun requires overwhelmingly beating the firewall (net success >= 2)
            if (compCheck.netSuccesses >= 2) {
                defender.modifiers.stunned = true;
                log.push({
                    actor: attacker.id,
                    action: 'compression',
                    message: `${attacker.name} forcefully compresses ${defender.name}'s data (${compCheck.netSuccesses} net successes), stunning them for a cycle!`,
                });
                return; // Attack ends here
            }
        }

        // 6. Base Attack (Assault vs Firewall)
        const assaultCheck = LuckManager.opposedRoll(attacker.skills.assault, activeFirewall);
        // Critical Hit triggers if Scan heavily outmaneuvered Spoof during the Dodge Check
        const isCrit = dodgeCheck.netSuccesses <= -3; 
        
        let dmg = Math.max(1, assaultCheck.netSuccesses * 2); // 2 dmg per net success, minimum 1 scratch damage
        if (isCrit) dmg = Math.floor(dmg * 1.5);

        defender.hp -= dmg;
        log.push({
            actor: attacker.id,
            target: defender.id,
            action: 'assault',
            damage: dmg,
            critical: isCrit,
            message: `${attacker.name} assaults ${defender.name} for ${dmg} damage! [${assaultCheck.atkSuccesses} vs ${assaultCheck.defSuccesses} Successes]${isCrit ? ' (Critical Hit!)' : ''}`,
        });

        // 7. Counter-attack Check (Parse)
        if (defender.hp > 0 && this.getPoolSize(defender.skills.parse) > 0) {
            const parseCheck = LuckManager.opposedRoll(defender.skills.parse, attacker.skills.assault);
            if (parseCheck.netSuccesses > 0) {
                const counterDmg = parseCheck.netSuccesses * 2;
                attacker.hp -= counterDmg;
                log.push({
                    actor: defender.id,
                    target: attacker.id,
                    action: 'parse_counter',
                    damage: counterDmg,
                    message: `${defender.name} instantly parsed the incoming data and countered for ${counterDmg} damage!`,
                });
            }
        }
    }
}

module.exports = CombatManager;
