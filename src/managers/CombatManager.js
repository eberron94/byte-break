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
            if (p.skills.datamine > 0) {
                const bonusBits = Math.floor(15 * p.skills.datamine * 0.05);
                if (bonusBits > 0) {
                    winEffects.push({ type: 'bits', amount: bonusBits });
                }
            }

            if (LuckManager.checkCombatSync(p)) {
                pacified = true;
                log.push({
                    action: 'sync',
                    message: `${p.name} successfully Synced with the target, pacifying them!`,
                });
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
        return {
            id,
            name: byte.name,
            hp: byte.pools.integrity.value,
            maxHp: byte.pools.integrity.maxValue || 100,
            tf: byte.pools.teraflops.value,
            maxTf: byte.pools.teraflops.maxValue || 100,
            skills: byte.getSkills(),
            modifiers: {
                firewallShred: 0,
                stunned: false,
            },
        };
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

        // 2. Heal / Shield Check (Compile) - 20% chance if HP is under 50%
        if (
            attacker.hp < attacker.maxHp * 0.5 &&
            attacker.skills.compile > 0 &&
            LuckManager.checkCombatCompile(attacker)
        ) {
            const heal = Math.floor(attacker.skills.compile * 2.5);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            log.push({
                actor: attacker.id,
                action: 'compile',
                amount: heal,
                message: `${attacker.name} compiles emergency patches, restoring ${heal} Integrity!`,
            });
            return;
        }

        // 3. Ultimate Attack (Override) - 15% chance if enough TF
        if (
            attacker.tf >= 25 &&
            attacker.skills.override > 0 &&
            LuckManager.checkCombatOverride(attacker)
        ) {
            attacker.tf -= 25;
            const dmg = Math.floor(attacker.skills.override * 3.5);
            defender.hp -= dmg;
            log.push({
                actor: attacker.id,
                target: defender.id,
                action: 'override',
                damage: dmg,
                tfCost: 25,
                message: `${attacker.name} burns 25 TF to execute an OVERRIDE! Deals ${dmg} massive unavoidable damage to ${defender.name}!`,
            });
            return;
        }

        // 4. Dodge Check (Spoof vs Scan)
        if (LuckManager.checkCombatDodge(attacker, defender)) {
            log.push({
                actor: attacker.id,
                target: defender.id,
                action: 'miss',
                message: `${defender.name} spoofed their location! ${attacker.name}'s assault missed.`,
            });
            return;
        }

        // 5. Debuff / Utility Rolls
        let activeFirewall = Math.max(
            0,
            defender.skills.firewall - defender.modifiers.firewallShred,
        );

        if (
            activeFirewall > 0 &&
            attacker.skills.shred > 0 &&
            LuckManager.checkCombatShred(attacker)
        ) {
            const shredAmount = Math.max(
                1,
                Math.floor(attacker.skills.shred * 0.8),
            );
            defender.modifiers.firewallShred += shredAmount;

            // Recalculate active firewall so subsequent hits this turn benefit from the shred
            activeFirewall = Math.max(
                0,
                defender.skills.firewall - defender.modifiers.firewallShred,
            );

            log.push({
                actor: attacker.id,
                action: 'shred',
                amount: shredAmount,
                message: `${attacker.name} shreds ${defender.name}'s Firewall by ${shredAmount}!`,
            });
        } 
        
        if (
            LuckManager.checkCombatCompression(attacker, activeFirewall)
        ) {
            defender.modifiers.stunned = true;
            log.push({
                actor: attacker.id,
                action: 'compression',
                message: `${attacker.name} forcefully compresses ${defender.name}'s data, stunning them for a cycle!`,
            });
            return; // Attack ends here
        }

        // 6. Base Attack (Assault vs Firewall)
        const isCrit = LuckManager.checkCombatCrit(attacker, defender);
        let dmg = Math.floor(
            attacker.skills.assault * (isCrit ? 1.5 : 1) - activeFirewall,
        );
        dmg = Math.max(1, dmg); // Minimum 1 damage

        defender.hp -= dmg;
        log.push({
            actor: attacker.id,
            target: defender.id,
            action: 'assault',
            damage: dmg,
            critical: isCrit,
            message: `${attacker.name} assaults ${defender.name} for ${dmg} damage!${isCrit ? ' (Critical Hit!)' : ''}`,
        });

        // 7. Counter-attack Check (Parse)
        if (defender.hp > 0 && LuckManager.checkCombatParse(defender)) {
            const counterDmg = Math.max(
                1,
                Math.floor(defender.skills.parse * 1.2),
            );
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

module.exports = CombatManager;
