# Tele-grow: Manual Regression Test Suite

This document outlines the core manual testing procedures to verify the stability of game mechanics, state machines, and Web App interactions before deploying new updates.

---

## Prerequisites & Setup

1. **Clean Slate:** Run `npm run clean-start` to generate a fresh `bytes.db`.
2. **Dev Flags:** Verify that the `.env` or `npm run start-dev` arguments properly ingest `inf_needs`, `inf_energy`, `inf_bits`, and `inf_integrity` when needed for accelerated testing.
3. **Telegram Client:** Ensure you have the Telegram app open and the Web App URL correctly mapped.

---

## Test Area 1: Bot Initialization & Spawning

**Objective:** Ensure users can smoothly onboard and create Bytes.

| Test Case                       | Steps                                                                                                                                   | Expected Result                                                                                                              |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **1.1 First Interaction**       | Send `/start`                                                                                                                           | Bot replies with the welcome message and instructions to use `/spawn`.                                                       |
| **1.2 Spawn (Empty)**           | Send `/spawn` without a name.                                                                                                           | Bot prompts for a name. State machine enters `AWAITING_BYTE_NAME`.                                                           |
| **1.3 State Input**             | Reply to the prompt with a valid name (e.g., `TestByte`).                                                                               | Bot prompts to select a Class with an inline keyboard. State machine transitions to `AWAITING_BYTE_CLASS`.                   |
| **1.4 Invalid Name Validation** | Send `/spawn !@#` or a name > 32 characters.                                                                                            | Bot rejects the name with a warning about length/characters and aborts the spawn.                                            |
| **1.5 Class Selection**         | Send `/spawn Alpha`. Click a class button (e.g., "Demo Class").                                                                         | Inline keyboard is consumed. Bot replies with "🎉 Congratulations! You spawned Alpha!" and shows the new Byte's status card. |
| **1.6 Byte Limit Enforcement**  | Send `/spawn Beta` -> choose class. Then send `/spawn Gamma`.                                                                           | The third spawn attempt (`Gamma`) is instantly rejected with "You already have the maximum number of living bytes (2)!"      |
| **1.7 Spawn from Stasis**       | Delete a Byte, then click "🐣 Spawn New Byte" from the Stasis Bay inline keyboard.                                                      | Bot prompts for a name, successfully entering the state machine from an inline action.                                       |
| **1.8 Session Timeout**         | Send `/spawn Alpha`, then wait 60+ minutes (or manually restart the server to clear memory). Click a class button from the old message. | Bot alerts "Spawn session expired or invalid." via a Telegram popup alert, preventing a crash.                               |

---

## Test Area 2: Telegram UI & Navigation
**Objective:** Verify that inline keyboards properly navigate through Rooms, Inventory, and the Stasis Bay without orphaned states or crashes.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **2.1 Active Status Render** | Send `/status` while a Byte is awake. | Renders the Active Status message, including Room, Player Energy, AP, and contextual Room buttons. |
| **2.2 Stasis Bay Fallback** | Send `/status` while all Bytes are asleep (use "Sleep Mode" activity if needed). | Renders the Stasis Bay selection menu, listing all living Bytes with their generation and level. |
| **2.3 Waking a Byte** | Click "⚡ Wake" on an asleep Byte from the Stasis Bay. | Wakes the target Byte, puts any previously awake Byte to sleep, and updates the UI to the active status screen. |
| **2.4 Room Navigation** | Click "🚶 Move Rooms" -> select a different room (e.g., Memory Bank). | UI updates to the new room, and the previous room's contextual buttons are replaced by the new room's. |
| **2.5 Room Restrictions** | Edit a room in `rooms.json` to require an item you don't have. Attempt to move to it. | A Telegram popup alert explicitly lists the missing requirements, and the Byte does not move. |
| **2.6 Inventory Display** | Click "📦 Inventory" from the status menu. | Renders the inventory list. Empty inventories state "Your inventory is currently empty." |
| **2.7 Item Details** | Add an item to your inventory (e.g., via Shop or `/debug_menu`). Click the item. | Displays item description, quantity, effects, and a "Use" button (if consumable). |
| **2.8 Pagination Logic** | Use the Admin API or Debug Menu to add 10+ distinct items to your inventory. Open Inventory. | Pagination controls (⬅️ / ➡️) appear. Clicking them successfully navigates pages without dropping the UI state. |

