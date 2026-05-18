let playerEnergy = 0;
let currentMergeCost = 100;

async function showMerge() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('merge-view').style.display = 'block';

    try {
        const [resBytes, resPlayer] = await Promise.all([
            fetch(`/api/bytes/${user.id}`),
            fetch(`/api/player/${user.id}`),
        ]);

        if (resBytes.ok && resPlayer.ok) {
            availableBytesToMerge = await resBytes.json();
            const playerData = await resPlayer.json();
            playerEnergy = playerData.energy;
            currentMergeCost = playerData.mergeCost || 100;

            const costInstruction = document.getElementById(
                'merge-cost-instruction',
            );
            if (costInstruction) costInstruction.innerText = currentMergeCost;

            renderMergeSelection();
        } else {
            throw new Error('Failed to load data');
        }
    } catch (e) {
        console.error('Failed to load data', e);
        document.getElementById('merge-selection').innerHTML =
            `<p style="color: #f44336;">Error loading data.</p>`;
    }
}

function renderMergeSelection() {
    const container = document.getElementById('merge-selection');
    let html = '';
    availableBytesToMerge.forEach((b) => {
        const canMerge = b.level >= b.generation;
        const isSelected = selectedBytesForMerge.includes(b.id);
        const isPrimary = selectedBytesForMerge[0] === b.id;
        const isSecondary = selectedBytesForMerge[1] === b.id;
        const borderStr = isSelected
            ? `border: 2px solid ${b.colors.primary}; box-shadow: 0 0 10px ${b.colors.primary};`
            : '';
        const opacityStr = canMerge ? '' : 'opacity: 0.5; cursor: not-allowed;';
        html += `
            <div class="merge-byte-card" ${canMerge ? `onclick="toggleMergeSelection('${b.id}')"` : ''} style="${borderStr} ${opacityStr} position: relative;">
                ${isPrimary ? `<div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #9c27b0; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 10px; font-weight: bold; letter-spacing: 0.5px;">PRIMARY</div>` : ''}
                <img src="/api/avatar?name=${encodeURIComponent(b.name)}&class=${b.byteClass}&level=${b.level}&generation=${b.generation}" />
                <div style="font-size: 14px; font-weight: bold;">${b.name}</div>
                <div style="font-size: 11px; color: #888;">GEN.LVL ${b.generation}.${b.level}</div>
                ${!canMerge ? `<div style="font-size: 10px; color: #f44336; margin-top: 5px;">Requires Lvl ${b.generation}</div>` : ''}
                ${canMerge && !isPrimary ? `<div style="font-size: 10px; color: ${isSecondary ? '#4caf50' : '#888'}; margin-top: 5px; font-weight: ${isSecondary ? 'bold' : 'normal'};">+${b.generation + 1} ${b.enhanceStat.toUpperCase()}</div>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;

    if (selectedBytesForMerge.length === 2) {
        document.getElementById('merge-form').style.display = 'block';
        const mergeBtn = document.getElementById('merge-btn');
        if (playerEnergy < currentMergeCost) {
            mergeBtn.disabled = true;
            mergeBtn.innerText = `Not enough Energy (${playerEnergy}/${currentMergeCost} ε)`;
        } else {
            mergeBtn.disabled = false;
            mergeBtn.innerText = `Initiate Sequence (Cost: ${currentMergeCost} ε)`;
        }
    } else {
        document.getElementById('merge-form').style.display = 'none';
    }
}

function toggleMergeSelection(id) {
    if (selectedBytesForMerge.includes(id)) {
        selectedBytesForMerge = selectedBytesForMerge.filter((i) => i !== id);
    } else {
        if (selectedBytesForMerge.length < 2) {
            selectedBytesForMerge.push(id);
        } else {
            selectedBytesForMerge[1] = id;
        }
    }
    renderMergeSelection();
}

async function executeMerge() {
    const newName = document.getElementById('merge-name-input').value.trim();
    if (!newName) return alert('Please enter a name for the new Byte.');

    const b1 = availableBytesToMerge.find(
        (b) => b.id === selectedBytesForMerge[0],
    );
    const b2 = availableBytesToMerge.find(
        (b) => b.id === selectedBytesForMerge[1],
    );

    document.getElementById('merge-instruction').style.display = 'none';
    document.getElementById('merge-selection').style.display = 'none';
    document.getElementById('merge-form').style.display = 'none';
    document.getElementById('merge-animation').style.display = 'block';

    document.getElementById('merge-parent-1').src =
        `/api/avatar?name=${encodeURIComponent(b1.name)}&class=${b1.byteClass}&level=${b1.level}&generation=${b1.generation}`;
    document.getElementById('merge-parent-2').src =
        `/api/avatar?name=${encodeURIComponent(b2.name)}&class=${b2.byteClass}&level=${b2.level}&generation=${b2.generation}`;

    document
        .getElementById('merge-parent-1')
        .classList.add('merge-slide-right');
    document.getElementById('merge-parent-2').classList.add('merge-slide-left');

    try {
        const res = await fetch('/api/byte/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                byte1Id: b1.id,
                byte2Id: b2.id,
                newName,
            }),
        });

        if (!res.ok) throw new Error((await res.json()).error);
        const newByte = await res.json();

        setTimeout(() => {
            const flash = document.getElementById('merge-flash');
            flash.style.display = 'block';
            flash.classList.add('merge-flash');
            setTimeout(() => {
                document.getElementById('merge-parent-1').style.display =
                    'none';
                document.getElementById('merge-parent-2').style.display =
                    'none';
                document.getElementById('merge-result').style.display = 'block';
                document.getElementById('merge-child').src =
                    `/api/avatar?name=${encodeURIComponent(newByte.name)}&class=${newByte.byteClass}&level=${newByte.level}&generation=${newByte.generation}`;
            }, 500);
        }, 1200);
    } catch (e) {
        alert(e.message);
        document.getElementById('merge-instruction').style.display = 'block';
        document.getElementById('merge-selection').style.display = 'flex';
        document.getElementById('merge-form').style.display = 'block';
        document.getElementById('merge-animation').style.display = 'none';
    }
}
