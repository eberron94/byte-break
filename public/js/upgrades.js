async function showUpgrades() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('upgrades-view').style.display = 'block';

    try {
        const res = await fetch(`/api/inventory/${user.id}`);
        if (res.ok) {
            inventoryDataList = await res.json();
        }
    } catch (e) {
        console.error(e);
    }

    renderUpgrades();
}

function renderUpgrades(lastUpgradedKey = null) {
    const bitsValue = window.currentByte.pools.bits.value;
    const overflowValue = window.currentByte.bufferOverflow || 0;
    const totalBits = bitsValue + overflowValue;
    const bitsSpan = document.getElementById('upgrade-bits');
    bitsSpan.innerHTML = `${bitsValue} ${overflowValue > 0 ? `<span style="color: #9c27b0;">(+${overflowValue} Overflow)</span>` : ''}`;

    let html = '';

    if (inventoryDataList) {
        const rebooter = inventoryDataList.find(
            (i) => i.id === 'byte_rebooter',
        );
        if (rebooter && rebooter.amount > 0) {
            html += `
            <div style="background: rgba(244, 67, 54, 0.2); border: 1px solid #f44336; border-radius: 8px; padding: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #f44336;">Byte Rebooter (x${rebooter.amount})</strong>
                    <div style="font-size: 11px; color: #ccc;">Refunds all invested β to your Buffer Overflow.</div>
                </div>
                <button class="btn" onclick="useRebooter()" style="width: auto; margin-top: 0; background: #f44336; padding: 8px 15px;">REBOOT</button>
            </div>`;
        }
    }

    if (byteClassData && byteClassData.investmentRates) {
        const skillsHTML = [];
        const poolsHTML = [];

        for (const [key, cost] of Object.entries(
            byteClassData.investmentRates,
        )) {
            let currentValue = 0;
            if (window.currentByte.stats[key] !== undefined)
                currentValue = window.currentByte.stats[key];
            else if (window.currentByte.skills[key] !== undefined)
                currentValue = window.currentByte.skills[key];
            else if (window.currentByte.pools[key] !== undefined)
                currentValue = window.currentByte.pools[key].maxValue;

            const canAfford = totalBits >= cost;
            const btnBg = canAfford
                ? 'var(--tg-theme-button-color, #4caf50)'
                : 'var(--tg-theme-hint-color, #888)';
            const levelClass =
                key === lastUpgradedKey ? 'upgrade-level pop' : 'upgrade-level';

            const itemHtml = `
            <div class="upgrade-item">
                <div class="upgrade-header">
                    <span class="upgrade-name">${key}</span>
                    <span class="${levelClass}">LVL ${currentValue}</span>
                </div>
                <button class="upgrade-btn" onclick="purchaseUpgrade('${key}')" style="background: ${btnBg};" ${canAfford ? '' : 'disabled'}>
                    ⬆️ ${cost} β
                </button>
            </div>`;

            if (window.currentByte.pools[key] !== undefined)
                poolsHTML.push(itemHtml);
            else skillsHTML.push(itemHtml);
        }

        if (skillsHTML.length > 0) {
            html +=
                '<div class="section-title" style="margin: 0 0 10px 0;">SKILLS</div>';
            html +=
                '<div class="upgrades-grid">' + skillsHTML.join('') + '</div>';
        }

        if (poolsHTML.length > 0) {
            html +=
                '<div class="section-title" style="margin: 20px 0 10px 0;">CAPACITIES</div>';
            html +=
                '<div class="upgrades-grid">' + poolsHTML.join('') + '</div>';
        }
    } else {
        html = '<p>No upgrades available for this class.</p>';
    }
    document.getElementById('upgrade-list').innerHTML = html;
}

async function purchaseUpgrade(key) {
    const previousLevel = window.currentByte.level;

    const buttons = document.querySelectorAll('.upgrade-btn');
    buttons.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch('/api/byte/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, upgradeKey: key }),
        });

        if (!response.ok) {
            let errorMsg = 'Upgrade failed';
            try {
                const errorData = await response.json();
                if (errorData.error) errorMsg = errorData.error;
            } catch (err) {}
            throw new Error(errorMsg);
        }

        const updatedByte = await response.json();
        window.currentByte = updatedByte;

        if (updatedByte.level > previousLevel) {
            showLevelUpIndicator(updatedByte.level);
        }

        const levelBadge = document.getElementById('byte-level');
        levelBadge.innerText = `GEN.LVL ${updatedByte.generation}.${updatedByte.level}`;
        if (updatedByte.level > previousLevel) {
            levelBadge.classList.remove('pop');
            void levelBadge.offsetWidth;
            levelBadge.classList.add('pop');
        }

        const mainAvatar = document.getElementById('main-avatar');
        mainAvatar.src = `/api/avatar?name=${encodeURIComponent(updatedByte.name)}&class=${updatedByte.byteClass}&level=${updatedByte.level}&generation=${updatedByte.generation}`;

        if (updatedByte.isDormant) {
            mainAvatar.style.filter = 'grayscale(100%) opacity(50%)';
        } else {
            mainAvatar.style.filter = 'none';
        }

        renderStatsHtml(updatedByte);
        renderUpgrades(key);
    } catch (err) {
        console.error('Upgrade failed:', err);
        alert('Upgrade failed: ' + err.message);
        renderUpgrades(key);
    }
}

async function useRebooter() {
    if (
        !confirm(
            'Are you sure you want to reboot? This will refund all your upgrades!',
        )
    )
        return;
        
    const buttons = document.querySelectorAll('.btn, .upgrade-btn');
    buttons.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch('/api/special/reboot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
            let errorMsg = 'Reboot failed';
            try {
                const errorData = await response.json();
                if (errorData.error) errorMsg = errorData.error;
            } catch (err) {}
            throw new Error(errorMsg);
        }

        const updatedByte = await response.json();
        window.currentByte = updatedByte;

        const levelBadge = document.getElementById('byte-level');
        levelBadge.innerText = `GEN.LVL ${updatedByte.generation}.${updatedByte.level}`;

        const mainAvatar = document.getElementById('main-avatar');
        mainAvatar.src = `/api/avatar?name=${encodeURIComponent(updatedByte.name)}&class=${updatedByte.byteClass}&level=${updatedByte.level}&generation=${updatedByte.generation}`;

        renderStatsHtml(updatedByte);

        // Refresh inventory to update rebooter count
        const res = await fetch(`/api/inventory/${user.id}`);
        if (res.ok) inventoryDataList = await res.json();

        renderUpgrades();
    } catch (err) {
        console.error('Reboot failed:', err);
        alert('Reboot failed: ' + err.message);
        renderUpgrades();
    }
}
