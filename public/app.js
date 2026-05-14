// Tell Telegram the app is ready to be displayed
window.Telegram.WebApp.ready();
window.Telegram.WebApp.expand();

// Automatically fetches the current Telegram user ID opening the window
const user = window.Telegram.WebApp.initDataUnsafe.user;

let byteClassData = null;
let dictionaryData = {};

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
        const max = byte.pools.bits.maxValue;
        const pct = max > 0 ? (value / max) * 100 : 0;
        statsHtml += `
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>BIT BUFFER</span>
            <span class="info-btn" onclick="openModal('Bit Buffer')">i</span>
        </div>`;
        statsHtml += `
        <div class="progress-container">
            <div class="progress-header">
                <span class="progress-label">Bits</span>
                <span class="progress-text">${value}/${max}</span>
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
        { key: 'teraflops', color: '#3f51b5' },
        { key: 'bandwidth', color: '#8bc34a' },
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

function openModal(title) {
    document.getElementById('modal-title').innerText = title;

    let descContent = 'Description not available.';
    if (dictionaryData[title] && Array.isArray(dictionaryData[title])) {
        descContent = dictionaryData[title].join('<br><br>');
    }

    document.getElementById('modal-desc').innerHTML = descContent;
    document.getElementById('info-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('info-modal').style.display = 'none';
}

// Close modal if user clicks outside of it
window.onclick = function (event) {
    const modal = document.getElementById('info-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

async function loadByte() {
    if (!user) {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('error-message').innerText =
            'Please open this within Telegram.';
        return;
    }

    try {
        // Fetch the byte's status from your new Express endpoint
        const response = await fetch(`/api/byte/${user.id}`);
        if (!response.ok) throw new Error('Byte not found');

        const byte = await response.json();
        window.currentByte = byte; // Store globally for combat access

        // --- DYNAMIC THEMING ---
        if (byte.colors) {
            const root = document.documentElement;
            // Apply the Byte's primary color to buttons, stat bars, and spinners
            root.style.setProperty(
                '--tg-theme-button-color',
                byte.colors.primary,
            );

            // Tint the main background using the Byte's final hue (very dark for contrast)
            root.style.setProperty(
                '--tg-theme-bg-color',
                `hsl(${byte.colors.finalHue}, 25%, 10%)`,
            );

            // Tint the secondary background for empty bars and list items
            root.style.setProperty(
                '--tg-theme-secondary-bg-color',
                `hsl(${byte.colors.finalHue}, 25%, 16%)`,
            );

            // Ensure text is light to contrast with the dark background
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
        document.getElementById('byte-level').innerText = `LVL ${byte.level}`;

        const mainAvatar = document.getElementById('main-avatar');
        mainAvatar.src = `/api/avatar?name=${encodeURIComponent(byte.name)}&class=${byte.byteClass}&level=${byte.level}`;

        const isDormant =
            byte.charge === 0 ||
            byte.thermal === 0 ||
            byte.defrag === 0 ||
            byte.telemetry === 0;
        if (isDormant) {
            mainAvatar.style.filter = 'grayscale(100%) opacity(50%)';
        } else {
            mainAvatar.style.filter = 'none';
        }

        renderStatsHtml(byte);

        const classResponse = await fetch(`/api/class/${byte.byteClass}`);
        if (classResponse.ok) {
            byteClassData = await classResponse.json();
        }

        // Hide loading screen, show header
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-view').style.display = 'block';

        // Check if launched directly into a specific view
        if (window.location.href.includes('view=upgrades')) {
            showUpgrades();
        }

        // Automatically start combat if launched via the activity button
        if (
            byte.room === 'dojo' &&
            window.location.href.includes('activity=combat_simulation')
        ) {
            console.log('Auto-start condition met! Queueing startCombat()...');
            startCombat();
        }
    } catch (err) {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('error-message').innerText =
            'Failed to load byte data.';
        console.error(err);
    }
}

function showUpgrades() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('upgrades-view').style.display = 'block';
    renderUpgrades();
}

function hideUpgrades() {
    document.getElementById('upgrades-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
}

function renderUpgrades(lastUpgradedKey = null) {
    const bitsSpan = document.getElementById('upgrade-bits');
    bitsSpan.innerText = window.currentByte.pools.bits.value;

    let html = '';
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

            const canAfford = window.currentByte.pools.bits.value >= cost;
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
                <button 
                    class="upgrade-btn"
                    onclick="purchaseUpgrade('${key}')" 
                    style="background: ${btnBg};"
                    ${canAfford ? '' : 'disabled'}
                >
                    ⬆️ ${cost} β
                </button>
            </div>`;

            if (window.currentByte.pools[key] !== undefined) {
                poolsHTML.push(itemHtml);
            } else {
                skillsHTML.push(itemHtml);
            }
        }

        if (skillsHTML.length > 0) {
            html +=
                '<div class="section-title" style="margin: 0 0 10px 0;">SKILLS</div>';
            html += '<div class="upgrades-grid">';
            html += skillsHTML.join('');
            html += '</div>';
        }

        if (poolsHTML.length > 0) {
            html +=
                '<div class="section-title" style="margin: 20px 0 10px 0;">CAPACITIES</div>';
            html += '<div class="upgrades-grid">';
            html += poolsHTML.join('');
            html += '</div>';
        }
    } else {
        html = '<p>No upgrades available for this class.</p>';
    }
    document.getElementById('upgrade-list').innerHTML = html;
}

