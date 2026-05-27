# Hediffs Configuration (`hediffs.json`)

The `hediffs.json` file defines "Status Effects" (Health Differentials) that can be applied to Bytes or Players. Hediffs can provide passive stat modifiers, trigger recurring effects over time, override environmental variables, and naturally decay or escalate.

The file should contain a single JSON array composed of Hediff objects.

## Hediff Object Properties

| Property         | Type   | Default | Description                                                                                                    |
| :--------------- | :----- | :------ | :------------------------------------------------------------------------------------------------------------- |
| `id`             | String | **Req.**| The unique identifier for the status effect.                                                                   |
| `name`           | String | **Req.**| The display title of the status effect shown in the UI.                                                        |
| `description`    | String | `""`    | The flavor text describing the condition.                                                                      |
| `maxStacks`      | Number | `null`  | The maximum number of stacks this condition can reach before being capped (or escalating to the next tier).    |
| `nextTier`       | String | `null`  | If provided, reaching `maxStacks` + 1 will automatically cure this condition and apply 1 stack of this new ID. |
| `prevTier`       | String | `null`  | If provided, reducing this condition below 1 stack will apply the max stacks of this previous ID instead.      |
| `modifiers`      | Array  | `[]`    | An array of passive stat/skill modifier objects.                                                               |
| `tickEffects`    | Array  | `[]`    | An array of effect objects applied every game tick while this condition is active.                             |
| `decay`          | Object | `null`  | Configuration for how and when this status effect naturally cures or reduces itself.                           |
| `localOverrides` | Object | `{}`    | A dictionary of environment variables to inject into the `GameContext` (e.g., forcing it to be "night").       |

---

## Modifiers Array

Modifiers are passive boosts or penalties applied strictly while the Hediff is active. They are dynamically evaluated on demand without permanently altering the underlying save file.

| Property | Type   | Description                                                                              |
| :------- | :----- | :--------------------------------------------------------------------------------------- |
| `type`   | String | The category of the target being modified (`"stat"`, `"skill"`, `"pool"`).               |
| `key`    | String | The specific target ID (e.g., `"logic"`, `"assault"`).                                   |
| `amount` | String | A math expression evaluating the modifier amount (e.g., `"-5 * stacks"`).                |

---

## Decay Configuration (`decay`)

The `decay` object allows a status effect to automatically manage its own lifespan without needing external events or manual item usage.

| Property       | Type          | Default    | Description                                                                                                       |
| :------------- | :------------ | :--------- | :---------------------------------------------------------------------------------------------------------------- |
| `action`       | String        | `"remove"` | What happens when the decay triggers. Can be `"remove"` (cure completely) or `"reduce"` (lose 1 stack).           |
| `ticks`        | Number/String | `null`     | The number of global ticks the condition must be alive before it decays. Supports math expressions.               |
| `requirements` | Array         | `[]`       | A standard requirements array. If these evaluate to true during a tick, the decay triggers instantly.             |

---

## Examples

### 1. Temporary Account Buff (Player Hediff)

A "Weekend Pass" that grants special access, automatically deleting itself when Monday arrives.

```json
{
    "id": "weekend_pass",
    "name": "Weekend Access Pass",
    "description": "Grants access to premium weekend facilities.",
    "decay": {
        "action": "remove",
        "requirements": [
            { "type": "dayOfWeek", "days": [1, 2, 3, 4, 5] }
        ]
    }
}
```

### 2. Escalating Condition

A buff that increases stats but causes thermal damage over time. If stacked too high, it turns into a severe meltdown.

```json
{
    "id": "overclocked",
    "name": "Overclocked",
    "description": "Running beyond safe limits. Increased stats but higher thermal load.",
    "maxStacks": 3,
    "nextTier": "melted_down",
    "modifiers": [
        { "type": "stat", "key": "logic", "amount": "1 * stacks" },
        { "type": "skill", "key": "assault", "amount": "2 * stacks" }
    ],
    "tickEffects": [
        { "type": "thermal", "amount": "-5 * stacks" }
    ]
}
```