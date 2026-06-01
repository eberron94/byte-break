# Byte Classes & Archetypes Design

This document outlines how Classes define a Byte's identity, combat potential, and genetic value when merging lineages.

## Core Mechanics

- **Investment Rates (The Tech Tree):** Classes act as a strict whitelist for what a Byte can upgrade. If a stat isn't listed in the class's `investmentRates`, the player cannot spend Bits (β) to upgrade it. It also dictates the cost; a combat class might upgrade `assault` cheaply, while a utility class pays double.
- **Innate Growth:** As a Byte levels up (based on total Bits invested), their class provides free passive points (`innatePointsPerLevel`) to specific stats or pools (like Integrity or Teraflops), defining their natural scaling.
- **Genetic Enhancement (`enhanceStat`):** When two Bytes are merged to create a new generation, the "secondary" parent passes down a permanent baseline buff based on their class. Merging heavily with a specific class can create a specialized bloodline.

## Current Implementation Examples

- **Demo Module:** The starter archetype. Balanced, unspecialized, and capable of upgrading basic combat and utility skills at an average cost. Enhances generic `aptitude` when merged.
- **Intrusive Virus:** A hyper-aggressive combat archetype. Cheap offensive upgrades (`assault`, `shred`), completely lacks defensive upgrades (`compile`). Extremely high innate Integrity growth. Enhances `syntax` when merged.

## Brainstorming & Future Expansion Hooks

_Feed these concepts to an LLM to generate new ideas:_

### 1. New Archetypes & Roles

- What would a "Tank" or "Defender" class look like? (e.g., High innate Firewall, cheap Compile costs).
- What about non-combat Utility classes? (e.g., A "Scavenger" class that excels at the `datamine` skill and has passive Bit generation, but is terrible in the Dojo).

### 2. Advanced / Prestige Classes

- How could a player unlock Tier 2 classes? Should they require specific merge combinations? (e.g., Merging a Max Level _Intrusive Virus_ with a Max Level _Defender_ creates a _Paladin.exe_).
- What unique `enhanceStat` bonuses should prestige classes offer?

### 3. Item & Class Synergies

- Should certain Hardware or Software be restricted by Class?
- Should consumable "Class Modules" exist to temporarily or permanently alter a Byte's class?

### 4. Class-Specific Activities

- Should the `activities.json` support class-based requirements? (e.g., Only the "Hacker" class can access the Hard Packet Sniffer minigame).
