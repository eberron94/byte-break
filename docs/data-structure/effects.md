# Effects Configuration (`effects.md`)

When an item is used, or an event, room tick, or activity occurs, the game parses its `effects` array using the dynamic mathematical evaluator. This allows these components to have flat numerical effects, or dynamic effects based on the Byte's level, time of day, or missing health.

## Standard Effect Object

| Property   | Type          | Description                                                                                                          |
| :--------- | :------------ | :------------------------------------------------------------------------------------------------------------------- |
| `type`     | String        | The target pool, need, stat, or skill to modify. (e.g., `"charge"`, `"integrity"`, `"energy"`, `"upgrade_assault"`). |
| `amount`   | Number/String | The amount to add (positive) or subtract (negative). Supports math expressions (e.g., `"byte.level * 10"`).          |
| `maxLimit` | Number/String | _(Optional)_ Clamps the value so the modification cannot push the target above this limit.                           |
| `minLimit` | Number/String | _(Optional)_ Clamps the value so the modification cannot push the target below this limit.                           |
| `die`      | Number/String | _(Optional)_ A 1-in-N chance for the effect to apply (e.g., `2` = 50% chance, `4` = 25% chance).                     |

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

## Environment Context in Expressions

When writing math expressions inside `effects`, you have access to the following dynamic context variables:

- `byte`: The active pet (e.g., `byte.level`, `byte.stats.logic.value`).
- `player`: The owner (e.g., `player.energy.value`, `player.inventory.basic_patch`).
- `timePhase`: The current time block (`"day"`, `"evening"`, `"night"`).
- `dayOfWeek`: The current day of the week (Integer 0-6).

Note: Certain implementations may include additional context. For instance, Passive Room Effects also pass `tickCounter`.