function showLevelUpIndicator(newLevel) {
    const toast = document.createElement('div');
    toast.className = 'level-up-toast';
    toast.innerText = `LEVEL UP! (${newLevel})`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2500);
}

async function purchaseUpgrade(key) {
    const previousLevel = window.currentByte.level;
    try {
        const response = await fetch('/api/byte/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                upgradeKey: key,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upgrade failed');
        }

        const updatedByte = await response.json();
        window.currentByte = updatedByte;

        if (updatedByte.level > previousLevel) {
            showLevelUpIndicator(updatedByte.level);
        }

        // Update the header view behind the modal
        const levelBadge = document.getElementById('byte-level');
        levelBadge.innerText = `LVL ${updatedByte.level}`;
        if (updatedByte.level > previousLevel) {
            levelBadge.classList.remove('pop');
            void levelBadge.offsetWidth; // Trigger DOM reflow to restart animation
            levelBadge.classList.add('pop');
        }

        const mainAvatar = document.getElementById('main-avatar');
        mainAvatar.src = `/api/avatar?name=${encodeURIComponent(updatedByte.name)}&class=${updatedByte.byteClass}&level=${updatedByte.level}`;

        const isDormant =
            updatedByte.charge === 0 ||
            updatedByte.thermal === 0 ||
            updatedByte.defrag === 0 ||
            updatedByte.telemetry === 0;
        if (isDormant) {
            mainAvatar.style.filter = 'grayscale(100%) opacity(50%)';
        } else {
            mainAvatar.style.filter = 'none';
        }

        renderStatsHtml(updatedByte);
        renderUpgrades(key);
    } catch (err) {
        console.error('Upgrade failed:', err);
        alert('Upgrade failed: ' + err.message);
    }
}

