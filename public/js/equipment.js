const equipmentMap = new Map();

async function showEquipment() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('equipment-view').style.display = 'block';

    await loadEquipmentData();
}

async function loadEquipmentData() {
    try {
        const [equipRes, playerRes] = await Promise.all([
            fetch(`/api/equipment/${user.id}`),
            fetch(`/api/player/${user.id}`),
        ]);
        if (equipRes.ok) window.equipmentData = await equipRes.json();
        if (playerRes.ok) window.currentPlayer = await playerRes.json();
        renderEquipment();
    } catch (e) {
        console.error('Failed to load equipment', e);
    }
}

function renderEquipment() {
    const byte = window.currentByte;
    const player = window.currentPlayer;
    const data = window.equipmentData;

    equipmentMap.clear();

    const hwCap = data.hwCap || 1;
    const swCap = data.swCap || 1;

    const equippedHwCount = data.hardware.filter((i) => i.isEquipped).length;
    const equippedSwCount = data.software.filter((i) => i.isEquipped).length;

    document.getElementById('hardware-slots').innerText =
        `${equippedHwCount} / ${hwCap}`;
    document.getElementById('software-slots').innerText =
        `${equippedSwCount} / ${swCap}`;

    const renderGrid = (items, type, cap, equippedCount) => {
        items.sort((a, b) => {
            if (a.isEquipped && !b.isEquipped) return -1;
            if (!a.isEquipped && b.isEquipped) return 1;
            const rarityA = a.rarity || 1;
            const rarityB = b.rarity || 1;
            if (rarityA !== rarityB) return rarityB - rarityA;
            return a.name.localeCompare(b.name);
        });

        let html = '';
        if (items.length === 0) {
            html = `<p style="font-size: 12px; color: var(--tg-theme-hint-color, #aaa);">No ${type} available.</p>`;
        } else {
            for (const item of items) {
                equipmentMap.set(item.id, item);
                const borderStyle = item.isEquipped
                    ? 'border: 2px solid #4caf50;'
                    : 'border: 1px solid #4d4d73;';
                const action = item.isEquipped ? 'unequip' : 'equip';
                const btnText = item.isEquipped ? 'UNEQUIP' : 'EQUIP';
                const btnBg = item.isEquipped
                    ? '#f44336'
                    : 'var(--tg-theme-button-color, #4caf50)';
                const disabled =
                    !item.isEquipped && equippedCount >= cap ? 'disabled' : '';
                const amountText = !item.isEquipped ? ` (x${item.amount})` : '';

                html += `
                <div class="upgrade-item" style="${borderStyle}">
                    <div class="upgrade-header">
                        <span class="upgrade-name">${item.shortname || item.name}${amountText} <span class="info-btn" onclick="openEquipmentModal('${item.id}')">i</span></span>
                    </div>
                    <div class="shop-item-desc" style="margin-bottom: 8px;">${item.equipLabel || 'Equipment'}</div>
                    <button class="upgrade-btn" onclick="toggleEquipment('${item.id}', '${type}', '${action}')" style="background: ${btnBg};" ${disabled}>
                        ${btnText}
                    </button>
                </div>`;
            }
        }
        return html;
    };

    document.getElementById('hardware-grid').innerHTML = renderGrid(
        data.hardware,
        'hardware',
        hwCap,
        equippedHwCount,
    );
    document.getElementById('software-grid').innerHTML = renderGrid(
        data.software,
        'software',
        swCap,
        equippedSwCount,
    );
}

window.openEquipmentModal = function (id) {
    const item = equipmentMap.get(id);
    document.getElementById('modal-title').innerText = item.name;
    let desc = item.description;
    if (item.formattedModifiers)
        desc += `<br><br>✨ <strong>Modifiers:</strong><br>• ${item.formattedModifiers.replace(/\n/g, '<br>• ')}`;
    if (item.formattedTickEffects)
        desc += `<br><br>⏱️ <strong>Tick Effects:</strong><br>• ${item.formattedTickEffects.replace(/\n/g, '<br>• ')}`;
    document.getElementById('modal-desc').innerHTML = desc;
    document.getElementById('info-modal').style.display = 'block';
};

async function toggleEquipment(itemId, type, action) {
    const buttons = document.querySelectorAll('.upgrade-btn');
    buttons.forEach((btn) => (btn.disabled = true));

    try {
        const response = await fetch('/api/equipment/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, itemId, type, action }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to toggle equipment');
        }

        const updatedData = await response.json();
        window.currentByte = updatedData.byte;

        if (typeof renderStatsHtml === 'function') {
            renderStatsHtml(window.currentByte);
        }

        await loadEquipmentData();
    } catch (err) {
        console.error(err);
        alert(err.message);
        renderEquipment();
    }
}
