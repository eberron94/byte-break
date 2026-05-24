async function showPlayer() {
    document.getElementById('main-view').style.display = 'none';
    const playerView = document.getElementById('player-view');
    if (!playerView) {
        // Dynamically insert the view wrapper if it's not present in the HTML template
        const div = document.createElement('div');
        div.id = 'player-view';
        div.innerHTML = `<div id="player-content"></div>`;
        document.getElementById('main-view').parentElement.appendChild(div);
    } else {
        playerView.style.display = 'block';
    }

    try {
        // Fetch all required states concurrently for max performance
        const [playerRes, bytesRes, achRes, talRes] = await Promise.all([
            fetch(`/api/player/${user.id}`),
            fetch(`/api/bytes/${user.id}`),
            fetch(`/api/achievements/${user.id}`),
            fetch(`/api/talents/${user.id}`),
        ]);

        let playerData, bytesData, achData, talData;
        if (playerRes.ok) playerData = await playerRes.json();
        if (bytesRes.ok) bytesData = await bytesRes.json();
        if (achRes.ok) achData = await achRes.json();
        if (talRes.ok) talData = await talRes.json();

        renderPlayerStatus(playerData, bytesData, achData, talData);
    } catch (e) {
        console.error(e);
        const playerContent = document.getElementById('player-content');
        if (playerContent)
            playerContent.innerHTML =
                '<p style="color:red;">Failed to load player data.</p>';
    }
}