async function startCombat() {
    console.log('startCombat() initialized.');
    // Switch UI Views
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('arena').style.display = 'block';

    const logBox = document.getElementById('combat-log');
    logBox.innerHTML = '> Establishing secure connection to Dojo API...<br>';

    async function setAvatar(containerId, url) {
        try {
            const response = await fetch(url);
            const svgText = await response.text();
            const container = document.getElementById(containerId);
            // Using an img tag with a data URI is robust for scaling
            container.innerHTML = `<img src="data:image/svg+xml;base64,${btoa(svgText)}" alt="avatar" />`;
        } catch (err) {
            console.error(`Failed to load avatar from ${url}:`, err);
        }
    }

    let currentDelay = parseInt(
        localStorage.getItem('combatAnimationDelay') || '1200',
        10,
    );
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');

    speedSlider.value = currentDelay;
    speedDisplay.innerText = (currentDelay / 1000).toFixed(2);

    speedSlider.addEventListener('input', (e) => {
        currentDelay = parseInt(e.target.value, 10);
        speedDisplay.innerText = (currentDelay / 1000).toFixed(2);
        localStorage.setItem('combatAnimationDelay', currentDelay.toString());
    });

    function getLogColor(entry) {
        // System messages
        if (['start', 'end', 'reward'].includes(entry.action)) return '#00ffff';
        if (entry.actor === 'player') return '#4caf50'; // Player actions
        if (entry.actor === 'enemy') return '#f44336'; // Enemy actions
        return '#aaaaaa'; // Fallback
    }

    try {
        // Call the API to pre-calculate the battle
        const response = await fetch('/api/combat/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) throw new Error('Failed to initiate simulation.');
        const result = await response.json();

        // Fetch and display avatars
        const playerAvatarUrl = `/api/avatar?name=${encodeURIComponent(window.currentByte.name)}&class=${window.currentByte.byteClass}&level=${window.currentByte.level}`;
        const enemyAvatarUrl = `/api/avatar?name=Training%20Virus&class=virus&level=5`;

        // We can let these load in the background while the first log message appears
        Promise.all([
            setAvatar('player-avatar', playerAvatarUrl),
            setAvatar('enemy-avatar', enemyAvatarUrl),
        ]);

        // Set up health bars
        const startLog = result.log.find((l) => l.action === 'start');
        if (startLog) {
            document.getElementById('combat-player-name').innerText =
                window.currentByte.name;
            document.getElementById('combat-enemy-name').innerText =
                'Training Virus';

            const pState = startLog.state.player;
            const eState = startLog.state.enemy;

            window.combatState = {
                playerMaxHp: pState.maxHp,
                playerHp: pState.hp,
                playerMaxTf: pState.maxTf,
                playerTf: pState.tf,
                enemyMaxHp: eState.maxHp,
                enemyHp: eState.hp,
                enemyMaxTf: eState.maxTf,
                enemyTf: eState.tf,
            };

            document.getElementById('combat-player-hp').style.width =
                `${(pState.hp / pState.maxHp) * 100}%`;
            document.getElementById('combat-player-tf').style.width =
                `${(pState.tf / pState.maxTf) * 100}%`;
            document.getElementById('combat-player-bw').style.width =
                `${(pState.bandwidth / pState.maxBandwidth) * 100}%`;

            document.getElementById('combat-enemy-hp').style.width =
                `${(eState.hp / eState.maxHp) * 100}%`;
            document.getElementById('combat-enemy-tf').style.width =
                `${(eState.tf / eState.maxTf) * 100}%`;
            document.getElementById('combat-enemy-bw').style.width =
                `${(eState.bandwidth / eState.maxBandwidth) * 100}%`;
        }

        // Animate the log entries sequentially
        for (const entry of result.log) {
            await new Promise((r) => setTimeout(r, currentDelay)); // Dynamic delay between attacks

            const color = getLogColor(entry);
            logBox.innerHTML += `<span style="color:${color};">> ${entry.message}</span><br>`;
            logBox.scrollTop = logBox.scrollHeight; // Auto-scroll down

            // Animate Health Bar Drops
            if (entry.damage || entry.action === 'compile') {
                const isHeal = entry.action === 'compile';
                const amount = isHeal ? entry.amount : -entry.damage;
                const target =
                    entry.target === 'enemy' ||
                    (isHeal && entry.actor !== 'player')
                        ? 'enemy'
                        : 'player';

                window.combatState[`${target}Hp`] = Math.max(
                    0,
                    Math.min(
                        window.combatState[`${target}MaxHp`],
                        window.combatState[`${target}Hp`] + amount,
                    ),
                );
                const pct =
                    (window.combatState[`${target}Hp`] /
                        window.combatState[`${target}MaxHp`]) *
                    100;

                const hpBarFill = document.getElementById(
                    `combat-${target}-hp`,
                );
                if (hpBarFill) {
                    hpBarFill.style.width = `${pct}%`;
                    const container = hpBarFill.parentElement;
                    if (isHeal) {
                        container.classList.remove('pulse-heal');
                        void container.offsetWidth; // Trigger DOM reflow
                        container.classList.add('pulse-heal');
                    } else {
                        container.classList.remove('shake');
                        void container.offsetWidth; // Trigger DOM reflow
                        container.classList.add('shake');
                    }
                }
            }

            // Animate TF Bar Drops
            if (entry.tfCost) {
                const actor = entry.actor === 'player' ? 'player' : 'enemy';
                window.combatState[`${actor}Tf`] = Math.max(
                    0,
                    window.combatState[`${actor}Tf`] - entry.tfCost,
                );
                const tfPct =
                    (window.combatState[`${actor}Tf`] /
                        window.combatState[`${actor}MaxTf`]) *
                    100;
                const tfBarFill = document.getElementById(`combat-${actor}-tf`);
                if (tfBarFill) {
                    tfBarFill.style.width = `${tfPct}%`;
                    const container = tfBarFill.parentElement;
                    container.classList.remove('pulse-tf');
                    void container.offsetWidth; // Trigger DOM reflow
                    container.classList.add('pulse-tf');
                }
            }
        }

        // Show finish button once the battle concludes
        document.getElementById('btn-finish').style.display = 'block';
    } catch (err) {
        logBox.innerHTML += `<br><span style="color:#ff5555;">> ERROR: ${err.message}</span>`;
    }
}

async function initApp() {
    try {
        const res = await fetch('/dictionary.json');
        if (res.ok) dictionaryData = await res.json();
    } catch (e) {
        console.error('Failed to load dictionary:', e);
    }
    loadByte();
}

initApp();
