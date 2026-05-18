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
        const urlParams = new URLSearchParams(window.location.search);
        const activityId = urlParams.get('activity') || 'combat_simulation';

        // Call the API to pre-calculate the battle
        const response = await fetch('/api/combat/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, activityId }),
        });

        if (!response.ok) throw new Error('Failed to initiate simulation.');
        const result = await response.json();

        // Fetch and display avatars
        const playerAvatarUrl = `/api/avatar?name=${encodeURIComponent(window.currentByte.name)}&class=${window.currentByte.byteClass}&level=${window.currentByte.level}&generation=${window.currentByte.generation}`;
        const enemyAvatarUrl = `/api/avatar?name=${encodeURIComponent(result.enemyConfig.name)}&class=${result.enemyConfig.byteClass}&level=5&generation=0`;

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
                result.enemyConfig.name;

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
        document.getElementById('btn-finish').style.display = 'block';
    } catch (err) {
        logBox.innerHTML += `<br><span style="color:#ff5555;">> ERROR: ${err.message}</span>`;
    }
}
