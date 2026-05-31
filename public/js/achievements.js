async function showAchievements() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('achievements-view').style.display = 'block';
    await renderAchievements();
}

async function renderAchievements() {
    try {
        const res = await fetch(`/api/achievements/${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch achievements');
        const data = await res.json();

        let html = '';

        if (data.combatMetrics && data.combatMetrics.matches > 0) {
            const cm = data.combatMetrics;
            html += `
            <div class="section-title">LIFETIME COMBAT METRICS</div>
            <div class="upgrades-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 20px;">
                <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px;">
                    <div style="font-size: 11px; color: #aaa;">Total Matches</div>
                    <div style="font-size: 18px; font-weight: bold; color: #fff;">${cm.matches}</div>
                </div>
                <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px;">
                    <div style="font-size: 11px; color: #aaa;">Total Turns</div>
                    <div style="font-size: 18px; font-weight: bold; color: #fff;">${cm.turns}</div>
                </div>
                <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px;">
                    <div style="font-size: 11px; color: #aaa;">Damage Dealt</div>
                    <div style="font-size: 18px; font-weight: bold; color: #f44336;">${cm.playerDamageDealt} <span style="font-size: 10px; color: #888;">(${cm.avgPlayerDamagePerTurn}/turn)</span></div>
                </div>
                <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px;">
                    <div style="font-size: 11px; color: #aaa;">Damage Taken</div>
                    <div style="font-size: 18px; font-weight: bold; color: #ff9800;">${cm.enemyDamageDealt} <span style="font-size: 10px; color: #888;">(${cm.avgEnemyDamagePerTurn}/turn)</span></div>
                </div>
                <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px;">
                    <div style="font-size: 11px; color: #aaa;">Crit / Dodge</div>
                    <div style="font-size: 14px; font-weight: bold; color: #fff;"><span style="color:#ffeb3b">${cm.playerCrits}</span> / <span style="color:#4caf50">${cm.playerDodges}</span></div>
                </div>
                <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px;">
                    <div style="font-size: 11px; color: #aaa;">Accuracy</div>
                    <div style="font-size: 18px; font-weight: bold; color: #2196f3;">${cm.playerAccuracy}%</div>
                </div>
            </div>
            <div class="section-title">ACHIEVEMENTS</div>
            `;
        }

        html += '<div class="upgrades-grid" style="grid-template-columns: 1fr;">';
        for (const ach of data.achievements) {
            let checkboxesHtml = '';
            for (let i = 0; i < ach.tiers.length; i++) {
                const tier = ach.tiers[i];
                const effectsHtml = tier.formattedEffects
                    ? `<div style="margin-top: 3px; font-size: 11px; color: #aaa;">✨ <strong>Rewards:</strong><br>• ${tier.formattedEffects.replace(/\n/g, '<br>')}</div>`
                    : '';
                checkboxesHtml += `
                    <div style="display: flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 12px; color: #ccc;">
                        <div style="width: 12px; height: 12px; border-radius: 3px; background: ${tier.checkColor};"></div>
                        <div style="display: flex; flex-direction: column;">
                            <span>Tier ${i + 1}: ${tier.req} <strong style="color: #ffd700;">(+${tier.reward} α)</strong></span>
                            ${effectsHtml}
                        </div>
                    </div>
                `;
            }

            html += `
            <div class="upgrade-item" style="${ach.borderStyle} margin-bottom: 8px; display: flex; flex-direction: row; align-items: flex-start; gap: 15px;">
                <img src="/api/achievement-icon?name=${encodeURIComponent(ach.name)}&rank=${ach.completedTiers}&maxRank=${ach.totalTiers}" style="width: 64px; height: 64px; border-radius: 8px; flex-shrink: 0;" />
                <div style="flex: 1;">
                    <div class="upgrade-header" style="margin-bottom: 4px;">
                        <span class="upgrade-name" style="color: ${ach.nameColor}; font-size: 14px;">${ach.name}</span>
                        <span class="upgrade-level">Progress: ${ach.progress}</span>
                    </div>
                    <div class="shop-item-desc">${ach.description}</div>
                    <div style="margin-top: 8px;">
                        ${checkboxesHtml}
                    </div>
                </div>
            </div>`;
        }
        html += '</div>';
        document.getElementById('achievement-list').innerHTML = html;
    } catch (e) {
        console.error('Failed to load achievements', e);
    }
}
