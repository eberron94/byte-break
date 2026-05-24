// Tell Telegram the app is ready to be displayed
window.Telegram.WebApp.ready();
window.Telegram.WebApp.expand();

// Automatically fetches the current Telegram user ID opening the window
const user = window.Telegram.WebApp.initDataUnsafe.user;

// Globally intercept all fetch requests to inject the ngrok bypass header
const originalFetch = window.fetch;
window.fetch = async function (resource, config = {}) {
    const headers = new Headers(config.headers || {});
    if (
        window.Telegram &&
        window.Telegram.WebApp &&
        window.Telegram.WebApp.initData
    ) {
        headers.set('x-telegram-init-data', window.Telegram.WebApp.initData);
    }
    config.headers = headers;
    return originalFetch(resource, config);
};

let byteClassData = null;
let dictionaryData = {};
let shopsDataList = null;
let inventoryDataList = null;
let availableBytesToMerge = [];
let selectedBytesForMerge = [];
let playerSettings = {};