---

## Test Area 3: Activity Execution & Combat
**Objective:** Ensure Activities properly consume resources, respect prerequisites, and that the Combat Simulator correctly processes state changes and loot drops.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **3.1 Basic Activity** | Move to the Charging Station and click "Fast Charge". | Telegram UI updates instantly. Status message appends: "📢 **Last Action:** Performed Fast Charge! 📊 +30 Charge, -1 Energy". |
| **3.2 Requirement Enforcement** | Attempt an activity without meeting requirements (e.g., deplete Player Energy to 0 and click an activity). | Telegram popup alert explicitly states the missing requirement (e.g., "Cannot perform... Requires: Player Energy (Min 1)"). |
| **3.3 Minigame State** | Move to Network Hub and click "Packet Sniffer (Easy)". | UI transforms into the Hacker Terminal. Hex nodes appear as inline buttons. Clicking "Abort" correctly restores the Room status view. |
| **3.4 Combat Launch** | Move to the Dojo, click "Combat Sim (Normal)", and open the Web App. | Web App loads the combat view. Enemy spawns as "Training Virus" with its Integrity/Teraflops dynamically scaled to the player's max capacities. |
| **3.5 Combat Victory & Sync** | Win the combat simulation. Click "Extract Data & Disconnect". | Web App closes. A new, separate message appears in Telegram reading: "Combat Simulation: [Name] was the victor!" displaying the exact HP/TF lost and Loot granted. |
| **3.6 Combat Defeat & Lockout** | Enter Combat Sim (Hard) with low Integrity and lose. Then, try to click Combat Sim again. | Telegram popup prevents entry stating "Cannot perform... Requires: Integrity (Min 1)". |
| **3.7 Silent Activity Log** | Open the Web App -> "Player Profile" -> click the "Activity Logs" accordion. | The log natively reflects recent activities, combat results, and loot drops with precise timestamps and formatted parameters. |

---

## Test Area 4: Minigame Mechanics (Packet Sniffer)
**Objective:** Verify that minigames accurately register inputs, evaluate logic loops, enforce attempt limits, and correctly clear state upon completion.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **4.1 Input Registration** | Enter Packet Sniffer. Click a Hex node button. | The node string is appended to the `/inject` line in the text display, and the clicked button changes to `⬛` to indicate it is selected. |
| **4.2 Clear Input** | Select 2 nodes, then click "⌫ Clear". | The `/inject` line empties and the buttons reset to their unselected visual state. |
| **4.3 Sequence Evaluation** | Fill the entire guess length by clicking nodes. | The turn automatically resolves. The Trace Log updates with your guess and the `ACK`/`SEQ`/`DRP` feedback array. |
| **4.4 Win State Resolution** | Successfully guess the exact sequence before cycles run out. | Screen updates to "🔓 PACKET CRACKED 🔓". The exact loot drop and bit rewards are displayed. Game state clears. |
| **4.5 Loss State Resolution** | Intentionally fail all max guesses. | Screen updates to "🚨 TERMINATED 🚨". Target sequence is revealed. Game state clears and player is returned to standard navigation. |
| **4.6 Premature Abort** | Click "❌ Abort" mid-game. | The minigame ends immediately. UI reverts to the Status view. A Telegram popup reads "Minigame aborted." |

---

## Test Area 5: Inventory & Items
**Objective:** Verify that items apply intended effects, properly trigger and obey cooldowns, handle consumption, and respect inventory caps.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **5.1 Item Usage & Consumption** | Open Inventory, click a Consumable (e.g., "Patch Kit"), click "Use". | The Telegram UI updates with "Used Patch Kit!" showing `+X Integrity`. The item quantity decreases or disappears from the inventory list. |
| **5.2 Cooldown Enforcement** | Use an item with a configured cooldown, then click it in the inventory again immediately. | The "Use" button is replaced by a "⏳ Cooldown (Xm)" button. Clicking it does nothing (ignores pagination). |
| **5.3 Activity Item Selection** | Find an activity requiring an item (e.g., a "Feed" activity or Mutator interaction). | Clicking the activity brings up a filtered inventory list. Using the item triggers the activity effects and consumes the item. |
| **5.4 Max Capacity Enforcement** | Add the maximum allowed `maxCount` of an item via `/debug_menu` or Shop, then try to buy/add one more. | The action is blocked. Shop displays "Inventory full for this item". |
| **5.5 Shop Purchasing** | Enter the Market, open Web App, click "BUY" on an affordable item. | Bits are deducted. Inventory is updated. The new Bits total reflects instantly in the UI Header. |
| **5.6 Shop Selling & Buffer Caps** | Click "SELL" on an item. If Bits exceed max capacity, observe the Buffer. | Item is removed from inventory. Bits are granted. If Bits hit maximum, a "💾 Buffer Full!" notification triggers (if enabled in settings). |

