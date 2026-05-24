require('dotenv').config();

// Disable node-telegram-bot-api deprecation warning for file Buffers
process.env.NTBA_FIX_350 = '1';

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// --- Verify Data Files Exist Before Loading Managers ---
const requiredDataFiles = [
    'achievements.json',
    'activities.json',
    'classes.json',
    'events.json',
    'items.json',
    'rooms.json',
    'skills.json',
    'shops.json',
    'talents.json',
    'loot.json',
    'hediffs.json',
];
let missingFiles = false;
for (const file of requiredDataFiles) {
    if (!fs.existsSync(path.join(__dirname, '../data', file))) {
        console.error(`[Fatal Error] Missing required data file: data/${file}`);
        missingFiles = true;
    }
}
if (missingFiles) {
    console.error(
        'Please ensure all required JSON configurations exist before starting the server.',
    );
    process.exit(1);
}

const GameManager = require('./managers/GameManager');
const TelegramBotController = require('./controllers/TelegramBotController');
const roomManager = require('./managers/RoomManager');
const activityManager = require('./managers/ActivityManager');
const eventManager = require('./managers/EventManager');
const itemManager = require('./managers/ItemManager');
const WebApiController = require('./controllers/WebApiController');
const byteClassManager = require('./managers/ByteClassManager');
const achievementManager = require('./managers/AchievementManager');
const dumpUsableVariables = require('./util/dumpVariables');

const TOKEN = process.env.TELEGRAM_TOKEN;

if (!TOKEN) {
    console.error(
        'Fatal Error: TELEGRAM_TOKEN is not defined in the .env file.',
    );
    process.exit(1);
}

async function start() {
    // 1. Initialize the game manager and database
    const gameManager = await GameManager.create();

    // 2. Start the bot and inject the managers to handle business logic
    const bot = new TelegramBot(TOKEN, { polling: true });

    // Catch polling errors to prevent console spam on minor network drops
    bot.on('polling_error', (error) => {
        console.log(`[Telegram Polling Error] ${error.code || error.message}`);
    });

    const controller = new TelegramBotController(
        bot,
        gameManager,
        roomManager,
        activityManager,
        itemManager,
    );
    controller.init();

    // Initialize achievements system
    achievementManager.init(gameManager);

    // 3. Start the game loop (e.g. tick every 60 seconds)
    gameManager.startGameLoop(60000, eventManager, itemManager);

    // 4. Start the Express API server to serve the Web App
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Serve the HTML file from the public directory
    app.use(express.static(path.join(__dirname, '../public')));

    // Initialize the Web API Controller
    const webApiController = new WebApiController(
        app,
        gameManager,
        byteClassManager,
        controller,
    );
    webApiController.init();

    const PORT = process.env.PORT || 3000;
    // Bind explicitly to IPv4 localhost to prevent Cloudflare Tunnel connection drops
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`Web server listening on port ${PORT}`);
    });

    // 5. Start Cloudflare Tunnel automatically for local Web App testing
    let tunnelRef; // Keep reference alive to prevent garbage collection
    try {
        console.log(`Starting Cloudflare Tunnel on port ${PORT}...`);
        const untun = await import('untun');
        tunnelRef = await untun.startTunnel({ port: PORT });
        const url = await tunnelRef.getURL();
        console.log(`Cloudflare Tunnel created: ${url}`);

        // Make it immediately available to the running Bot Controller
        process.env.WEB_APP_URL = url;

        // Persist it to the .env file for reference
        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.existsSync(envPath)
            ? fs.readFileSync(envPath, 'utf8')
            : '';
        const urlRegex = /^WEB_APP_URL=.*$/m;
        if (urlRegex.test(envContent)) {
            envContent = envContent.replace(urlRegex, `WEB_APP_URL=${url}`);
        } else {
            envContent += `\nWEB_APP_URL=${url}\n`;
        }
        fs.writeFileSync(envPath, envContent.trim() + '\n');
    } catch (error) {
        console.error('Error starting Cloudflare Tunnel:', error);
    }

    console.log('Tamagotchi Bot is running! Press Ctrl+C to stop.');
}

start();
dumpUsableVariables();
