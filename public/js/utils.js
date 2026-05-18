async function closeWebView() {
    try {
        // Ping the server to push a fresh status message to the bottom of the chat
        await fetch('/api/ui/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
        });
    } catch (e) {
        console.error('Failed to refresh UI:', e);
    }
    window.Telegram.WebApp.close();
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

window.onclick = function (event) {
    const modal = document.getElementById('info-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

function showLevelUpIndicator(newLevel) {
    const toast = document.createElement('div');
    toast.className = 'level-up-toast';
    toast.innerText = `LEVEL UP! (${newLevel})`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 2500);
}
