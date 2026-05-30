const itemsData = require('../../data/items.json');
const roomsData = require('../../data/rooms.json');
const talentsData = require('../../data/talents.json');
const hediffsData = require('../../data/hediffs.json');
const achievementsData = require('../../data/achievements.json');
const activitiesData = require('../../data/activities.json');
const shopsData = require('../../data/shops.json');
const classesData = require('../../data/classes.json');
const skillsData = require('../../data/skills.json');

class GameObjectManager {
    constructor() {
        this.catalog = new Map();
        this.load();
    }

    load() {
        const registerData = (dataArray, type) => {
            if (!Array.isArray(dataArray)) return;
            dataArray.forEach((item) => {
                if (item && (item.id || item.name)) {
                    const id =
                        item.id ||
                        item.name.toLowerCase().replace(/\s+/g, '_');
                    this.catalog.set(id, {
                        id,
                        name: item.name,
                        description: item.description || '',
                        type,
                    });
                }
            });
        };

        registerData(itemsData, 'item');
        registerData(roomsData, 'room');
        registerData(talentsData, 'talent');
        registerData(hediffsData, 'hediff');
        registerData(achievementsData, 'achievement');
        registerData(activitiesData, 'activity');
        registerData(shopsData, 'shop');
        registerData(classesData, 'class');
        registerData(skillsData, 'skill');
    }

    getObjectName(id, fallback = '') {
        const obj = this.catalog.get(id);
        if (obj && obj.name) return obj.name;
        if (fallback) return fallback;
        return id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }

    getObjectDescription(id) {
        const obj = this.catalog.get(id);
        return obj ? obj.description : '';
    }

    formatRequirementsList(requirements) {
        if (!Array.isArray(requirements) || requirements.length === 0)
            return 'None';
        const lines = [];

        for (const req of requirements) {
            let desc = '';

            switch (req.type) {
                case 'room':
                    if (req.id) {
                        desc = `Room: ${this.getObjectName(req.id)}`;
                    } else if (req.ids) {
                        desc = `Room: ${req.ids
                            .map((id) => this.getObjectName(id))
                            .join(' or ')}`;
                    }
                    break;
                case 'stat':
                case 'skill':
                case 'need':
                case 'pool':
                case 'history':
                    const targetName = this.getObjectName(req.key);
                    const conditions = [];
                    if (req.min !== undefined) conditions.push(`Min ${req.min}`);
                    if (req.max !== undefined) conditions.push(`Max ${req.max}`);
                    if (req.maxValueMin !== undefined)
                        conditions.push(`Capacity >= ${req.maxValueMin}`);
                    if (req.maxValueMax !== undefined)
                        conditions.push(`Capacity <= ${req.maxValueMax}`);
                    desc = `${targetName} (${conditions.join(', ')})`;
                    break;
                case 'energy':
                    const eCond = [];
                    if (req.min !== undefined) eCond.push(`Min ${req.min}`);
                    if (req.max !== undefined) eCond.push(`Max ${req.max}`);
                    desc = `Player Energy (${eCond.join(', ')})`;
                    break;
                case 'inventory':
                    desc = `Item: ${this.getObjectName(req.id)}`;
                    if (req.min !== undefined) desc += ` (x${req.min})`;
                    if (req.max !== undefined) desc += ` (Max x${req.max})`;
                    break;
                case 'achievement':
                    desc = `Achievement: ${this.getObjectName(req.id)}`;
                    if (req.rank !== undefined) desc += ` (Tier ${req.rank})`;
                    break;
                case 'talent':
                    desc = `Talent: ${this.getObjectName(req.id)}`;
                    if (req.level !== undefined) desc += ` (Level ${req.level})`;
                    break;
                case 'hediff':
                    desc = `Status: ${this.getObjectName(req.id)}`;
                    const sCond = [];
                    if (req.minStacks !== undefined)
                        sCond.push(`Min ${req.minStacks} Stacks`);
                    if (req.maxStacks !== undefined)
                        sCond.push(`Max ${req.maxStacks} Stacks`);
                    if (sCond.length > 0) desc += ` (${sCond.join(', ')})`;
                    break;
                case 'player_hediff':
                    desc = `Player Status: ${this.getObjectName(req.id)}`;
                    const psCond = [];
                    if (req.minStacks !== undefined) psCond.push(`Min ${req.minStacks} Stacks`);
                    if (req.maxStacks !== undefined) psCond.push(`Max ${req.maxStacks} Stacks`);
                    if (psCond.length > 0) desc += ` (${psCond.join(', ')})`;
                    break;
                case 'timePhase':
                    desc = `Time: ${req.phases
                        .map((p) => this.getObjectName(p))
                        .join(' or ')}`;
                    break;
                case 'dayOfWeek':
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    desc = `Day: ${req.days.map((d) => days[d]).join(' or ')}`;
                    break;
            }
            if (desc) lines.push(desc);
        }
        return lines.length > 0 ? lines.join('\n• ') : 'None';
    }

