# Effects Configuration (`effects.md`)

When an item is used, or an event, room tick, or activity occurs, the game parses its `effects` array using the dynamic mathematical evaluator. This allows these components to have flat numerical effects, or dynamic effects based on the Byte's level, time of day, or missing health.

## Standard Effect Object

| Property    | Type          | Description                                                                                                           |
| :---------- | :------------ | :-------------------------------------------------------------------------------------------------------------------- |
| `type`      | String        | The target pool, need, stat, or skill to modify. (e.g., `"charge"`, `"integrity"`, `"energy"`, `"upgrade_assault"`).  |
| `amount`    | Number/String | The amount to add (positive) or subtract (negative). Supports math expressions (e.g., `"byte.level * 10"`).           |
| `maxLimit`  | Number/String | _(Optional)_ Clamps the value so the modification cannot push the target above this limit.                            |
| `minLimit`  | Number/String | _(Optional)_ Clamps the value so the modification cannot push the target below this limit.                            |
| `die`       | Number/String | _(Optional)_ A simple flat 1-in-N chance for the effect to apply (e.g., `2` = 50% chance). Legacy/lightweight option. |
| `diceCheck` | Object        | _(Optional)_ A custom dice pool roll that must meet a required number of successes to apply the effect.               |
| `dicePool`  | Number/String | _(Optional)_ Rolls a custom dice pool and injects `successCount` into the `amount` evaluator to scale the effect.     |

## Special Effect Types

Certain `type` strings change how the effect object behaves:

- **`"inventory"`**: Modifies the player's inventory.
    - Requires: `id` (The ID of the item to add/remove) and `amount`.
- **`"loot"`**: Rolls a predefined loot table and grants the results to the player.
    - Requires: `table` (The ID of the loot table from `loot.json`).
- **`"hediff"`**: Applies, escalates, or removes a status condition from the Byte.
    - Requires: `id` (The ID of the Hediff).
    - Optional: `action` (`"escalate"`, `"reduce"`, or `"remove"`). Defaults to `"escalate"`.

---

## Dice Mechanics for Effects

Effects can conditionally apply or dynamically scale using three different RNG systems. The newer dice pool systems consider a roll successful if the die rolls `<= threshold` (default 3 on a d6).

### 1. Simple Probability (`die`)

The most lightweight option. It provides a simple flat 1-in-N chance for the effect to apply. If the roll fails, the effect is skipped entirely.
_Example:_ `"die": 4` gives the effect a 25% chance to apply.

### 2. Conditional Application (`diceCheck`)

If you provide a `diceCheck` object, the engine rolls a custom dice pool. The effect will **only** apply if the roll meets the required number of successes.

| Property    | Description                                               |
| :---------- | :-------------------------------------------------------- |
| `pool`      | The number of dice to roll. Supports math expressions.    |
| `successes` | The minimum successes needed to apply the effect.         |
| `threshold` | The target number to roll under or equal to (Default: 3). |
| `sides`     | The number of sides on the die (Default: 6).              |

### 3. Scaled Amounts (`dicePool`)

If you provide `dicePool`, the engine rolls the dice and injects `successCount` into your math environment! You can use this to dynamically alter the `amount`.

| Property        | Description                                               |
| :-------------- | :-------------------------------------------------------- |
| `dicePool`      | The number of dice to roll. Supports math expressions.    |
| `diceThreshold` | The target number to roll under or equal to (Default: 3). |
| `diceSides`     | The number of sides on the die (Default: 6).              |

_Example:_

```json
{
    "type": "bits",
    "dicePool": "byte.stats.curiosity.value",
    "amount": "Math.floor(Math.pow(1.2, successCount))"
}
```

---

## Environment Context in Expressions

When writing math expressions inside `effects`, you have access to the following dynamic context variables:

- `byte`: The active pet (e.g., `byte.level`, `byte.stats.logic.value`).
- `player`: The owner (e.g., `player.energy.value`, `player.inventory.basic_patch`).
- `timePhase`: The current time block (`"day"`, `"evening"`, `"night"`).
- `dayOfWeek`: The current day of the week (Integer 0-6).
- `successCount`: The number of successful dice rolls (Only available when using `dicePool`).

Note: Certain implementations may include additional context. For instance, Passive Room Effects also pass `tickCounter`.
