# Events Configuration (`events.json`)

The `events.json` file defines the random encounters and passive occurrences that can trigger during the game's global tick loop. Events offer random rewards, applying statuses, or taxing the player's resources.

The file should contain a single JSON array composed of Event objects.

## Event Object Properties

| Property       | Type          | Default      | Description                                                                                                                       |
| :------------- | :------------ | :----------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | String        | **Required** | The unique identifier for the event.                                                                                              |
| `name`         | String        | **Required** | The display title of the event shown in the UI.                                                                                   |
| `description`  | String        | `""`         | The flavor text describing what just happened.                                                                                    |
| `diceCheck`    | Object        | `null`       | A configuration object for dice pool probability. See the **Probabilities (Dice Pool)** section.                                  |
| `probability`  | Number/String | `0`          | The base chance of this event triggering. Can be a static number or a dynamic math expression. See the **Probabilities** section. |
| `ticksPerCheck`| Number/String | `1`          | How many game ticks must pass before this event's probability is checked. `1` means it is checked every tick. Supports math expressions. |
| `requirements` | Array         | `[]`         | An array of prerequisite conditions that must be met for this event to even be considered. See Requirements Configuration.        |
| `effects`      | Array         | `[]`         | An array of effect objects applied to the Byte and Player when the event triggers. See Effects Configuration.                     |

---

## Probabilities (Dice Pool)

The `diceCheck` object is the preferred way to determine how likely an event is to trigger _if_ its requirements are met. It uses a dice pool system where a roll of 1, 2, or 3 (by default) is a success.

| Property    | Type          | Default | Description                                                                 |
| :---------- | :------------ | :------ | :-------------------------------------------------------------------------- |
| `pool`      | Number/String | `1`     | The number of dice to roll. Supports math expressions.                      |
| `successes` | Number/String | `1`     | The number of successful rolls required to trigger the event.               |
| `threshold` | Number/String | `3`     | The maximum number on the die that counts as a success (inclusive).         |
| `sides`     | Number/String | `6`     | The number of sides on the dice.                                            |

*Note: The older `probability` field (e.g., `0.05` for 5%) is still supported as a legacy fallback, but `diceCheck` is recommended for dynamic scaling.*

---

## Frequency Control (`ticksPerCheck`)

In addition to `probability`, you can control how often an event is even considered for triggering using `ticksPerCheck`. This is useful for rare, periodic events.

- If `ticksPerCheck` is `5`, the event's probability will only be rolled every 5 game ticks.
- If omitted, it defaults to `1` (checked every tick).

This check happens *before* the probability roll, making it an efficient way to manage performance for events that shouldn't run constantly.

---

## Examples

### 1. Basic Conditional Event

An event with a custom dice pool that scales off of Curiosity. It requires 2 successes (rolling 2 or under on a d6) to trigger.

```json
{
    "id": "found_treat",
    "name": "Found a Treat",
    "description": "Your pet found a yummy treat hiding under the sofa!",
    "diceCheck": {
        "pool": "Math.floor(byte.stats.curiosity.value / 2)",
        "successes": 2,
        "threshold": 2
    },
    "requirements": [
        { "type": "room", "id": "charging_station" },
        { "type": "need", "key": "charge", "max": 80 }
    ],
    "effects": [{ "type": "loot", "table": "found_treat" }]
}
```

### 2. Time-Restricted Event

An event that only happens during the day or evening, and uses `diceCheck` on the effects to determine if they actually apply once the event occurs.

```json
{
    "id": "zoomies",
    "name": "The Zoomies!",
    "description": "Random burst of energy! Your pet runs around wildly.",
    "diceCheck": {
        "pool": 1,
        "successes": 1,
        "threshold": 1
    },
    "requirements": [{ "type": "timePhase", "phases": ["day", "evening"] }],
    "effects": [
        { "type": "telemetry", "amount": 20, "diceCheck": { "pool": 1, "successes": 1, "threshold": 3 } },
        { "type": "energy", "amount": 5, "diceCheck": { "pool": 2, "successes": 2, "threshold": 3 } }
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