    formatEffectsList(effects) {
        if (!Array.isArray(effects) || effects.length === 0)
            return 'No effects';
        const lines = [];

        for (const effect of effects) {
            let desc = '';
            let prefix = '';

            if (effect.die !== undefined) {
                prefix = `(1-in-${effect.die} chance) `;
            }
            if (effect.dicePool !== undefined) {
                const poolStr = typeof effect.dicePool === 'number' ? effect.dicePool : 'Variable';
                prefix = `(Roll ${poolStr} Dice) ` + prefix;
            }

            if (effect.type === 'stat' || effect.type === 'skill' || effect.type === 'pool' || effect.type === 'need') {
                const target = this.getObjectName(effect.key);
                const amt = effect.amount;
                let amtStr = amt;
                if (typeof amt === 'number') {
                    amtStr = amt > 0 ? `+${amt}` : `${amt}`;
                } else if (amt !== undefined) {
                    amtStr = `Variable`;
                }

                if (effect.sides !== undefined) {
                    const sidesStr = typeof effect.sides === 'number' ? effect.sides : 'X';
                    amtStr += ` (d${sidesStr})`;
                }

                desc = `${amtStr} ${target}`;
            } else if (effect.type === 'inventory') {
                const amt = effect.amount;
                const itemName = this.getObjectName(effect.id);
                if (typeof amt === 'number') {
                    desc = `${
                        amt > 0 ? 'Gain' : 'Lose'
                    } ${Math.abs(amt)}x ${itemName}`;
                } else {
                    desc = `Modify ${itemName} (Variable)`;
                }
            } else if (effect.type === 'loot') {
                const tableId = this.getObjectName(effect.table);
                desc = `Random Loot (${tableId})`;
            } else if (effect.type === 'hediff' || effect.type === 'player_hediff') {
                const hediffName = this.getObjectName(effect.id);
                const action = effect.action || 'escalate';
                const target = effect.type === 'player_hediff' ? 'Player ' : '';
                const amtStr = effect.amount !== undefined ? (typeof effect.amount === 'number' && effect.amount > 1 ? ` (${effect.amount} Stacks)` : (typeof effect.amount === 'string' ? ` (Variable Stacks)` : '')) : '';
                if (action === 'escalate') desc = `Apply/Worsen ${target}${hediffName}${amtStr}`;
                else if (action === 'reduce') desc = `Recover from ${target}${hediffName}${amtStr}`;
                else if (action === 'remove') desc = `Cure ${target}${hediffName}${amtStr}`;
            } else if (effect.type === 'isAsleep') {
                desc = effect.amount ? `Put Byte to Sleep` : `Wake Byte up`;
            } else if (effect.type) {
                const isUpgrade = effect.type.startsWith('upgrade_');
                const statKey = isUpgrade
                    ? effect.type.replace('upgrade_', '')
                    : effect.type;
                const statName = this.getObjectName(statKey);
                const target = isUpgrade
                    ? `${statName} (Permanent)`
                    : statName;

                const amt = effect.amount;
                let amtStr = amt;
                if (typeof amt === 'number') {
                    amtStr = amt > 0 ? `+${amt}` : `${amt}`;
                } else if (amt !== undefined) {
                    amtStr = `Variable`;
                } else {
                    amtStr = `Modify`;
                }

                desc = `${amtStr} ${target}`;

                if (effect.maxLimit !== undefined)
                    desc += ` (Up to ${effect.maxLimit})`;
                if (effect.minLimit !== undefined)
                    desc += ` (Down to ${effect.minLimit})`;
            }

            if (effect.ticksPerTrigger !== undefined) {
                const tpt = effect.ticksPerTrigger;
                if (typeof tpt === 'number') {
                    desc += tpt === 1 ? ' per min' : ` every ${tpt} mins`;
                } else {
                    desc += ' periodically';
                }
            }

            if (desc) lines.push(prefix + desc);
        }

        return lines.length > 0 ? lines.join('\n• ') : 'None';
    }

    formatLootString(grantedLoot, context = null) {
        if (!grantedLoot) return '';
        const lootMsg = [];
        
        if (grantedLoot.bits && grantedLoot.bits > 0) {
            lootMsg.push(`${grantedLoot.bits} β`);
        }
        if (grantedLoot.items && grantedLoot.items.length > 0) {
            for (const i of grantedLoot.items) {
                const itemName = this.getObjectName(i.id);
                lootMsg.push(`${itemName} (x${i.amount})`);
            }
        }
        
        return lootMsg.join(', ');
    }
}

module.exports = new GameObjectManager();