async function showTalents() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('talents-view').style.display = 'block';

    try {
        const res = await fetch(`/api/inventory/${user.id}`);
        if (res.ok) {
            inventoryDataList = await res.json();
        }
    } catch (e) {
        console.error(e);
    }

    await renderTalents();
}

async function renderTalents() {
    try {
        const res = await fetch(`/api/talents/${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch talents');
        const data = await res.json();

        document.getElementById('talent-alpha').innerText =
            `${data.availableAchievementPoints} / ${data.maxAchievementPoints}`;

        let html = '';

        if (inventoryDataList) {
            const mutator = inventoryDataList.find(
                (i) => i.id === 'user_mutator',
            );
            if (mutator && mutator.amount > 0) {
                html += `
                <div style="background: rgba(156, 39, 176, 0.2); border: 1px solid #9c27b0; border-radius: 8px; padding: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #9c27b0;">User Mutator (x${mutator.amount})</strong>
                        <div style="font-size: 11px; color: #ccc;">Refunds all invested α from Talents.</div>
                    </div>
                    <button class="btn" onclick="useMutator()" style="width: auto; margin-top: 0; background: #9c27b0; padding: 8px 15px;">MUTATE</button>
                </div>`;
            }
        }

        html += '<div class="upgrades-grid">';
        for (const talent of data.tree) {
            const hintIcon = talent.hasHint
                ? `<div style="position: absolute; top: 8px; right: 8px; font-size: 14px; opacity: 0.8;" title="Unlocks hidden talents">🔍</div>`
                : '';

            html += `
            <div class="upgrade-item" style="position: relative;">
                ${hintIcon}
                <div class="upgrade-header" style="padding-right: 15px;">
                    <span class="upgrade-name" title="${talent.name}">${talent.name}</span>
                    <span class="upgrade-level">LVL ${talent.currentLevel}/${talent.maxLevel}</span>
                </div>
                <div class="shop-item-desc">${talent.description}</div>
                <button class="upgrade-btn" onclick="purchaseTalent('${talent.id}')" style="background: ${talent.btnBg};" ${talent.isDisabled ? 'disabled' : ''}>
                    ${talent.btnText}
                </button>
            </div>`;
        }
        html += '</div>';
        document.getElementById('talent-list').innerHTML = html;
    } catch (e) {
        console.error('Failed to load talents', e);
    }
}

async function purchaseTalent(talentId) {
    try {
        const response = await fetch('/api/talent/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, talentId }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error);
        }
        await renderTalents();
    } catch (e) {
        alert('Purchase failed: ' + e.message);
    }
}

async function useMutator() {
    if (!confirm('Are you sure you want to refund all your talents?')) return;

    try {
        const response = await fetch('/api/special/mutate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Mutate failed');
        }

        // Refresh inventory to update mutator count
        const res = await fetch(`/api/inventory/${user.id}`);
        if (res.ok) inventoryDataList = await res.json();

        await renderTalents();
    } catch (e) {
        alert('Mutate failed: ' + e.message);
    }
}
