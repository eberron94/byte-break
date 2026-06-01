# Economy & Resource Loop

This document outlines the core economic systems in Tele-grow, focusing on how players generate resources, where those resources are consumed (sinks), and how the item market functions.

## Core Currencies

### 1. Bits (β) - The Pet Currency

- **Purpose:** Used exclusively to upgrade a Byte's specific stats, skills, and pool capacities.
- **Generation:**
    - Winning combat simulations (Dojo/Gauntlet).
    - Successfully completing minigames (e.g., Packet Sniffer).
    - Passive generation from specific rooms (The Dojo) or equipped Software (Scavenger Daemon).
    - Selling items at Shops.
- **Mechanics & Sinks:**
    - Bits are stored in a Byte's `bits` pool. Upgrades have specific Bit costs defined by the Byte's `class`.
    - **Buffer Overflow:** If a Byte earns Bits while their pool is at maximum capacity, or if a "Byte Rebooter" item is used to refund all upgrades, the Bits spill over into a `bufferOverflow`. This ensures no grind is wasted and allows for complete build respecification.

### 2. Player Energy (ε) - The Action Stamina

- **Purpose:** Limits how many high-impact actions a player can take in a short timeframe.
- **Generation:**
    - Passively regenerates over time (1 per global tick) up to the player's `maxValue` (default 100).
    - Restored instantly by certain consumable items (e.g., Energy Drink) or rare random events ("The Zoomies").
- **Sinks:**
    - Performing intensive Activities (Combat Training, Minigames, Restoring Needs).
    - Merging Bytes to create new generations.

### 3. Achievement Points (α) - The Meta Currency

- **Purpose:** Used to purchase permanent, account-wide "Talents" that benefit all current and future Bytes.
- **Generation:** Earned strictly by completing milestones and tiers in the `achievements.json` tracker (e.g., winning 100 battles, reaching level 50, collecting unique items).
- **Sinks:** Purchased via the Talent Tree. Can be refunded using a rare "User Mutator" item to completely respec the account.

## The Item Ecosystem

Items fall into several categories: `mob_drop`, `consumable`, `hardware`, `software`, `currency`, `key`, and `special`.

### Acquisition

- **Combat Drops:** Enemies have a `primaryDrop` (e.g., Elite Virus Core) that serves as a reward for victory.
- **Loot Tables:** Random drops from events, minigames, or consumable "Mystery Caches".
- **Crafting:** Players can combine basic materials at the Craft Workbench (e.g., combining 3 Basic Virus Drops to create 1 Patch Kit).
- **Shops:** Purchased directly using Bits.

### Consumption & Utility

- **Restoration:** Consumables like Patch Kits or System Restores heal Integrity or replenish core needs (Charge, Thermal, Defrag, Telemetry).
- **Equipment:** Hardware (RAM, CPU, Peripheral, Sensor) and Software (Daemon, Proxy, Remote, BotNet) can be equipped to a Byte's loadout to provide passive combat modifiers or tick-based resource generation. Equipment capacity scales with the Byte's level.
- **Progression Blocks:** Key items (like the Network Key or VIP Passcard) are required to unlock special rooms, advanced crafting recipes, or secret shops.

## Market Dynamics (Shops)

The game features a dynamic shop system (`shops.json`) that dictates how players trade items for Bits.

- **Price Multipliers:** Shops have variable `priceMultiplier` and `sellMultiplier` values. A general store might buy items for 50% of their base value, while a "Black Market" might buy items at 100% value but sell items at a 200% markup.
- **Limited Stock:** Shops can enforce strict purchase limits (`stock`). Powerful items like the Byte Rebooter or User Mutator might be limited to 1 per player, preventing infinite exploitation.
- **Time & Requirement Gating:** Vendors can be restricted to specific real-world schedules (e.g., Weekends/Nights only) or demand that the player possesses specific Status Effects (Hediffs) or high Stats (Logic) before they will open their storefront.

## The Need Drain (The Passive Sink)

To prevent players from indefinitely farming without interaction, Bytes have four core needs: **Charge, Thermal, Defrag, and Telemetry**.

- These needs slowly decay every real-time minute.
- If any need hits 0, the Byte enters a **Dormant** state, pausing all passive resource generation and halting progress until the player spends Energy and Consumables to nurse them back to health.
- Endgame rooms like the **Network Throne** circumvent this by applying passive tick effects that constantly regenerate these needs.

