# Classes Configuration (`classes.json`)

The `classes.json` file defines the different archetypes or "classes" that a Byte can be initialized with (e.g., during spawning or merging). A Byte's class determines its avatar generation, its natural stat growth per level, the cost to upgrade its skills, and the genetic bonus it passes down when merged.

The file should contain a single JSON array composed of Class objects.

## Class Object Properties

| Property               | Type   | Default      | Description                                                                                                                                                          |
| :--------------------- | :----- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | String | **Required** | The unique identifier for the class (e.g., `"virus"`, `"demo"`).                                                                                                     |
| `name`                 | String | **Required** | The display title of the class shown in the UI.                                                                                                                      |
| `description`          | String | `""`         | The flavor text describing the class and its playstyle.                                                                                                              |
| `enhanceStat`          | String | `"aptitude"` | The core stat (e.g., `"focus"`, `"logic"`, `"curiosity"`) that gains a permanent bonus when a Byte of this class is used as the **secondary** parent during a merge. |
| `investmentRates`      | Object | `{}`         | A key-value mapping of Skill/Pool IDs to their upgrade cost in Bits (β). If a stat is omitted, it cannot be manually upgraded by a Byte of this class!               |
| `innatePointsPerLevel` | Object | `{}`         | A key-value mapping of Skill/Pool IDs to the amount of natural capacity gained automatically every time the Byte levels up.                                          |

---

## Mechanics Breakdown

### Investment Rates (`investmentRates`)

This object defines the "Talent Tree" for the class. When a player opens the Upgrades menu, **only the keys defined in this object will appear as purchasable upgrades**.

```json
"investmentRates": {
    "integrity": 150,
    "assault": 200
}
```

_In this example, the class can only upgrade its Integrity capacity (for 150 β per level) and its Assault skill (for 200 β per level)._

### Natural Growth (`innatePointsPerLevel`)

This defines the passive scaling of the class. Every time a Byte's level increases (which happens for every 100 total Bits invested), the numbers in this object are multiplied by the Byte's level and added to their capacities or skills entirely for free.

```json
"innatePointsPerLevel": {
    "integrity": 10,
    "teraflops": 5
}
```

_In this example, a Level 5 Byte will automatically have +50 Max Integrity and +25 Max Teraflops, without having to spend any Bits on upgrades._

---

## Examples

### 1. Basic Starter Class (Demo)

A well-rounded class that can upgrade a variety of stats at a moderate price, and provides a generic `aptitude` bonus when merged.

```json
{
    "id": "demo",
    "name": "Demo Module",
    "description": "A standard, unspecialized digital entity.",
    "enhanceStat": "aptitude",
    "investmentRates": {
        "integrity": 100,
        "teraflops": 100,
        "bandwidth": 100,
        "compile": 150,
        "parse": 150
    },
    "innatePointsPerLevel": {
        "integrity": 5,
        "teraflops": 2
    }
}
```

### 2. Aggressive Combat Class (Virus)

A specialized class that excels in combat. It has high natural Integrity growth and cheaper offensive upgrades, but completely lacks defensive or utility upgrades like Compile or Parse. When merged, it passes down a massive bonus to the child's `syntax` stat.

```json
{
    "id": "virus",
    "name": "Intrusive Virus",
    "description": "An aggressive self-replicating algorithm designed for penetration.",
    "enhanceStat": "syntax",
    "investmentRates": {
        "integrity": 80,
        "assault": 120,
        "shred": 150,
        "override": 200
    },
    "innatePointsPerLevel": {
        "integrity": 15,
        "assault": 2,
        "shred": 1
    }
}
```