function renderPlayerStatus(player, bytes, achData, talData) {
    let html = '';

    // 1. Energy Tracker
    html += `
    <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>ENERGY</span>
        <span class="info-btn" onclick="openModal('Energy')">i</span>
    </div>
    <div class="progress-container" style="margin-bottom: 20px;">
        <div class="progress-header">
            <span class="progress-label">Player Energy</span>
            <span class="progress-text">${player.energy.value}/${player.energy.maxValue} ε</span>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${(player.energy.value / player.energy.maxValue) * 100}%; background: #ffd700;"></div></div>
    </div>`;

    // 2. Player Hediffs
    if (player.hediffs && Object.keys(player.hediffs).length > 0) {
        html += '<div class="section-title">ACTIVE STATUSES</div>';
        html +=
            '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">';
        for (const [hId, hData] of Object.entries(player.hediffs)) {
            const name = (hData.name || hId.replace(/_/g, ' ')).toUpperCase();
            const textContent =
                hData.stacks > 1 ? `${name} X${hData.stacks}` : name;
            html += `<div style="background: rgba(156, 39, 176, 0.15); border: 1.5px solid #9c27b0; border-radius: 11px; padding: 4px 10px; color: #e1bee7; font-size: 12px; font-weight: bold; letter-spacing: 0.5px;">👤 ${textContent}</div>`;
        }
        html += '</div>';
    }

    // 3. Talents Acquired
    html += `
    <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
        <span>ACQUIRED TALENTS</span>
        <button class="btn" style="width: auto; padding: 4px 10px; margin: 0; font-size: 12px; background: var(--tg-theme-button-color, #2481cc);" onclick="window.location.search='?view=talents'">View Tree</button>
    </div>`;
    const ownedTalents = talData.tree.filter((t) => t.currentLevel > 0);
    if (ownedTalents.length > 0) {
        html += '<div class="upgrades-grid" style="margin-bottom: 20px;">';
        for (const talent of ownedTalents) {
            html += `
            <div class="upgrade-item" style="border: 1px solid #4caf50; padding: 10px;">
                <div class="upgrade-header">
                    <span class="upgrade-name">${talent.name}</span>
                    <span class="upgrade-level pop" style="color: #4caf50;">LVL ${talent.currentLevel}/${talent.maxLevel}</span>
                </div>
                <div class="shop-item-desc">${talent.description}</div>
            </div>`;
        }
        html += '</div>';
    } else {
        html +=
            '<p style="font-size: 12px; color: #aaa; margin-bottom: 20px;">No talents acquired yet.</p>';
    }

    // 4. Recent Achievements (Top 5)
    html += `
    <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
        <span>RECENT ACHIEVEMENTS</span>
        <button class="btn" style="width: auto; padding: 4px 10px; margin: 0; font-size: 12px; background: var(--tg-theme-button-color, #2481cc);" onclick="window.location.search='?view=achievements'">View All</button>
    </div>`;

    let allCompletedTiers = [];
    achData.achievements.forEach((ach) => {
        ach.tiers.forEach((tier, index) => {
            if (tier.unlockDate) {
                allCompletedTiers.push({
                    achName: ach.name,
                    tierIndex: index + 1,
                    totalTiers: ach.totalTiers,
                    reward: tier.reward,
                    desc: tier.description,
                    unlockDate: new Date(tier.unlockDate),
                });
            }
        });
    });

    allCompletedTiers.sort((a, b) => b.unlockDate - a.unlockDate);
    const recent5 = allCompletedTiers.slice(0, 5);

    if (recent5.length > 0) {
        html +=
            '<div class="upgrades-grid" style="margin-bottom: 20px; grid-template-columns: 1fr;">';
        for (const act of recent5) {
            html += `
            <div class="upgrade-item" style="border: 1px solid #ffd700; display: flex; align-items: center; gap: 15px; padding: 10px;">
                <img src="/api/achievement-icon?name=${encodeURIComponent(act.achName)}&rank=${act.tierIndex}&maxRank=${act.totalTiers}" style="width: 48px; height: 48px; border-radius: 6px; flex-shrink: 0;" />
                <div>
                    <div style="font-weight: bold; color: #ffd700; font-size: 14px;">${act.achName} <span style="font-size: 10px; color: #aaa;">(Tier ${act.tierIndex}/${act.totalTiers})</span></div>
                    <div style="font-size: 11px; color: #ccc;">${act.desc}</div>
                    <div style="font-size: 10px; color: #888; margin-top: 4px;">Unlocked: ${act.unlockDate.toLocaleDateString()}</div>
                </div>
                <div style="margin-left: auto; font-weight: bold; color: #ffd700; font-size: 14px;">+${act.reward} α</div>
            </div>`;
        }
        html += '</div>';
    } else {
        html +=
            '<p style="font-size: 12px; color: #aaa; margin-bottom: 20px;">No achievements unlocked yet.</p>';
    }

    // 5. Living Bytes List
    html +=
        '<div class="section-title" style="margin-top: 20px;">LIVING BYTES</div>';
    if (bytes.length > 0) {
        html +=
            '<div class="upgrades-grid" style="grid-template-columns: 1fr;">';
        for (const b of bytes) {
            let hediffsHtml = '';
            if (b.hediffs && Object.keys(b.hediffs).length > 0) {
                hediffsHtml +=
                    '<div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px;">';
                for (const [hId, hData] of Object.entries(b.hediffs)) {
                    const name = (
                        hData.name || hId.replace(/_/g, ' ')
                    ).toUpperCase();
                    const textContent =
                        hData.stacks > 1 ? `${name} X${hData.stacks}` : name;
                    hediffsHtml += `<div style="background: rgba(244, 67, 54, 0.15); border: 1px solid #f44336; border-radius: 8px; padding: 2px 6px; color: #ffcccc; font-size: 10px; font-weight: bold;">${textContent}</div>`;
                }
                hediffsHtml += '</div>';
            }

            html += `
            <div class="upgrade-item" style="border: 1px solid ${b.colors.primary}; padding: 10px; display: flex; align-items: flex-start; gap: 15px;">
                <img src="/api/avatar?name=${encodeURIComponent(b.name)}&class=${b.byteClass}&level=${b.level}&generation=${b.generation}" style="width: 64px; height: 64px; background: #0c0c0c; border: 2px solid #333; border-radius: 8px; flex-shrink: 0;" />
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 16px; color: ${b.colors.primary};">${b.name}</div>
                    <div style="font-size: 12px; color: #ccc; margin-bottom: 4px;">Class: ${b.byteClass.toUpperCase()} | GEN.LVL ${b.generation}.${b.level}</div>
                    ${hediffsHtml}
                </div>
            </div>`;
        }
        html += '</div>';
    } else {
        html += '<p style="font-size: 12px; color: #aaa;">No living bytes.</p>';
    }

    const playerContent = document.getElementById('player-content');
    if (playerContent) playerContent.innerHTML = html;
}
