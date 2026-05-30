# Loot Configuration (`loot.json`)

The `loot.json` file defines "Drop Tables" that reward the player with Bits and Items. Loot tables are incredibly versatile and can be triggered by winning combat, successfully hacking a minigame, opening a consumable item, or resolving a random event.

**Important Difference:** Unlike most other configuration files which are Arrays, `loot.json` is a single **JSON Object (Dictionary)** where the Keys are the unique Drop Table IDs, and the Values are the table configurations.

## Drop Table Object Properties

| Property | Type   | Default | Description                                                                         |
| :------- | :----- | :------ | :---------------------------------------------------------------------------------- |
| `bits`   | Number | `0`     | A flat, guaranteed amount of Bits (β) rewarded to the player when this table rolls. |
| `items`  | Array  | `[]`    | An array of Item Drop objects to roll for. See the **Item Drops** section below.    |

---

## Item Drops

Every object inside the `items` array represents a potential item the player can receive. Each item rolls its `chance` independently, meaning a player could theoretically receive _every_ item in the table, or _none_ of them, depending on their luck!

| Property    | Type          | Default  | Description                                                                                                    |
| :---------- | :------------ | :------- | :------------------------------------------------------------------------------------------------------------- |
| `id`        | String        | **Req.** | The `id` of the item from `items.json` to reward.                                                              |
| `amount`    | Number/String | `1`      | The quantity of this item to give if the roll succeeds. Supports math expressions (e.g., `"successCount"`).    |
| `die`       | Number/String | `null`   | A simple 1-in-N chance for the item to drop (e.g., `2` = 50% chance, `4` = 25% chance).                        |
| `diceCheck` | Object        | `null`   | A custom dice pool roll that must meet a required number of successes for the item to drop.                    |
| `dicePool`  | Number/String | `null`   | Rolls a custom dice pool and injects `successCount` into the `amount` evaluator to scale the quantity dropped. |

_Note: Even if an item successfully rolls, it is still strictly bound by the `maxCount` constraint defined in `items.json`. If a player's inventory is full, the excess loot is cleanly discarded._

---

## Examples

### 1. Basic Guaranteed Reward

A simple loot table that guarantees 100 Bits and exactly 1 Basic Patch every time it is triggered.

```json
"dojo_win_easy": {
    "bits": 100,
    "items": [
        {
            "id": "basic_patch"
        }
    ]
}
```

### 2. Randomized Drop Table

A loot table that gives a small flat amount of Bits, a 50% chance for a Patch, and a rare 5% chance to drop a valuable Gold Coin.

```json
"mystery_cache_drops": {
    "bits": 25,
    "items": [
        {
            "id": "basic_patch",
            "amount": 2,
            "chance": 0.5
        },
        {
            "id": "gold_coin",
            "amount": 1,
            "chance": 0.05
        }
    ]
}
```

### 3. Currency Only

A loot table that exclusively rewards money without dropping any items.

```json
"small_bit_cache": {
    "bits": 500
}
```
