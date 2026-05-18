function renderStatsHtml(byte) {
    let statsHtml = '';

    // Core Stats
    if (byte.stats) {
        statsHtml += `
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>CORE STATS</span>
            <span class="info-btn" onclick="openModal('Core Stats')">i</span>
        </div>`;
        statsHtml += `<div class="stats-grid">`;
        for (const [key, value] of Object.entries(byte.stats)) {
            const name = key.toUpperCase();
            statsHtml += `
            <div class="stat-item">
                <span class="stat-label">${name}</span>
                <span class="stat-value">${value}</span>
            </div>`;
        }
        statsHtml += `</div>`;
    }

    // Bit Buffer
    if (byte.pools && byte.pools.bits) {
        const value = byte.pools.bits.value;
        const overflow = byte.bufferOverflow || 0;
        const totalBits = value + overflow;
        const max = byte.pools.bits.maxValue;
        const pct = max > 0 ? (Math.min(totalBits, max) / max) * 100 : 0;
        statsHtml += `
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>BIT BUFFER</span>
            <span class="info-btn" onclick="openModal('Bit Buffer')">i</span>
        </div>`;
        statsHtml += `
        <div class="progress-container">
            <div class="progress-header">
                <span class="progress-label">Bits</span>
                <span class="progress-text">${value}/${max}${overflow > 0 ? ` <span style="color: #9c27b0;">(+${overflow})</span>` : ''}</span>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%; background: #ffd700;"></div></div>
            <div style="text-align: center; font-size: 13px; color: var(--tg-theme-hint-color, #aaa); margin-top: 8px; font-style: italic;">
                Invest ${byte.bitsToNextLevel} β in System Upgrades to level up
            </div>
        </div>`;
    }

    // System Needs
    statsHtml += `<div class="section-title">SYSTEM NEEDS</div>`;
    statsHtml += `<div class="needs-grid">`;
    const displayNeeds = [
        { key: 'charge', color: '#4caf50' },
        { key: 'thermal', color: '#ff9800' },
        { key: 'defrag', color: '#2196f3' },
        { key: 'telemetry', color: '#9c27b0' },
    ];

    for (const need of displayNeeds) {
        const value = byte[need.key] !== undefined ? byte[need.key] : 0;
        const name = need.key.charAt(0).toUpperCase() + need.key.slice(1);
        statsHtml += `
        <div class="need-item">
            <span class="need-label">${name}<span class="info-btn" onclick="openModal('${name}')">i</span></span>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${value}%; background: ${need.color};"></div></div>
        </div>`;
    }
    statsHtml += `</div>`;

    // Capacities (Pools)
    statsHtml += `<div class="section-title">CAPACITIES</div>`;
    const displayPools = [
        { key: 'integrity', color: '#f44336' },
        { key: 'teraflops', color: '#3f51b5' }
    ];

    for (const poolConfig of displayPools) {
        if (byte.pools && byte.pools[poolConfig.key]) {
            const pool = byte.pools[poolConfig.key];
            const name =
                poolConfig.key === 'teraflops'
                    ? 'Teraflops'
                    : poolConfig.key.charAt(0).toUpperCase() +
                      poolConfig.key.slice(1);
            const value = pool.value;
            const max = pool.maxValue;
            const pct = max > 0 ? (value / max) * 100 : 0;
            statsHtml += `
            <div class="progress-container">
                <div class="progress-header">
                    <span class="progress-label">${name}<span class="info-btn" onclick="openModal('${name}')">i</span></span>
                    <span class="progress-text">${value}/${max}</span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%; background: ${poolConfig.color};"></div></div>
            </div>`;
        }
    }

    if (byte.skills) {
        statsHtml += `<div class="section-title">SKILLS</div>`;
        statsHtml += `<div class="skills-list">`;
        for (const [key, value] of Object.entries(byte.skills)) {
            const name = key
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            statsHtml += `
            <div class="skill-item">
                <span class="skill-name">${name}<span class="info-btn" onclick="openModal('${name}')">i</span></span>
                <span class="skill-value">${value}</span>
            </div>`;
        }
        statsHtml += `</div>`;
    }

    document.getElementById('stats').innerHTML = statsHtml;
}

async function loadByte() {
    if (!user) {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('error-message').innerText =
            'Please open this within Telegram.';
        return;
    }

    try {
        const response = await fetch(`/api/byte/${user.id}`);
        if (!response.ok) throw new Error('Byte not found');

        const byte = await response.json();
        window.currentByte = byte;

        if (byte.colors) {
            const root = document.documentElement;
            root.style.setProperty(
                '--tg-theme-button-color',
                byte.colors.primary,
            );
            root.style.setProperty(
                '--tg-theme-bg-color',
                `hsl(${byte.colors.finalHue}, 25%, 10%)`,
            );
            root.style.setProperty(
                '--tg-theme-secondary-bg-color',
                `hsl(${byte.colors.finalHue}, 25%, 16%)`,
            );
            root.style.setProperty('--tg-theme-text-color', '#ffffff');
            root.style.setProperty('--tg-theme-button-text-color', '#ffffff');
            root.style.setProperty(
                '--header-end-color',
                `hsl(${byte.colors.finalHue}, 75%, 40%)`,
            );
        }

        document.getElementById('byte-name').innerText = byte.name;
        document.getElementById('byte-class').innerText =
            `Class: ${byte.byteClass}`;
        document.getElementById('byte-level').innerText =
            `GEN.LVL ${byte.generation}.${byte.level}`;

        const mainAvatar = document.getElementById('main-avatar');
        mainAvatar.src = `/api/avatar?name=${encodeURIComponent(byte.name)}&class=${byte.byteClass}&level=${byte.level}&generation=${byte.generation}`;
        mainAvatar.style.filter = byte.isDormant
            ? 'grayscale(100%) opacity(50%)'
            : 'none';

        renderStatsHtml(byte);

        const classResponse = await fetch(`/api/class/${byte.byteClass}`);
        if (classResponse.ok) {
            byteClassData = await classResponse.json();
        }

        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-view').style.display = 'block';

        if (window.location.href.includes('view=upgrades')) showUpgrades();
        if (
            byte.room === 'dojo' &&
            window.location.href.includes('activity=combat_simulation')
        )
            startCombat();
        else if (window.location.href.includes('activity=access_shop'))
            showShop();
    } catch (err) {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('error-message').innerText =
            'Failed to load byte data.';
    }
}
