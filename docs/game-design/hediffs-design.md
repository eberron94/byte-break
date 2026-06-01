# Status Effects (Hediffs) Design & Expansion

This document outlines the core mechanics of Health Differentials (Hediffs) in Tele-grow, which function as temporary or permanent status conditions for Bytes and Players.

## Core Mechanics

- **Application & Scopes:** Hediffs can target either the `Byte` (affecting an individual pet) or the `Player` (affecting the entire account).
- **Modifiers & Tick Effects:** While active, Hediffs can passively alter core stats (like lowering Logic or increasing Assault) and apply effects over time (like draining Thermal capacity every game tick).
- **Escalation (Stacking):** Hediffs can stack multiple times up to a `maxStacks` limit. When they breach this limit, they can transform into a completely different condition (e.g., "Overheated" escalates into "System Meltdown").
- **Decay & Lifecycles:** Conditions can be programmed to naturally cure themselves or reduce in severity after a set number of global ticks, or when environmental requirements are met (e.g., "Weekend Pass" decays on Monday).

## Current Implementation Examples

- **Overclocked:** An escalating condition caused by consumable stims. Grants higher combat stats but passively damages the thermal pool over time.
- **Weekend Pass:** A Player-targeted Hediff that acts as a temporary account flag granting access to restricted rooms, automatically deleting itself when the weekend ends.
- **Lucky:** A stackable buff gained from throwing currency into the Wishing Well. Causes dynamic hidden shops to appear.

## Brainstorming & Future Expansion Hooks

_Feed these concepts to an LLM to generate new ideas:_

### 1. Environmental Hazards & Biomes

- How can we tie Hediffs directly to `rooms.json`? (e.g., Staying in the "Cooling Chamber" too long applies "Frozen", slowing down passive Bit generation).
- What kind of environmental protection items or equipment could counteract these hazards?

### 2. Combat Status Effects

- How can we expand combat to apply short-term statuses? (e.g., An enemy using the `shred` skill has a chance to apply an "Armor Breached" Hediff that lasts until the end of the fight).
- Should there be "Virus" Hediffs that spread between a player's different Bytes if they aren't isolated in quarantine rooms?

### 3. Positive Mutations & Synergy

- Can Hediffs represent positive, permanent mutations gained from events? (e.g., "Tuned Optics" granting a permanent bonus to `scan`).
- How can equipment (Hardware/Software) interact with Hediffs? (e.g., A specific Proxy Shield that gets stronger if the Byte is currently "Overclocked").

### 4. Player-Level Conditions

- Beyond event access (like the Weekend Pass), what other narrative or mechanical conditions could affect the Player? (e.g., "Bountied" - increasing the chance of random encounters).
