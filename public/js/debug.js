async function showDebug() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('debug-view').style.display = 'block';
    await loadDebugData();
}

let debugData = null;

let debugAccordionState = JSON.parse(
    localStorage.getItem('debugAccordionState'),
) || {
    player: true,
    achievements: true,
    items: true,
    bytes: true,
};

function saveDebugAccordionState() {
    localStorage.setItem(
        'debugAccordionState',
        JSON.stringify(debugAccordionState),
    );
}

function toggleDebugAccordion(section) {
    debugAccordionState[section] = !debugAccordionState[section];
    saveDebugAccordionState();
    const content = document.getElementById(`debug-content-${section}`);
    const indicator = document.getElementById(`debug-indicator-${section}`);
    if (content && indicator) {
        content.style.display = debugAccordionState[section] ? 'block' : 'none';
        indicator.innerText = debugAccordionState[section] ? '▼' : '▶';
    }
}

function expandAllDebug() {
    Object.keys(debugAccordionState).forEach(
        (k) => (debugAccordionState[k] = true),
    );
    saveDebugAccordionState();
    loadDebugData();
}

function collapseAllDebug() {
    Object.keys(debugAccordionState).forEach(
        (k) => (debugAccordionState[k] = false),
    );
    saveDebugAccordionState();
    loadDebugData();
}

function getAccordionHeader(sectionId, title) {
    const isOpen = debugAccordionState[sectionId];
    const indicator = isOpen ? '▼' : '▶';
    return `
    <div style="cursor: pointer; user-select: none; background: #2a2a40; padding: 10px; border-radius: 8px; border: 1px solid #4d4d73; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;" onclick="toggleDebugAccordion('${sectionId}')">
        <h3 style="margin: 0; color: #fff; font-size: 16px;">${title}</h3>
        <span id="debug-indicator-${sectionId}" style="color: #ccc;">${indicator}</span>
    </div>
    `;
}

function getAccordionContentStart(sectionId) {
    const isOpen = debugAccordionState[sectionId];
    return `<div id="debug-content-${sectionId}" style="display: ${isOpen ? 'block' : 'none'};">`;
}

