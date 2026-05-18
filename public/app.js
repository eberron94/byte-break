async function initApp() {
    try {
        const res = await fetch('/dictionary.json');
        if (res.ok) dictionaryData = await res.json();
    } catch (e) {
        console.error('Failed to load dictionary:', e);
    }

    if (window.location.href.includes('view=merge')) {
        document.getElementById('loading-screen').style.display = 'none';
        showMerge();
    } else if (window.location.href.includes('view=talents')) {
        document.getElementById('loading-screen').style.display = 'none';
        showTalents();
    } else if (window.location.href.includes('view=achievements')) {
        document.getElementById('loading-screen').style.display = 'none';
        showAchievements();
    } else if (window.location.href.includes('view=settings')) {
        document.getElementById('loading-screen').style.display = 'none';
        showSettings();
    } else if (window.location.href.includes('activity=debug_menu')) {
        document.getElementById('loading-screen').style.display = 'none';
        showDebug();
    } else {
        loadByte();
    }
}

initApp();
