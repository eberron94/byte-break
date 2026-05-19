# Shops Configuration (`shops.json`)

The `shops.json` file defines the various vendors and marketplaces players can interact with. It controls which items can be bought or sold, dynamic pricing, limited stock, and specific availability schedules (like weekend-only merchants).

The file should contain a single JSON array composed of Shop objects.

## Shop Object Properties

| Property          | Type   | Default  | Description                                                                                                                                  |
| :---------------- | :----- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | String | **Req.** | The unique identifier for the shop.                                                                                                          |
| `name`            | String | **Req.** | The display title of the shop in the UI.                                                                                                     |
| `description`     | String | `""`     | The flavor text describing the shop and its wares.                                                                                           |
| `categories`      | Array  | `[]`     | An array of item `type` strings (e.g., `["consumable"]`). The shop will buy and sell any item matching these categories.                     |
| `items`           | Array  | `[]`     | An array of specific item `id` strings (e.g., `["mystery_cache"]`). The shop will explicitly trade these items regardless of their category. |
| `priceMultiplier` | Number | `1.0`    | A modifier applied to the base `cost` of items when the player **buys** them. `1.5` makes items 50% more expensive.                          |
| `sellMultiplier`  | Number | `0.5`    | A modifier applied to the base `cost` of items when the player **sells** them. `0.5` means the player gets half the base value back.         |
| `timeAvailable`   | Object | `{}`     | A scheduling object determining when the shop is open. See the **Availability Schedule** section below.                                      |
| `stock`           | Object | `{}`     | A mapping of item IDs to their maximum stock limit per player. See the **Limited Stock** section below.                                      |
| `requirements`    | Array  | `[]`     | Constraints the player/byte must meet for the shop to appear. See the **Appearance Requirements** section below.                             |

---

## Availability Schedule (`timeAvailable`)

You can restrict a shop so it only opens on certain days of the week or times of day. If omitted, the shop is always open.

| Property     | Type  | Description                                                                                      |
| :----------- | :---- | :----------------------------------------------------------------------------------------------- |
| `daysOfWeek` | Array | An array of integers representing the days it is open (0-6, where 0 is Sunday). e.g., `[0, 6]`.  |
| `timePhase`  | Array | An array of valid time phases. Valid phases: `"day"`, `"evening"`, `"night"`. e.g., `["night"]`. |

---

## Limited Stock (`stock`)

You can prevent players from buying an infinite amount of powerful items by defining a `stock` cap. The stock limit is tracked per player in their `history` object and persists forever (unless reset by a specific game mechanic or admin command).

```json
"stock": {
    "system_restore": 1,
    "energy_drink": 5
}
```

_In this example, a player can only ever buy 1 System Restore and 5 Energy Drinks from this specific shop._

---

## Appearance Requirements (`requirements`)

Shops use the standard requirement system to determine if they are visible to the player. It evaluates standard min/max ranges against the active Byte and Player.

See Requirements Configuration for all valid types.

---

## Examples

### 1. Basic General Store

A standard shop that accepts all consumable items, runs at normal prices, and is open 24/7.

```json
{
    "id": "general_store",
    "name": "General Store",
    "description": "Your standard hub for basic utilities and patches.",
    "categories": ["consumable"],
    "priceMultiplier": 1.0,
    "sellMultiplier": 0.5
}
```

### 2. The Black Market (Night & Weekend Only)

A shady vendor that only appears at night or on weekends. Their items cost double, but they buy items from you at full base price!

```json
{
    "id": "black_market",
    "name": "The Black Market",
    "description": "A shady dealer operating in the shadows. High prices, but great payouts.",
    "categories": ["special", "consumable"],
    "items": ["mystery_cache"],
    "priceMultiplier": 2.0,
    "sellMultiplier": 1.0,
    "timeAvailable": {
        "daysOfWeek": [0, 5, 6],
        "timePhase": ["night"]
    }
}
```

### 3. Specialty Vendor (Limited Stock & Level Locked)

An elite vendor that only talks to Bytes with high logic. Sells powerful, strictly limited items.

```json
{
    "id": "elite_tech_vendor",
    "name": "Elite Technican",
    "description": "Sells advanced system upgrades, but only to those who understand them.",
    "items": ["byte_rebooter", "user_mutator"],
    "stock": {
        "byte_rebooter": 3,
        "user_mutator": 1
    },
    "requirements": [
        {
            "type": "stat",
            "key": "logic",
            "min": 15
        }
    ]
}
```