async function loadDebugData() {
    try {
        const res = await fetch(`/api/debug/data/${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch debug data');
        debugData = await res.json();
        renderDebugPlayer();
        renderDebugAchievements();
        renderDebugItems();
        renderDebugBytes();
    } catch (e) {
        console.error(e);
        document.getElementById('debug-content').innerHTML =
            `<p style="color: #f44336;">Error loading debug data.</p>`;
    }
}

function renderDebugPlayer() {
    let html = getAccordionHeader('player', 'Player');
    html += getAccordionContentStart('player');
    html += `<div style="margin-bottom: 10px; color: #fff; font-weight: bold;">Achievement Points: <span style="color: #ffd700;">${debugData.player.availableAchievementPoints} / ${debugData.player.achievementPoints}</span></div>`;
    html += '<div class="upgrades-grid">';

    for (const talent of debugData.talents) {
        const currentLevel = debugData.player.talents[talent.id] || 0;
        html += `
        <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px; text-align: center;">
            <div style="font-weight: bold; margin-bottom: 5px; color: #fff; font-size: 12px;">${talent.name}</div>
            <div style="margin-bottom: 10px; color: #ccc;">Lvl ${currentLevel} / ${talent.maxLevel}</div>
            <div style="display: flex; gap: 5px; justify-content: center;">
                <button class="btn" style="width: auto; padding: 5px 10px; background: #f44336; margin: 0; font-size: 14px;" onclick="setDebugTalent('${talent.id}', -1)">-1</button>
                <button class="btn" style="width: auto; padding: 5px 10px; background: #4caf50; margin: 0; font-size: 14px;" onclick="setDebugTalent('${talent.id}', 1)">+1</button>
            </div>
        </div>`;
    }
    html += '</div></div>';

    const playerContainer = document.getElementById('debug-player');
    if (playerContainer) playerContainer.innerHTML = html;
}

async function setDebugTalent(talentId, amount) {
    try {
        const res = await fetch('/api/debug/talent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, talentId, amount }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        await loadDebugData();
    } catch (e) {
        alert(e.message);
    }
}

function renderDebugAchievements() {
    let html = getAccordionHeader('achievements', 'Achievements');
    html += getAccordionContentStart('achievements');
    html += '<div class="upgrades-grid" style="grid-template-columns: 1fr;">';
    for (const ach of debugData.achievements) {
        const progress = debugData.player.achievements[ach.id] || 0;
        let tiersHtml = '';
        for (let i = 0; i < ach.tiers.length; i++) {
            const req = ach.tiers[i];
            const isCompleted = progress >= req;
            const newProgress = isCompleted
                ? i > 0
                    ? ach.tiers[i - 1]
                    : 0
                : req;
            tiersHtml += `<button class="btn" style="width: auto; padding: 5px; margin: 2px; background: ${isCompleted ? '#4caf50' : '#4d4d73'}; font-size: 12px;" onclick="setDebugAchievement('${ach.id}', ${newProgress})">Tier ${i + 1} (+${ach.rewards[i]} α)</button>`;
        }
        html += `
        <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: #fff;">${ach.name} (Progress: ${progress})</div>
            <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">${ach.description}</div>
            <div>${tiersHtml}</div>
        </div>`;
    }
    html += '</div></div>';
    document.getElementById('debug-achievements').innerHTML = html;
}

async function setDebugAchievement(achId, progress) {
    try {
        await fetch('/api/debug/achievement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, achId, progress }),
        });
        await loadDebugData();
    } catch (e) {
        alert(e.message);
    }
}

function renderDebugItems() {
    let html = getAccordionHeader('items', 'Items');
    html += getAccordionContentStart('items');
    html += '<div class="upgrades-grid">';
    for (const item of debugData.items) {
        const amount = debugData.player.inventory[item.id] || 0;
        html += `
        <div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 10px; text-align: center;">
            <div style="font-weight: bold; margin-bottom: 5px; color: #fff; font-size: 12px;">${item.name}</div>
            <div style="margin-bottom: 10px; color: #ccc;">x${amount}</div>
            <div style="display: flex; gap: 5px; justify-content: center;">
                <button class="btn" style="width: auto; padding: 5px 10px; background: #f44336; margin: 0; font-size: 14px;" onclick="setDebugItem('${item.id}', -1)">-1</button>
                <button class="btn" style="width: auto; padding: 5px 10px; background: #4caf50; margin: 0; font-size: 14px;" onclick="setDebugItem('${item.id}', 1)">+1</button>
            </div>
        </div>`;
    }
    html += '</div></div>';
    document.getElementById('debug-items').innerHTML = html;
}

async function setDebugItem(itemId, amount) {
    try {
        await fetch('/api/debug/item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, itemId, amount }),
        });
        await loadDebugData();
    } catch (e) {
        alert(e.message);
    }
}

function renderDebugBytes() {
    let html = getAccordionHeader('bytes', 'Bytes');
    html += getAccordionContentStart('bytes');
    for (const byte of debugData.bytes) {
        html += `<div class="upgrade-item" style="border: 1px solid #4d4d73; padding: 15px; margin-bottom: 15px;">
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                <img src="/api/avatar?name=${encodeURIComponent(byte.name)}&class=${byte.byteClass}&level=${byte.level}&generation=${byte.generation}" style="width: 80px; height: 80px; background: #0c0c0c; border: 2px solid #333; border-radius: 8px; flex-shrink: 0;" />
                <div>
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px; color: var(--tg-theme-button-color, #2481cc);">${byte.name} (Level ${byte.level}) <span style="font-style: italic;">[${byte.investedBits} β]</span></div>
                    <div style="font-size: 14px; color: #ccc;">${byte.isAsleep ? 'Asleep' : 'Active'}</div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="color: #fff; width: 70px;">Name:</span>
                    <input type="text" id="debug-byte-${byte.id}-name" value="${byte.name}" style="background: #2a2a40; color: #fff; border: 1px solid #4d4d73; padding: 5px; width: 100px; border-radius: 4px;" />
                    <button class="btn" style="width: auto; padding: 5px 10px; margin: 0; font-size: 12px;" onclick="saveDebugByte('${byte.id}', 'name', null, 'debug-byte-${byte.id}-name')">Save</button>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="color: #fff; width: 70px;">Gen:</span>
                    <input type="number" id="debug-byte-${byte.id}-generation" value="${byte.generation || 0}" style="background: #2a2a40; color: #fff; border: 1px solid #4d4d73; padding: 5px; width: 60px; border-radius: 4px;" />
                    <button class="btn" style="width: auto; padding: 5px 10px; margin: 0; font-size: 12px;" onclick="saveDebugByte('${byte.id}', 'generation', null, 'debug-byte-${byte.id}-generation')">Save</button>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="color: #fff; width: 70px;">Bits:</span>
                    <input type="number" id="debug-byte-${byte.id}-bits" value="${byte.pools.bits?.value || 0}" style="background: #2a2a40; color: #fff; border: 1px solid #4d4d73; padding: 5px; width: 60px; border-radius: 4px;" />
                    <button class="btn" style="width: auto; padding: 5px 10px; margin: 0; font-size: 12px;" onclick="saveDebugByte('${byte.id}', 'bits', null, 'debug-byte-${byte.id}-bits')">Save</button>
                    <button class="btn" style="width: auto; padding: 5px 10px; margin: 0; font-size: 12px; background: #4caf50;" onclick="fillDebugPool('${byte.id}', 'bits')">Fill</button>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="color: #fff; width: 70px;">Overflow:</span>
                    <input type="number" id="debug-byte-${byte.id}-overflow" value="${byte.bufferOverflow || 0}" style="background: #2a2a40; color: #fff; border: 1px solid #4d4d73; padding: 5px; width: 60px; border-radius: 4px;" />
                    <button class="btn" style="width: auto; padding: 5px 10px; margin: 0; font-size: 12px;" onclick="saveDebugByte('${byte.id}', 'bufferOverflow', null, 'debug-byte-${byte.id}-overflow')">Save</button>
                </div>
            </div>`;

        html += `<div style="font-weight: bold; margin-bottom: 5px; color: #aaa;">Stats</div><div class="upgrades-grid" style="margin-bottom: 15px;">`;
        for (const [key, stat] of Object.entries(byte.stats)) {
            html += `<div style="display: flex; flex-direction: column; gap: 5px;">
                <span style="font-size: 12px; color: #fff;">${key}</span>
                <div style="display: flex; gap: 5px;">
                    <input type="number" id="debug-byte-${byte.id}-stat-${key}" value="${stat}" style="background: #2a2a40; color: #fff; border: 1px solid #4d4d73; padding: 5px; width: 50px; border-radius: 4px;" />
                    <button class="btn" style="padding: 5px; margin: 0; width: auto; font-size: 12px;" onclick="saveDebugByte('${byte.id}', 'stats', '${key}', 'debug-byte-${byte.id}-stat-${key}')">Save</button>
                </div>
            </div>`;
        }
        html += `</div>`;

        html += `<div style="font-weight: bold; margin-bottom: 5px; color: #aaa;">Skills (Invested)</div><div class="upgrades-grid" style="margin-bottom: 15px;">`;
        for (const [key, skill] of Object.entries(byte.skills)) {
            html += `<div style="display: flex; flex-direction: column; gap: 5px;">
                <span style="font-size: 12px; color: #fff;">${key}</span>
                <div style="display: flex; gap: 5px;">
                    <input type="number" id="debug-byte-${byte.id}-skill-${key}" value="${skill.investedValue}" style="background: #2a2a40; color: #fff; border: 1px solid #4d4d73; padding: 5px; width: 50px; border-radius: 4px;" />
                    <button class="btn" style="padding: 5px; margin: 0; width: auto; font-size: 12px;" onclick="saveDebugByte('${byte.id}', 'skills', '${key}', 'debug-byte-${byte.id}-skill-${key}')">Save</button>
                </div>
            </div>`;
        }
        html += `</div>`;

        html += `<div style="font-weight: bold; margin-bottom: 5px; color: #aaa;">Pools (Max)</div><div class="upgrades-grid" style="margin-bottom: 10px;">`;
        for (const [key, pool] of Object.entries(byte.pools)) {
            if (key === 'bits') continue;
            html += `<div style="display: flex; flex-direction: column; gap: 5px;">
                <span style="font-size: 12px; color: #fff;">${key}</span>
                <div style="display: flex; gap: 5px;">
                    <input type="number" id="debug-byte-${byte.id}-pool-${key}" value="${pool.maxValue || 0}" style="background: #2a2a40; color: #fff; border: 1px solid #4d4d73; padding: 5px; width: 40px; border-radius: 4px;" />
                    <button class="btn" style="padding: 5px; margin: 0; width: auto; font-size: 12px;" onclick="saveDebugByte('${byte.id}', 'pools', '${key}', 'debug-byte-${byte.id}-pool-${key}')">Save</button>
                    <button class="btn" style="padding: 5px; margin: 0; width: auto; font-size: 12px; background: #4caf50;" onclick="fillDebugPool('${byte.id}', '${key}')">Fill</button>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }
    html += '</div>';
    document.getElementById('debug-bytes').innerHTML = html;
}

async function saveDebugByte(byteId, field, key, inputId) {
    const value = document.getElementById(inputId).value;
    try {
        await fetch('/api/debug/byte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                byteId,
                field,
                key,
                value,
            }),
        });
        await loadDebugData();
    } catch (e) {
        alert(e.message);
    }
}

async function fillDebugPool(byteId, key) {
    try {
        await fetch('/api/debug/byte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                byteId,
                field: 'fillPool',
                key,
                value: 0,
            }),
        });
        await loadDebugData();
    } catch (e) {
        alert(e.message);
    }
}
