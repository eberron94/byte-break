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

        let html =
            '<div class="upgrades-grid" style="grid-template-columns: 1fr;">';
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
