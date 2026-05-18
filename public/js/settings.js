async function showSettings() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'block';

    try {
        const res = await fetch(`/api/settings/${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch settings');
        const data = await res.json();

        playerSettings = data.settings || {};
        if (!playerSettings.notifications) {
            playerSettings.notifications = { events: true, energy: true };
        }

        document.getElementById('setting-notify-events').checked =
            playerSettings.notifications.events !== false;
        document.getElementById('setting-notify-energy').checked =
            playerSettings.notifications.energy !== false;
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
