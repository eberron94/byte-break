# Skills Configuration (`skills.json`)

The `skills.json` file provides the canonical definitions for all skills available in the game. This file acts as a master list, defining a skill's name, description, and most importantly, which core stat it is linked to.

The final value of a skill is dynamically calculated based on the value of its linked core stat, any points the player has invested via upgrades, and other passive bonuses from the Byte's class or status effects.

The file should contain a single JSON array composed of Skill objects.

## Skill Object Properties

| Property      | Type   | Default             | Description                                                                                                                      |
| :------------ | :----- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | String | Derived from `name` | The unique identifier for the skill. If omitted, it will automatically lowercase the `name` and replace spaces with underscores. |
| `name`        | String | **Required**        | The display name of the skill.                                                                                                   |
| `description` | String | `""`                | The flavor text or mechanical description of what the skill does.                                                                |
| `stat`        | String | **Required**        | The `id` of the core stat this skill is based on (e.g., `"focus"`, `"logic"`, `"syntax"`).                                       |

---

## Examples

### 1. Combat Skill (Assault)

A core offensive skill used in combat calculations. Its effectiveness is directly tied to the Byte's `Syntax` stat.

```json
{
    "id": "assault",
    "name": "Assault",
    "description": "Governs the base damage output of standard attacks.",
    "stat": "syntax"
}
```

### 2. Utility Skill (Compile)

A defensive skill that can trigger healing during combat. Its power is derived from the `Focus` stat.

```json
{
    "id": "compile",
    "name": "Compile",
    "description": "Determines the effectiveness of in-combat self-repair routines.",
    "stat": "focus"
}
```

### 3. Exploration Skill (Datamine)

A non-combat skill that might influence the amount of loot gained from combat. It is linked to the `Curiosity` stat.

```json
{
    "id": "datamine",
    "name": "Datamine",
    "description": "Increases the amount of loot extracted from defeated targets.",
    "stat": "curiosity"
}
```