---

## Test Area 6: Web App Interfaces (Merge, Upgrades & Shop)
**Objective:** Verify that the Web App correctly renders dynamic data, handles complex transactions securely, and syncs seamlessly with the backend.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **6.1 Upgrades Screen Rendering** | Open "Upgrades" from the Web App. | Displays the Byte's current Bit Buffer (plus any Overflow), Skills, and Capacities with correct current levels and upgrade costs. |
| **6.2 Purchasing Upgrades** | Click to purchase a valid upgrade (e.g., Integrity). | Bits are deducted. The stat level increments. The UI immediately reflects the new values. If total bits invested crosses a 100-bit threshold, the Byte levels up and the avatar visually updates. |
| **6.3 Byte Rebooter** | Obtain a Byte Rebooter. Open Upgrades, click "REBOOT", and confirm. | All invested Bits are refunded into the "Buffer Overflow". Skills/Capacities reset to base. The avatar reverts to Level 1. The item is consumed. |
| **6.4 Shop Navigation** | Move to The Market, open the Web App, and access the Shop. | The Shop UI renders. If multiple shops are open (e.g., General Store and Night Market), tabs appear at the top to switch between them. |
| **6.5 Shop Stock Limits** | Purchase an item with a limited stock (e.g., `user_mutator` in Elite Tech Vendor). | The button dynamically updates to "SOLD OUT" and becomes unclickable. |
| **6.6 Merge Lab Setup** | Have at least 2 living Bytes. Open the "Merge Lab" from the Stasis Bay. | The Merge UI loads, displaying the horizontal scroll list of available parents. |
| **6.7 Merge Selection** | Select exactly two parent Bytes. | The bottom UI reveals the name input field and the "Initiate Sequence" button with the calculated Energy cost. |
| **6.8 Merge Execution** | Enter a valid name and click "Initiate Sequence" (ensure you have enough Player Energy). | The screen transitions to the flash animation. Energy is consumed. The two parents are permanently archived. The new child Byte appears with calculated inherited stats, a bumped generation, and proper class inheritance. |
| **6.9 Web App Authentication** | Send a POST request to an API endpoint (e.g., `/api/byte/upgrade`) using Postman, providing a valid `userId` but no `x-telegram-init-data` header. | The request is rejected with a `403 Unauthorized` error, preventing spoofing. |

---

## Test Area 7: Achievements & Talents
**Objective:** Verify that achievements correctly track progress, unlock tiers, grant Achievement Points (α), and that players can spend those points on the progressive Talent Tree.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **7.1 Achievement Tracking** | Trigger an achievement condition (e.g., spawn your first Byte, or win a Combat Sim). | The `AchievementManager` silently tracks the progress. Viewing the Player Profile -> Achievements view reflects the `1/X` progress. |
| **7.2 Tier Unlock & Notification** | Complete a tier requirement (e.g., win 1 Combat Sim for "Gladiator" Tier 1). | A Telegram notification containing the generated SVG achievement card is sent (if notifications are enabled). AP is added to the player's account. |
| **7.3 Talent Tree Rendering** | Open "Talents" from the Web App. | Renders the available talent nodes. Unaffordable nodes are greyed out, maxed nodes are blue, and affordable nodes are orange. Hidden prerequisite paths display hint icons (🔍) if applicable. |
| **7.4 Purchasing a Talent** | Ensure you have enough AP, then click an affordable Talent (e.g., `Buffer Capacity`). | AP is deducted from the top header. The Talent level increments. The UI instantly updates to reflect the new state. |
| **7.5 Talent Prerequisite Unlock** | Buy enough levels in a base talent to satisfy a hidden child talent's prerequisite. | The child talent instantly appears in the UI and becomes purchasable. |
| **7.6 Achievement Date Tracking** | Look at the Player Profile view in the Web App. | The "Recent Achievements" section accurately lists the top 5 most recently unlocked tiers with their exact dates and rewards. |
| **7.7 Talent Refund (Mutator)** | Obtain a `user_mutator` item. Open Upgrades/Inventory and click Use/Mutate. | All invested Achievement Points are completely refunded to your available pool. The Talent tree resets to 0. The Mutator item is consumed. |

