require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const GameManager = require('./managers/GameManager');
const TelegramBotController = require('./controllers/TelegramBotController');
const RoomManager = require('./managers/RoomManager');
const ActivityManager = require('./managers/ActivityManager');
const EventManager = require('./managers/EventManager');
const ItemManager = require('./managers/ItemManager');

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
    const roomManager = new RoomManager();
    const activityManager = new ActivityManager();
    const eventManager = new EventManager();
    const itemManager = new ItemManager();

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
    gameManager.startGameLoop(60000, eventManager, itemManager);

    console.log('Tamagotchi Bot is running! Press Ctrl+C to stop.');
}

start();
