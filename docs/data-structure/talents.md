# Talents Configuration (`talents.json`)

The `talents.json` file defines the permanent, account-wide upgrades available to a player. These talents are purchased using **Achievement Points (α)** and provide persistent benefits across all of a player's Bytes (like reducing merge costs or boosting genetic inheritance).

The file should contain a single JSON array composed of Talent objects.

## Talent Object Properties

| Property       | Type   | Default      | Description                                                                                                         |
| :------------- | :----- | :----------- | :------------------------------------------------------------------------------------------------------------------ |
| `id`           | String | **Required** | The unique identifier for the talent.                                                                               |
| `name`         | String | **Required** | The display title of the talent shown in the UI.                                                                    |
| `description`  | String | `""`         | The mechanical description explaining what the talent does.                                                         |
| `cost`         | Number | **Required** | The cost in Achievement Points (α) to purchase **one level** of this talent.                                        |
| `maxLevel`     | Number | `1`          | The maximum number of times this talent can be upgraded.                                                            |
| `requirements` | Array  | `[]`         | An array of prerequisite conditions that must be met for this talent to be visible. See Requirements Configuration. |

---

## Talent Trees & Prerequisites

You can chain talents together to create a progressive "Talent Tree" by utilizing the `requirements` array and the `"talent"` requirement type.

If a talent has a requirement that the player does not meet, it is completely hidden from the Web App UI. However, the UI has a built-in **Hint System**: If a hidden talent specifically requires a prior talent that the player _can_ see, the visible talent will be marked with a special 🔍 icon to let the player know that upgrading it will unlock something new!

---

## Examples

### 1. Basic Single-Level Talent

A simple talent that costs 5 Achievement Points and can only be bought once. Since it has no requirements, it is visible to all players immediately.

```json
{
    "id": "genetic_memory",
    "name": "Genetic Memory",
    "description": "Increases inherited base stats during a Merge.",
    "cost": 5,
    "maxLevel": 1
}
```

### 2. Multi-Level Talent

A talent that can be upgraded up to 5 times. Because the `cost` is applied per level, buying all 5 levels will cost a total of 10 α.

```json
{
    "id": "merge_optimization",
    "name": "Merge Optimization",
    "description": "Reduces the Energy cost of merging Bytes by 15 ε per level.",
    "cost": 2,
    "maxLevel": 5
}
```

### 3. Progressive Talent (Tree Node)

An advanced talent that is hidden from the player until they have purchased at least Level 3 in the `merge_optimization` talent.

```json
{
    "id": "overflow_bonus",
    "name": "Buffer Architect",
    "description": "Increases the starting Buffer Overflow of child Bytes.",
    "cost": 10,
    "maxLevel": 1,
    "requirements": [
        {
            "type": "talent",
            "id": "merge_optimization",
            "level": 3
        }
    ]
}
```
