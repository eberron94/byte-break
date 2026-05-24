const AchievementManager = require('../managers/AchievementManager');
const { evaluateExpression } = require('./effects');

function checkRequirements(
    requirements, context
) {
    if (
        !requirements ||
        !Array.isArray(requirements) ||
        requirements.length === 0
    )
        return true;

    const { byte, player, locals } = context;
    const { timePhase, dayOfWeek } = locals;

    for (const req of requirements) {
        switch (req.type) {
            case 'room':
                if (!byte) return false;
                if (req.id && byte.room !== req.id) return false;
                if (
                    req.ids &&
                    Array.isArray(req.ids) &&
                    !req.ids.includes(byte.room)
                )
                    return false;
                break;
            case 'stat':
            case 'skill':
            case 'need':
            case 'pool':
                if (!byte) return false;
                const catMap = {
                    stat: byte.stats,
                    skill: byte.skills,
                    need: byte.needs,
                    pool: byte.pools,
                };
                const targetCat = catMap[req.type];
                if (!targetCat || !targetCat[req.key]) return false;
                const item = targetCat[req.key];

                const reqMin =
                    req.min !== undefined
                        ? evaluateExpression(req.min, context)
                        : undefined;
                const reqMax =
                    req.max !== undefined
                        ? evaluateExpression(req.max, context)
                        : undefined;
                const reqMaxValMin =
                    req.maxValueMin !== undefined
                        ? evaluateExpression(req.maxValueMin, context)
                        : undefined;
                const reqMaxValMax =
                    req.maxValueMax !== undefined
                        ? evaluateExpression(req.maxValueMax, context)
                        : undefined;

                if (reqMin !== undefined && item.value < reqMin) return false;
                if (reqMax !== undefined && item.value > reqMax) return false;
                if (reqMaxValMin !== undefined && item.maxValue < reqMaxValMin)
                    return false;
                if (reqMaxValMax !== undefined && item.maxValue > reqMaxValMax)
                    return false;
                break;
            case 'energy':
                if (!player || !player.energy) return false;
                const eMin =
                    req.min !== undefined
                        ? evaluateExpression(req.min, context)
                        : undefined;
                const eMax =
                    req.max !== undefined
                        ? evaluateExpression(req.max, context)
                        : undefined;
                if (eMin !== undefined && player.energy.value < eMin)
                    return false;
                if (eMax !== undefined && player.energy.value > eMax)
                    return false;
                break;
            case 'history':
                if (!byte || !byte.history) return false;
                const histVal = byte.history[req.key] || 0;
                const hMin =
                    req.min !== undefined
                        ? evaluateExpression(req.min, context)
                        : undefined;
                const hMax =
                    req.max !== undefined
                        ? evaluateExpression(req.max, context)
                        : undefined;
                if (hMin !== undefined && histVal < hMin) return false;
                if (hMax !== undefined && histVal > hMax) return false;
                break;
            case 'inventory':
                if (!player || !player.inventory) return false;
                const invAmt = player.inventory[req.id] || 0;
                const iMin =
                    req.min !== undefined
                        ? evaluateExpression(req.min, context)
                        : undefined;
                const iMax =
                    req.max !== undefined
                        ? evaluateExpression(req.max, context)
                        : undefined;
                if (iMin !== undefined && invAmt < iMin) return false;
                if (iMax !== undefined && invAmt > iMax) return false;
                break;
            case 'achievement':
                if (
                    !player ||
                    !player.achievementPoints ||
                    !player.achievementPoints.progress
                )
                    return false;
                const ach = AchievementManager.getAchievement(req.id);
                if (!ach) return false;
                const progress = player.achievementPoints.progress[req.id] || 0;
                let currentRank = 0;
                for (let i = 0; i < ach.tiers.length; i++) {
                    if (progress >= ach.tiers[i].requirement) currentRank = i + 1;
                }
                const aRank =
                    req.rank !== undefined
                        ? evaluateExpression(req.rank, context)
                        : undefined;
                if (aRank !== undefined && currentRank < aRank) return false;
                break;
            case 'talent':
                if (!player || !player.talents) return false;
                const talentLvl = player.talents[req.id] || 0;
                const tLevel =
                    req.level !== undefined
                        ? evaluateExpression(req.level, context)
                        : undefined;
                if (tLevel !== undefined && talentLvl < tLevel) return false;
                break;
            case 'hediff':
                if (!byte || !byte.hediffs) return false;
                const hData = byte.hediffs[req.id];
                if (!hData) return false;

                const sMin =
                    req.minStacks !== undefined
                        ? evaluateExpression(
                              req.minStacks, context
                          )
                        : undefined;
                const sMax =
                    req.maxStacks !== undefined
                        ? evaluateExpression(req.maxStacks, context)
                        : undefined;

                if (sMin !== undefined && hData.stacks < sMin) return false;
                if (sMax !== undefined && hData.stacks > sMax) return false;
                break;
            case 'player_hediff':
                if (!player || !player.hediffs) return false;
                const phData = player.hediffs[req.id];
                if (!phData) return false;

                const phMin =
                    req.minStacks !== undefined
                        ? evaluateExpression(req.minStacks, context)
                        : undefined;
                const phMax =
                    req.maxStacks !== undefined
                        ? evaluateExpression(req.maxStacks, context)
                        : undefined;
                if (phMin !== undefined && phData.stacks < phMin) return false;
                if (phMax !== undefined && phData.stacks > phMax) return false;
                break;
            case 'timePhase':
                if (
                    !timePhase ||
                    !req.phases ||
                    !Array.isArray(req.phases) ||
                    !req.phases.includes(timePhase)
                )
                    return false;
                break;
            case 'dayOfWeek':
                if (
                    dayOfWeek === undefined ||
                    !req.days ||
                    !Array.isArray(req.days) ||
                    !req.days.includes(dayOfWeek)
                )
                    return false;
                break;
        }
    }
    return true;
}

module.exports = { checkRequirements };
