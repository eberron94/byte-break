const LuckManager = require('./LuckManager');
const LootManager = require('./LootManager');
const GameEvents = require('../util/GameEvents');
const GameContext = require('../models/GameContext');
const Enemy = require('../models/Enemy');
const EnemyManager = require('./EnemyManager');
const CombatMetrics = require('../models/CombatMetrics');
const { calculateEffects, applyEffects } = require('../util/effects');

class CombatManager {
    /**
     * Simulates an entire battle instantly and returns the combat log.
     * @param {Byte} playerByte - The player's Byte model
     * @param {Byte} enemyByte - The NPC Byte model
     */
    static simulate(playerByte, enemyByte, winEffectsConfig = []) {
        const log = [];
        let turn = 1;
        const maxTurns = 1000; // Safety cap to prevent infinite loops

        // Wrapper objects so we don't mutate the actual Bytes until the simulation is approved
        const p = this.createCombatant(playerByte, 'player');
        const e = this.createCombatant(enemyByte, 'enemy');

        const metrics = new CombatMetrics();
        metrics.matches = 1;

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
            this.executeTurn(p, e, log, metrics);
            if (e.hp <= 0) break;

            // Enemy Turn
            this.executeTurn(e, p, log, metrics);
            turn++;
        }

        metrics.turns = turn;

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
                if (
                    syncSuccesses > 0 &&
                    syncSuccesses >= this.getPoolSize(e.skills.firewall)
                ) {
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
            metrics,
            enemyConfig: {
                name: enemyByte.name,
                byteClass: enemyByte.byteClass || enemyByte.enemyClass,
            },
            finalState: {
                player: { hp: p.hp, tf: p.tf },
                enemy: { hp: e.hp, tf: e.tf },
            },
        };
    }

    /**
     * Runs a sequence of battles and accumulates rewards, losses, and stats.
     */
    static simulateGauntlet(byte, player, baseEnemy, count) {
        const context = new GameContext(byte, player);
        let wins = 0, losses = 0, draws = 0;
        const allGrantedLoot = { bits: 0, items: {} };
        const initialHp = byte.pools.integrity.value;
        const initialTf = byte.pools.teraflops.value;

        const gauntletMetrics = new CombatMetrics();

        for (let i = 0; i < count; i++) {
            if (byte.pools.integrity.value <= 0) break;

            const enemyByte = new Enemy({
                ...baseEnemy,
                skills: { ...baseEnemy.skills }
            });

            const result = this.simulate(byte, enemyByte, enemyByte.winEffects);
            
            byte.pools.integrity.value = Math.max(0, result.finalState.player.hp);
            byte.pools.teraflops.value = Math.max(0, result.finalState.player.tf);

            if (result.winner === 'player') {
                wins++;
                const calculatedWinEffects = calculateEffects(result.winEffects, context);
                const grantedLoot = LootManager.processLoot(calculatedWinEffects, context);
                applyEffects(calculatedWinEffects, context);

                let matchBits = 0;
                let matchItems = [];

                if (enemyByte.primaryDrop) {
                    const dropId = enemyByte.primaryDrop.id || `drop_${enemyByte.id}`;
                    player.addItem(dropId, 1);
                    allGrantedLoot.items[dropId] = (allGrantedLoot.items[dropId] || 0) + 1;
                    matchItems.push({ id: dropId, amount: 1 });
                }

                if (grantedLoot && grantedLoot.bits) {
                    allGrantedLoot.bits += grantedLoot.bits;
                    matchBits += grantedLoot.bits;
                }
                if (grantedLoot && grantedLoot.items) {
                    for (const item of grantedLoot.items) {
                        allGrantedLoot.items[item.id] = (allGrantedLoot.items[item.id] || 0) + item.amount;
                        matchItems.push(item);
                    }
                }
                
                if (result.metrics) result.metrics.addLoot(matchBits, matchItems);

                player.pendingEvents.push({ event: GameEvents.COMBAT_WIN, args: [player.id] });
            } else if (result.winner === 'enemy') {
                losses++;
                player.pendingEvents.push({ event: GameEvents.COMBAT_LOSS, args: [player.id] });
            } else {
                draws++;
            }

            if (result.metrics) {
                console.log(result.metrics.toString(`Gauntlet Round ${i + 1}`));
                gauntletMetrics.add(result.metrics);
            }

            if (i < count - 1 && byte.pools.integrity.value > 0) {
                const tfRecoveryRank = player.talents['hunting_recovery'] || 0;
                if (tfRecoveryRank > 0) {
                    const recoveredTf = Math.floor(byte.pools.teraflops.maxValue * 0.05 * tfRecoveryRank);
                    byte.pools.teraflops.value = Math.min(byte.pools.teraflops.maxValue, byte.pools.teraflops.value + recoveredTf);
                }
            }
        }

        const totalHpLost = initialHp - byte.pools.integrity.value;
        const totalTfLost = initialTf - byte.pools.teraflops.value;

        if (process.env.DEBUG_INF_INTEGRITY === 'true') {
            byte.pools.integrity.value = byte.pools.integrity.maxValue;
        }
        if (process.env.DEBUG_INF_TERAFLOPS === 'true') {
            byte.pools.teraflops.value = byte.pools.teraflops.maxValue;
        }

        console.log(gauntletMetrics.toString('Gauntlet'));
        console.log('\n--- HUNT GAUNTLET METRICS ---');
        console.log(gauntletMetrics);

        byte.addCombatMetrics(gauntletMetrics);
        player.addCombatMetrics(gauntletMetrics);

        player.pendingEvents.push({
            event: GameEvents.COMBAT_METRICS_RECORDED,
            args: [player.id, gauntletMetrics],
        });

        if (wins > 0) {
            byte.recordHistory('combat_wins', wins);
            player.recordHistory('combat_wins', wins);
            player.recordHistory('gauntlet_rounds_won', wins);
        }
        if (losses > 0) {
            byte.recordHistory('combat_losses', losses);
            player.recordHistory('combat_losses', losses);
        }
        if (draws > 0) {
            byte.recordHistory('combat_draws', draws);
            player.recordHistory('combat_draws', draws);
        }

        const totalEnergyLost = gauntletMetrics.turns;
        player.energy.decrease(totalEnergyLost);

        if (process.env.DEBUG_INF_ENERGY === 'true') {
            player.energy.value = player.energy.maxValue;
        }

        return {
            wins,
            losses,
            draws,
            allGrantedLoot,
            totalHpLost,
            totalTfLost,
            totalEnergyLost,
            metrics: gauntletMetrics,
        };
    }

    /**
     * Runs a single combat match based on a combat configuration object.
     */
    static runSingleMatch(byte, player, combatConfig) {
        if (byte.pools.integrity.value <= 0) {
            throw new Error('Byte lacks sufficient Integrity to fight.');
        }

        const baseEnemy = EnemyManager.getEnemy(
            combatConfig.enemyId || 'training_virus',
        );
        if (!baseEnemy) {
            throw new Error('Enemy not found');
        }

        const eHp = combatConfig.hp || baseEnemy.hp;
        const eTf = combatConfig.tf || baseEnemy.tf;

        const enemyByte = new Enemy({
            id: baseEnemy.id,
            name: baseEnemy.name,
            enemyClass: baseEnemy.enemyClass,
            hp: eHp,
            tf: eTf,
            skills: { ...baseEnemy.skills },
            winEffects: baseEnemy.winEffects,
            primaryDrop: baseEnemy.primaryDrop,
        });

        if (combatConfig.skills) {
            for (const [sKey, sVal] of Object.entries(combatConfig.skills)) {
                if (enemyByte.skills[sKey])
                    enemyByte.skills[sKey].investedValue = sVal;
            }
        }

        const result = this.simulate(byte, enemyByte, enemyByte.winEffects);
        
        const context = new GameContext(byte, player);

        const initialHp = byte.pools.integrity.value;
        const initialTf = byte.pools.teraflops.value;

        // Apply post-match HP and TF losses
        if (process.env.DEBUG_INF_INTEGRITY === 'true') {
            byte.pools.integrity.value = byte.pools.integrity.maxValue;
        } else {
            byte.pools.integrity.value = Math.max(0, result.finalState.player.hp);
        }
        
        if (process.env.DEBUG_INF_TERAFLOPS === 'true') {
            byte.pools.teraflops.value = byte.pools.teraflops.maxValue;
        } else {
            byte.pools.teraflops.value = Math.max(0, result.finalState.player.tf);
        }

        const grantedLoot = { bits: 0, items: [] };

        if (result.winner === 'player') {
            const calculatedWinEffects = calculateEffects(result.winEffects, context);
            const processedLoot = LootManager.processLoot(calculatedWinEffects, context);
            applyEffects(calculatedWinEffects, context);

            if (processedLoot) {
                if (processedLoot.bits) grantedLoot.bits = processedLoot.bits;
                if (processedLoot.items) {
                    for (const item of processedLoot.items) {
                        grantedLoot.items.push({ ...item });
                    }
                }
            }

            if (enemyByte.primaryDrop) {
                const dropId = enemyByte.primaryDrop.id || `drop_${enemyByte.id}`;
                player.addItem(dropId, 1);

                const existingItem = grantedLoot.items.find((i) => i.id === dropId);
                if (existingItem) existingItem.amount += 1;
                else grantedLoot.items.push({ id: dropId, amount: 1 });
            }
            
            if (result.metrics) result.metrics.addLoot(grantedLoot.bits, grantedLoot.items);

            player.pendingEvents.push({
                event: GameEvents.COMBAT_WIN,
                args: [player.id],
            });
        } else if (result.winner === 'enemy') {
            player.pendingEvents.push({
                event: GameEvents.COMBAT_LOSS,
                args: [player.id],
            });
        }

        const hpDelta = byte.pools.integrity.value - initialHp;
        const tfDelta = byte.pools.teraflops.value - initialTf;

        if (result.metrics) {
            console.log(result.metrics.toString('Single Match'));
            console.log('\n--- COMBAT METRICS ---');
            console.log(result.metrics);

            byte.addCombatMetrics(result.metrics);
            player.addCombatMetrics(result.metrics);

            player.pendingEvents.push({
                event: GameEvents.COMBAT_METRICS_RECORDED,
                args: [player.id, result.metrics],
            });
        }

        if (result.winner === 'player') {
            byte.recordHistory('combat_wins');
            player.recordHistory('combat_wins');
        } else if (result.winner === 'enemy') {
            byte.recordHistory('combat_losses');
            player.recordHistory('combat_losses');
        } else {
            byte.recordHistory('combat_draws');
            player.recordHistory('combat_draws');
        }

        return {
            result,
            grantedLoot,
            hpDelta,
            tfDelta,
        };
    }

    static createCombatant(byte, id) {
        const skills = {};
        const skillKeys = [
            'assault',
            'firewall',
            'compile',
            'shred',
            'scan',
            'parse',
            'datamine',
            'override',
            'sync',
            'spoof',
            'compression',
        ];
        skillKeys.forEach((k) => {
            skills[k] = byte.getDicePool
                ? byte.getDicePool('skill', k)
                : [
                      {
                          size:
                              (byte.getSkills
                                  ? byte.getSkills()[k]
                                  : byte.skills
                                    ? byte.skills[k]
                                    : 0) || 0,
                          sides: 6,
                      },
                  ];
        });

        const hp =
            byte.pools && byte.pools.integrity
                ? byte.pools.integrity.value
                : byte.hp !== undefined
                  ? byte.hp
                  : 100;
        const maxHp =
            byte.pools && byte.pools.integrity
                ? byte.pools.integrity.maxValue || 100
                : byte.hp !== undefined
                  ? byte.hp
                  : 100;
        const tf =
            byte.pools && byte.pools.teraflops
                ? byte.pools.teraflops.value
                : byte.tf !== undefined
                  ? byte.tf
                  : 100;
        const maxTf =
            byte.pools && byte.pools.teraflops
                ? byte.pools.teraflops.maxValue || 100
                : byte.tf !== undefined
                  ? byte.tf
                  : 100;

        return {
            id,
            name: byte.name,
            hp,
            maxHp,
            tf,
            maxTf,
            skills,
            modifiers: {
                firewallShred: 0,
                stunned: false,
            },
        };
    }

    static getPoolSize(pool) {
        if (typeof pool === 'number') return pool;
        if (Array.isArray(pool))
            return pool.reduce((sum, g) => sum + (g.size || 0), 0);
        return 0;
    }

    static applyShredToPool(pool, shredAmount) {
        if (shredAmount <= 0) return pool;
        let flatDice = [];
        if (typeof pool === 'number') {
            for (let i = 0; i < pool; i++) flatDice.push(6);
        } else if (Array.isArray(pool)) {
            pool.forEach((g) => {
                for (let i = 0; i < (g.size || 0); i++)
                    flatDice.push(g.sides || 6);
            });
        }
        flatDice.sort((a, b) => b - a); // Sort descending to remove largest first
        flatDice = flatDice.slice(shredAmount);

        const newPool = [];
        flatDice.forEach((sides) => {
            const existing = newPool.find((g) => g.sides === sides);
            if (existing) existing.size++;
            else newPool.push({ size: 1, sides });
        });
        return newPool;
    }

    static executeTurn(attacker, defender, log, metrics = null) {
        const isPlayer = attacker.id === 'player';

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
        if (
            attacker.hp < attacker.maxHp * 0.5 &&
            this.getPoolSize(attacker.skills.compile) > 0
        ) {
            const rolls = LuckManager.rollCustomDice(attacker.skills.compile);
            const successes = LuckManager.countSuccesses(rolls);

            if (successes > 0) {
                const heal = successes * 5;
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                if (metrics) {
                    if (isPlayer) metrics.playerHealing += heal;
                    else metrics.enemyHealing += heal;
                }
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
        if (
            attacker.tf >= 25 &&
            this.getPoolSize(attacker.skills.override) > 0
        ) {
            const rolls = LuckManager.rollCustomDice(attacker.skills.override);
            const successes = LuckManager.countSuccesses(rolls);

            if (successes > 0) {
                attacker.tf -= 25;
                const dmg = successes * 5 + 10;
                defender.hp -= dmg;
                if (metrics) {
                    if (isPlayer) {
                        metrics.playerDamageDealt += dmg;
                        metrics.playerTfSpent += 25;
                    } else {
                        metrics.enemyDamageDealt += dmg;
                        metrics.enemyTfSpent += 25;
                    }
                }
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
        const dodgeCheck = LuckManager.opposedRoll(
            defender.skills.spoof,
            attacker.skills.scan,
        );
        if (dodgeCheck.netSuccesses > 0) {
            if (metrics) {
                if (isPlayer) { metrics.playerAttacks++; metrics.enemyDodges++; }
                else { metrics.enemyAttacks++; metrics.playerDodges++; }
            }
            log.push({
                actor: attacker.id,
                target: defender.id,
                action: 'miss',
                message: `${defender.name} spoofed their location (${dodgeCheck.netSuccesses} net successes)! ${attacker.name}'s assault missed.`,
            });
            return;
        }

        // 5. Debuff / Utility Rolls
        let activeFirewall = this.applyShredToPool(
            defender.skills.firewall,
            defender.modifiers.firewallShred,
        );

        if (
            this.getPoolSize(activeFirewall) > 0 &&
            this.getPoolSize(attacker.skills.shred) > 0
        ) {
            const shredCheck = LuckManager.opposedRoll(
                attacker.skills.shred,
                activeFirewall,
            );
            if (shredCheck.netSuccesses > 0) {
                defender.modifiers.firewallShred += shredCheck.netSuccesses;
                activeFirewall = this.applyShredToPool(
                    defender.skills.firewall,
                    defender.modifiers.firewallShred,
                );
                log.push({
                    actor: attacker.id,
                    action: 'shred',
                    amount: shredCheck.netSuccesses,
                    message: `${attacker.name} shreds ${defender.name}'s Firewall by ${shredCheck.netSuccesses}!`,
                });
            }
        }

        if (this.getPoolSize(attacker.skills.compression) > 0) {
            const compCheck = LuckManager.opposedRoll(
                attacker.skills.compression,
                activeFirewall,
            );
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
        if (metrics) {
            if (isPlayer) { metrics.playerAttacks++; metrics.playerHits++; }
            else { metrics.enemyAttacks++; metrics.enemyHits++; }
        }
        
        const assaultCheck = LuckManager.opposedRoll(
            attacker.skills.assault,
            activeFirewall,
        );
        // Critical Hit triggers if Scan heavily outmaneuvered Spoof during the Dodge Check
        const isCrit = dodgeCheck.netSuccesses <= -3;

        let dmg = Math.max(1, assaultCheck.netSuccesses * 2); // 2 dmg per net success, minimum 1 scratch damage
        if (isCrit) {
            dmg = Math.floor(dmg * 1.5);
            if (metrics) {
                if (isPlayer) metrics.playerCrits++;
                else metrics.enemyCrits++;
            }
        }

        defender.hp -= dmg;
        if (metrics) {
            if (isPlayer) metrics.playerDamageDealt += dmg;
            else metrics.enemyDamageDealt += dmg;
        }

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
            const parseCheck = LuckManager.opposedRoll(
                defender.skills.parse,
                attacker.skills.assault,
            );
            if (parseCheck.netSuccesses > 0) {
                const counterDmg = parseCheck.netSuccesses * 2;
                attacker.hp -= counterDmg;
                if (metrics) {
                    if (isPlayer) metrics.enemyDamageDealt += counterDmg;
                    else metrics.playerDamageDealt += counterDmg;
                }
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
