# Events Configuration (`events.json`)

The `events.json` file defines the random encounters and passive occurrences that can trigger during the game's global tick loop. Events offer random rewards, applying statuses, or taxing the player's resources.

The file should contain a single JSON array composed of Event objects.

## Event Object Properties

| Property       | Type          | Default      | Description                                                                                                                       |
| :------------- | :------------ | :----------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | String        | **Required** | The unique identifier for the event.                                                                                              |
| `name`         | String        | **Required** | The display title of the event shown in the UI.                                                                                   |
| `description`  | String        | `""`         | The flavor text describing what just happened.                                                                                    |
| `probability`  | Number/String | `0`          | The base chance of this event triggering. Can be a static number or a dynamic math expression. See the **Probabilities** section. |
| `ticksPerCheck`| Number/String | `1`          | How many game ticks must pass before this event's probability is checked. `1` means it is checked every tick. Supports math expressions. |
| `requirements` | Array         | `[]`         | An array of prerequisite conditions that must be met for this event to even be considered. See Requirements Configuration.        |
| `effects`      | Array         | `[]`         | An array of effect objects applied to the Byte and Player when the event triggers. See Effects Configuration.                     |

---

## Probabilities

The `probability` field determines how likely an event is to trigger _if_ its requirements are met. It interacts directly with the `LuckManager`.

- **Static Probability:** A flat number. (e.g., `0.05` represents a 5% chance to trigger per tick).
- **Dynamic Probability:** A string containing a math expression. This allows events to become more or less likely depending on the pet's state, the player's inventory, or the time of day.
    - _Example:_ `"0.05 + (byte.skills.curiosity.value * 0.01)"` (Base 5% chance, plus 1% for every point of Curiosity).

---

## Frequency Control (`ticksPerCheck`)

In addition to `probability`, you can control how often an event is even considered for triggering using `ticksPerCheck`. This is useful for rare, periodic events.

- If `ticksPerCheck` is `5`, the event's probability will only be rolled every 5 game ticks.
- If omitted, it defaults to `1` (checked every tick).

This check happens *before* the probability roll, making it an efficient way to manage performance for events that shouldn't run constantly.

---

## Examples

### 1. Basic Conditional Event

An event with a flat 5% chance that only happens if the Byte is in the charging station and its charge is below 80%.

```json
{
    "id": "found_treat",
    "name": "Found a Treat",
    "description": "Your pet found a yummy treat hiding under the sofa!",
    "probability": 0.05,
    "requirements": [
        { "type": "room", "id": "charging_station" },
        { "type": "need", "key": "charge", "max": 80 }
    ],
    "effects": [{ "type": "loot", "table": "found_treat" }]
}
```

### 2. Time-Restricted Event

An event that only happens during the day or evening, and rolls a die to determine if the effects actually apply once the event occurs.

```json
{
    "id": "zoomies",
    "name": "The Zoomies!",
    "description": "Random burst of energy! Your pet runs around wildly.",
    "probability": 0.1,
    "requirements": [{ "type": "timePhase", "phases": ["day", "evening"] }],
    "effects": [
        { "type": "telemetry", "amount": 20, "die": 2 },
        { "type": "energy", "amount": 5, "die": 4 }
    ]
}
```

### 3. Dynamic Probability & High-Level Requirement

An event that requires the player to have at least Level 3 in the `genetic_memory` talent, and scales its probability based on the Byte's level.

```json
{
    "id": "epiphany",
    "name": "Sudden Epiphany",
    "description": "Your Byte suddenly understands a complex algorithm.",
    "probability": "0.01 + (byte.level * 0.005)",
    "requirements": [{ "type": "talent", "id": "genetic_memory", "level": 3 }],
    "effects": [{ "type": "bits", "amount": 500 }]
}
```

### 4. Status Effect (Hediff) Trigger

An event that only triggers if the Byte is suffering from the `overclocked` status effect (at least 2 stacks), and damages their integrity.

```json
{
    "id": "overclock_burn",
    "name": "Thermal Burn",
    "description": "The overclocking stress caused a minor thermal burn!",
    "probability": 0.15,
    "requirements": [{ "type": "hediff", "id": "overclocked", "minStacks": 2 }],
    "effects": [{ "type": "integrity", "amount": -15 }]
}
```
