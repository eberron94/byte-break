# Combat Gameplay Loop & Progression

This document outlines the current state of the combat gameplay loop, specifically focusing on how players progress through escalating enemy difficulties via the Hunting Board and unlock endgame content.

## Core Combat Mechanics

- **Vitals:** Bytes use **Integrity** (Health) and **Teraflops** (Mana/Energy). If Integrity reaches 0, the Byte loses the simulation.
- **Skills:** Combat relies on opposed dice pools (e.g., _Assault_ vs _Firewall_, _Spoof_ vs _Scan_).
- **Match Types:**
    - **Single Matches (Dojo):** One-off fights against an opponent. HP and TF losses persist after the match, but the player can freely heal between fights.
    - **Hunting Gauntlet:** The player selects an enemy and fights them consecutively until their Byte's Integrity drops to 0 or they manually abort. Integrity and Teraflops carry over between rounds, testing the Byte's endurance and self-healing (Compile) capabilities.

## The Progression Ladder (Hunt Streaks)

Progressing through the combat tiers requires proving a Byte's endurance. To unlock the next tier of enemy, a Byte must achieve a **Hunt Streak of 5** (winning 5 consecutive gauntlet rounds in a single run) against the previous tier.

Because hunt streaks are tracked per-Byte (`target: "byte"`), players must train and equip individual Bytes to climb the ladder, rather than relying on account-wide unlocks.

### Tier 1: The Basics

- **Basic Virus** & **Training Virus**
- **Requirements:** None. Always available in the Dojo.
- **Threat Profile:** Low stats, purely relies on the `assault` skill.
- **Purpose:** Allows players to test mechanics, earn early Bits, and gather basic consumable drops to sell or craft.

### Tier 2: Elite Threat

- **Elite Virus**
- **Requirements:** Byte must achieve a Hunt Streak of 5 against the **Training Virus** and possess at least 120 Max Integrity.
- **Threat Profile:** Introduces the `firewall` skill, reducing incoming damage and requiring players to invest in `shred` or overwhelming `assault`.
- **Rewards:** Drops the unique "Elite Virus Core".

### Tier 3: Advanced Routines

- **Data Scavenger**
- **Requirements:** Byte must achieve a Hunt Streak of 5 against the **Elite Virus**.
- **Threat Profile:** Higher Integrity. Utilizes the `datamine` skill.

### Tier 4: The Gatekeeper

- **Intrusion Proxy**
- **Requirements:** Byte must achieve a Hunt Streak of 5 against the **Data Scavenger**.
- **Threat Profile:** Massive Integrity pool (300 HP). Uses `shred` to tear down the player's firewall and `firewall` to defend itself.
- **Purpose:** The final endurance test before the boss.

### Tier 5: The Boss

- **Network Overlord**
- **Requirements:** Byte must achieve a Hunt Streak of 5 against the **Intrusion Proxy**.
- **Threat Profile:** 800 Integrity, 500 Teraflops. Highly lethal. Uses `assault`, `firewall`, and `override` (a devastating ultimate attack that consumes Teraflops for massive, unavoidable damage).
- **Special Rules:** `isHuntable: false`. The Overlord cannot be fought in a Gauntlet; it is strictly a Single Match encounter.
- **Rewards:** Grants a massive bounty of Bits (500) and drops the **Network Key**.

## Post-Combat Progression

Defeating the Network Overlord and obtaining the **Network Key** serves as the current pinnacle of the combat loop.

### The Network Throne

Owning the Network Key unlocks access to the **Network Throne** room.

- **Function:** An endgame "safe room" that consolidates all highly-efficient restorative activities (Fast Charge, Flush Coolant, Run Defrag, etc.).
- **Passive Benefits:** The room applies passive tick effects that slowly restore the Byte's Charge, Thermal, Defrag, and Telemetry natively over time just by resting there.

## Brainstorming & Future Expansion Hooks

- **Enemy Synergies:** Currently, enemies use static skills. Could we introduce enemies that exploit specific Hediffs (e.g., dealing bonus damage to "Overheated" bytes)?
- **New Match Types:** Tag-team battles (merging stats of two Bytes) or continuous survival modes with randomized enemies.
- **Network Throne Expansion:** What endgame activities, crafting stations, or global buffs could the Network Throne offer beyond just resting?
- **Boss Mechanics:** The Network Overlord relies on brute stats and Override. Future bosses might use `compression` to stun-lock or `sync` to constantly regenerate TF.