---

## Test Area 8: Event Engine, Hediffs & Notifications
**Objective:** Ensure random events process correctly, status conditions (Hediffs) accurately stack/decay, and that user notification settings suppress or allow alerts properly.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **8.1 Random Event Trigger** | Run `/tick 100` (or wait) while your Byte is awake and requirements for an event are met. | A Telegram message announces the random event (e.g., "Found a Treat") and grants the specified loot/effects. |
| **8.2 Byte Hediff Application** | Apply a status effect to the Byte (e.g., `overclocked` via an item or debug). Trigger `/status`. | The Hediff appears as a pill badge explicitly on the generated PNG Trading Card and in the Web App's "Active Status Effects" section. |
| **8.3 Hediff Escalation** | Continuously apply a stacking Hediff (like `overclocked`) until it surpasses its `maxStacks` limit. | A Telegram notification announces the condition worsened. The Hediff is instantly replaced by its `nextTier` (e.g., `melted_down`). |
| **8.4 Hediff Decay & Removal** | Wait for the required decay ticks (e.g., 60 ticks for `solar_eclipse`) or use a curing item. | A Telegram notification announces the condition cleared. The Hediff completely disappears from the UI, and its active tick effects end. |
| **8.5 Player Hediffs** | Trigger an event or item that grants a `player_hediff` (e.g., `solar_eclipse`). Check `/status`. | The `/status` text explicitly lists "👤 **Player Status:** Solar Eclipse". The Web App Upgrades/Profile tabs show a distinct Player Status pill. |
| **8.6 Hediff Overrides** | While `solar_eclipse` is active, open the Market and check the "Night Market". | The Night Market is OPEN during the daytime, proving the `localOverrides` successfully bypassed the server's local time check. |
| **8.7 Notification Muting (Off)** | Open Settings in the Web App, set "Activity Log" to `Off`. Perform an activity (e.g., "Fast Charge"). | The standard status card updates, but the separate `📝 *Fast Charge*` silent log message is NOT sent to the chat. |
| **8.8 Notification Silencing (Silent)** | Open Settings, set "Level Up" to `Silent`. Gain enough Bits to level up. | The level up notification is sent to the chat, but arrives silently (without pushing a sound/vibration to your device). |

---

## Test Area 9: Admin & Debug Tools
**Objective:** Verify that developer commands and the debug Web App interface correctly manipulate game state for testing, while remaining secure from standard users.

| Test Case | Steps | Expected Result |
| :--- | :--- | :--- |
| **9.1 Time Acceleration (`/tick`)** | Send `/tick 60` to the bot. | The game instantly processes 60 minutes of global ticks. Byte needs decay, room effects trigger, and random events may fire in rapid succession. |
| **9.2 Avatar Preview (`/avatar`)** | Send `/avatar 5 8`. Then send `/avatar 50`. | The first command returns a Media Group of 4 images (Levels 5, 6, 7, and 8). The second command returns a single image of the Byte at Level 50. |
| **9.3 Admin Room Access** | Attempt to `/move debug_room` as a normal user, then as an admin (your Telegram ID in `.env`). | Normal user receives "Room 'debug_room' does not exist." Admin successfully enters the Debug Room and sees its allowed activities. |
| **9.4 Debug Player & Talents** | Enter `debug_room`, open the Debug Menu. Expand "Player" and add +1 to a Talent. | The Talent level increments. Returning to the standard "Talents" view confirms the exact level was applied bypassing cost constraints. |
| **9.5 Debug Byte Stats** | In the Debug Menu, expand "Bytes". Change the `bits` value to `99` and click "Save". | A Telegram notification confirms the debug action. The standard Web UI immediately reflects the modified bit count. |
| **9.6 Debug Items & Cooldowns** | In the Debug Menu, expand "Items". Click "+1" on an item, then click "Reset CD". | The item is added to the player's inventory. If it was previously on cooldown, the cooldown is completely removed, making it instantly usable. |
