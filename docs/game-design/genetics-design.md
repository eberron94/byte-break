# Byte Genetics & Merging Design

This document outlines the mechanics of the "Breeding" system in Tele-grow, known as **Merging**. It details how players combine their digital pets (Bytes) to create stronger, specialized future generations.

## Core Mechanics

- **The Merge Process:** Merging requires two fully compiled Bytes: a "Primary" host and a "Secondary" donor. Initiating a merge is a heavy action that consumes **Player Energy (ε)**.
- **Generations (`generation`):** Every Byte tracks its lineage. When merged, the resulting child Byte is born at `generation: max(parentA, parentB) + 1`. Higher generations naturally possess higher baseline potentials and larger capacity ceilings.
- **Stat Inheritance (The Buffer Overflow):** A percentage of the Bits (β) invested into the parents' skills and capacities are passed down to the child. This is usually deposited directly into the child's `bufferOverflow`, giving them a massive head start on their upgrade tech tree.
- **Class Enhancement (`enhanceStat`):** The Secondary (donor) parent passes down a permanent, flat genetic buff to the child based on their specific Class (e.g., merging with a _Virus_ class passes down a bonus to the `syntax` core stat).

## Current Implementation Hooks

- **Talent Synergies:** The Meta-Progression system deeply supports Merging. Talents like **"Merge Optimization"** reduce the Player Energy required to breed, while **"Genetic Memory"** directly increases the percentage of inherited stats the child receives.
- **Class Identity:** Classes heavily dictate the outcome of a merge. A player might heavily invest in a utility Byte just to use them as a Secondary parent to inject a specific `enhanceStat` into their main combat lineage.

## Brainstorming & Future Expansion Hooks

_Feed these concepts to an LLM to generate new ideas:_

### 1. Mutations & Anomalies

- What happens if a merge "critically succeeds"? Could there be a low random chance for the child to develop a positive, permanent Hediff (e.g., "Perfect Code")?
- Should we allow for "Corrupted Merges" that grant massive stats but apply a permanent negative trait?

### 2. Item Intervention (Splicing)

- How can the crafting system interact with merging? (e.g., A craftable "Gene Splicer" hardware item that guarantees a specific skill carries over at 100% value).
- Could consumable items be fed to parents right before a merge to artificially inflate the child's starting Generation?

### 3. Prestige Classes & Lineage Purity

- If a player merges two Max Level Bytes of the same class, should it result in a Tier 2 "Prestige" version of that class?
- Alternatively, what unique hybrid classes could be created by merging two completely opposite classes (like a _Virus_ and a _Defender_)?

### 4. Retirement & The Parent Paradox

- Currently, what happens to the parent Bytes after a merge? Are they completely consumed/deleted?
- Should they instead be sent to an offline "Archive" where they can no longer be played, but generate a tiny amount of passive passive Bits (β) or Achievement Points (α) for the player forever?
