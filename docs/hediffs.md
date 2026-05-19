# Hediffs Configuration (`hediffs.json`)

The `hediffs.json` file defines all "Health Differences" (Hediffs)—which include buffs, debuffs, status conditions, and progressive diseases that can affect a Byte. Hediffs can passively alter core stats, modify maximum capacities, or cause damage/healing over time via the global tick loop.

The file should contain a single JSON array composed of Hediff objects.

## Hediff Object Properties

| Property      | Type   | Default      | Description                                                                                                                   |
| :------------ | :----- | :----------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `id`          | String | **Required** | The unique identifier for the hediff (e.g., `"overclocked"`, `"stunned"`).                                                    |
| `name`        | String | **Required** | The display title of the status condition in the UI.                                                                          |
| `description` | String | `""`         | The mechanical description or flavor text of the condition.                                                                   |
| `maxStacks`   | Number | `undefined`  | The maximum number of stacks this condition can accumulate before it caps out (or evolves into the `nextTier`).               |
| `nextTier`    | String | `null`       | The ID of the Hediff to evolve into if a player gains a stack that pushes them over `maxStacks`.                              |
| `prevTier`    | String | `null`       | The ID of the Hediff to regress into if this condition's stacks drop to `0`. If omitted, the condition simply disappears.     |
| `modifiers`   | Array  | `[]`         | An array of modifier objects applied instantly and persistently to the Byte's limits or stats. See the **Modifiers** section. |
| `tickEffects` | Array  | `[]`         | An array of effect objects applied passively to the Byte over time while the condition persists. See Effects Configuration.   |

---

## Modifiers Configuration

Modifiers natively hook into the Byte's getters. Unlike `tickEffects` which apply flat values (like healing or damage) over time, `modifiers` persistently raise or lower a Byte's effective limit as long as the status condition remains active.

| Property | Type          | Description                                                                                                                                      |
| :------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`   | String        | The system archetype being modified. Valid types are `"pool"`, `"stat"`, `"skill"`, `"need_max"`, and `"need_decay"`.                            |
| `key`    | String        | The specific ID of the attribute being modified (e.g., `"integrity"`, `"logic"`, `"charge"`).                                                    |
| `amount` | Number/String | The amount to dynamically modify the getter by. Supports math expressions. You can use the `stacks` context variable to scale the penalty/bonus! |

---

## The Stack and Tier System

Hediffs in Tele-grow operate on a stack-based severity model. When an item or event applies a Hediff with the `"escalate"` action, the stack count increases. If the `"reduce"` action is used, it decreases.

- **Capping:** If `nextTier` is omitted, the stack count will simply halt at `maxStacks`.
- **Evolving (`nextTier`):** If a Hediff surpasses its `maxStacks` limit and has a `nextTier` defined, the current condition is completely deleted, and the new condition is applied starting at 1 stack.
- **Regressing (`prevTier`):** If a Hediff's stack count drops to `0`, it is normally removed. However, if `prevTier` is defined, the condition downgrades into the previous tier and is assigned its maximum possible stack limit.

---

## Environment Context in Expressions

When writing math expressions inside `modifiers` or `tickEffects`, you have access to the standard context variables (`byte`, `player`, `timePhase`, `dayOfWeek`), as well as a special **`stacks`** variable.

- `stacks`: The current number of stacks the Byte has of this specific Hediff.

---

## Examples

### 1. Basic Temporary Buff (Overclock)

A simple buff that gives the Byte a massive boost to their maximum TeraFlops capacity. Since `maxStacks` is not defined, it can be stacked infinitely to keep boosting the pool!

```json
{
    "id": "overclocked",
    "name": "Overclocked",
    "description": "System limits are bypassed. Max Teraflops significantly increased.",
    "modifiers": [
        {
            "type": "pool",
            "key": "teraflops",
            "amount": "25 * stacks"
        }
    ]
}
```

### 2. Tier 1 Progressive Disease (Minor Viral Infection)

A debuff that slightly hurts the Byte's Integrity over time. If the infection reaches 3 stacks (e.g., from failing to cure it and letting it escalate), it evolves into a Severe Infection.

```json
{
    "id": "viral_infection_minor",
    "name": "Minor Viral Infection",
    "description": "A parasitic background process draining Integrity.",
    "maxStacks": 2,
    "nextTier": "viral_infection_severe",
    "tickEffects": [{ "type": "integrity", "amount": -2 }]
}
```

### 3. Tier 2 Progressive Disease (Severe Viral Infection)

The evolution of the previous disease. It drastically lowers maximum bandwidth, deals severe damage over time, and if the player manages to reduce it (e.g., by using an Antivirus item), it correctly drops back down into the Minor infection!

```json
{
    "id": "viral_infection_severe",
    "name": "Severe Viral Infection",
    "description": "Core processes are critically compromised.",
    "maxStacks": 5,
    "prevTier": "viral_infection_minor",
    "modifiers": [
        {
            "type": "pool",
            "key": "bandwidth",
            "amount": "-10 * stacks"
        }
    ],
    "tickEffects": [
        { "type": "integrity", "amount": -10, "ticksPerTrigger": 2 }
    ]
}
```
