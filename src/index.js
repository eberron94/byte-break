require('dotenv').config();

// Disable node-telegram-bot-api deprecation warning for file Buffers
process.env.NTBA_FIX_350 = '1';

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ngrok = require('@ngrok/ngrok');

// --- Verify Data Files Exist Before Loading Managers ---
const requiredDataFiles = [
    'activities.json',
    'classes.json',
    'events.json',
    'items.json',
    'rooms.json',
    'skills.json',
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
    const controller = new TelegramBotController(
        bot,
        gameManager,
        roomManager,
        activityManager,
        itemManager,
    );
    controller.init();

    // 3. Start the game loop (e.g. tick every 60 seconds)
    gameManager.startGameLoop(
        60000,
        eventManager,
        itemManager,
        (byte, event) => {
            bot.sendMessage(
                byte.ownerId,
                `🔔 **Random Event:** ${event.name}\n_${event.description}_`,
                { parse_mode: 'Markdown' },
            ).catch((err) => {
                console.error(
                    `Failed to send event notification to ${byte.ownerId}:`,
                    err.message,
                );
            });
        },
    );

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
        controller
    );
    webApiController.init();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Web server listening on port ${PORT}`);
    });

    // 5. Start ngrok tunnel automatically for local Web App testing
    try {
        console.log(`Starting ngrok tunnel on port ${PORT}...`);
        const listener = await ngrok.forward({
            addr: PORT,
            authtoken: process.env.NGROK_AUTHTOKEN,
        });
        const url = listener.url();
        console.log(`Ngrok tunnel created: ${url}`);

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
        console.error('Error starting ngrok:', error);
    }

    console.log('Tamagotchi Bot is running! Press Ctrl+C to stop.');
}

start();
dumpUsableVariables();
