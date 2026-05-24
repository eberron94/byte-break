async function showSettings() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'block';

    try {
        const res = await fetch(`/api/settings/${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch settings');
        const data = await res.json();

        playerSettings = data.settings || {};
        if (!playerSettings.notifications) {
            playerSettings.notifications = {
                events: 'sound',
                energy: 'sound',
                energyFull: 'sound',
                dormant: 'sound',
                bufferFull: 'sound',
                hediff: 'sound',
                activity: 'silent',
                achievements: 'sound',
                levelUp: 'silent',
            };
        }

        // Map any legacy boolean values to the new string system
        const mapSetting = (val, defaultVal) => {
            if (val === true) return defaultVal === 'silent' ? 'silent' : 'sound';
            if (val === false) return 'off';
            return val || defaultVal;
        };

        document.getElementById('setting-notify-events').value = mapSetting(playerSettings.notifications.events, 'sound');
        document.getElementById('setting-notify-energy').value = mapSetting(playerSettings.notifications.energy, 'sound');
        document.getElementById('setting-notify-energyFull').value = mapSetting(playerSettings.notifications.energyFull, 'sound');
        document.getElementById('setting-notify-dormant').value = mapSetting(playerSettings.notifications.dormant, 'sound');
        document.getElementById('setting-notify-bufferFull').value = mapSetting(playerSettings.notifications.bufferFull, 'sound');
        document.getElementById('setting-notify-hediff').value = mapSetting(playerSettings.notifications.hediff, 'sound');
        document.getElementById('setting-notify-activity').value = mapSetting(playerSettings.notifications.activity, 'silent');
        document.getElementById('setting-notify-achievements').value = mapSetting(playerSettings.notifications.achievements, 'sound');
        document.getElementById('setting-notify-levelUp').value = mapSetting(playerSettings.notifications.levelUp, 'silent');
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

async function toggleSetting(category, key, value) {
    if (!playerSettings[category]) playerSettings[category] = {};
    playerSettings[category][key] = value;

    try {
        await fetch('/api/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, settings: playerSettings }),
        });
    } catch (e) {
        console.error('Failed to update settings', e);
    }
}
