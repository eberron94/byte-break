# Items Configuration (`items.json`)

The `items.json` file is a central repository for all items that can exist within a player's inventory. It defines everything from simple crafting materials to powerful consumables and key items.

The file should contain a single JSON array composed of Item objects.

## Item Object Properties

| Property      | Type    | Default                                        | Description                                                                                                                                                                     |
| :------------ | :------ | :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | String  | **Required**                                   | The full display name of the item.                                                                                                                                              |
| `id`          | String  | Derived from `name`                            | The unique identifier for the item. If omitted, it will automatically lowercase the `name` and replace spaces with underscores (e.g., "Health Potion" -> `health_potion`).      |
| `shortname`   | String  | `name`                                         | A shorter name used in tight UI spaces, like inline keyboard buttons.                                                                                                           |
| `description` | String  | `""`                                           | The flavor text and mechanical description of the item shown to players.                                                                                                        |
| `type`        | String  | `"general"`                                    | The category of the item (`"consumable"`, `"hardware"`, `"software"`, `"currency"`, `"key"`, etc.).                                                                             |
| `maxCount`    | Number  | `Infinity`                                     | The maximum amount of this item a player can hold in their inventory at one time. Any excess amounts gained will be discarded.                                                  |
| `cost`        | Number  | `undefined`                                    | The base cost of the item in Bits (β). Required if the item is to be sold or bought in a Shop. If omitted, the item cannot be traded.                                           |
| `isConsumed`  | Boolean | `true` if type is `"consumable"`, else `false` | Determines if 1 quantity of the item is automatically removed from the player's inventory when used.                                                                            |
| `cooldown`    | Number  | `0`                                            | The number of minutes a player must wait before they are allowed to use this specific item again.                                                                               |
| `useEffects`  | Array   | `[]`                                           | An array of effect objects applied to the Byte and Player when the item is used. See Effects Configuration.                                                       |

---

## Equipment Properties

Items with the `type` of `"hardware"` or `"software"` can be equipped to the Byte's Architecture loadout. 

| Property      | Type   | Description                                                                                                             |
| :------------ | :----- | :---------------------------------------------------------------------------------------------------------------------- |
| `equipLabel`  | String | A cosmetic label shown in the UI (e.g., `"Payload"`, `"Proxy"`, `"Daemon"`).                                            |
| `modifiers`   | Array  | An array of modifier objects applied passively while equipped. Supports `type`, `key`, `amount`, and `sides` (for dice).|
| `tickEffects` | Array  | An array of effect objects applied every global tick while equipped. Supports `ticksPerTrigger`.                        |

---

## Examples

### 1. Offensive Hardware (Payload)

A piece of equipment that grants 3 additional 8-sided dice (3d8) to the Assault pool during combat.

```json
{
    "id": "broadsword_exe",
    "name": "Broadsword.exe",
    "description": "An aggressive payload designed to brutally execute target processes.",
    "type": "hardware",
    "cost": 500,
    "equipLabel": "Payload",
    "modifiers": [
        { "type": "skill", "key": "assault", "amount": 3, "sides": 8 }
    ]
}
```

### 2. Basic Consumable (Heals Integrity)

A simple healing item that restores 50 Integrity, gets consumed on use, and has a 5-minute cooldown.

```json
{
    "id": "basic_patch",
    "name": "Basic Patch",
    "shortname": "Patch",
    "description": "Restores 50 Integrity. Cannot exceed maximum capacity.",
    "type": "consumable",
    "cost": 150,
    "maxCount": 10,
    "cooldown": 5,
    "useEffects": [{ "type": "integrity", "amount": 50 }]
}
```

### 2. Dynamic Consumable (Percentage-Based)

A battery that restores exactly 50% of the Byte's maximum charge need.

```json
{
    "id": "half_battery",
    "name": "Medium Battery",
    "description": "Restores 50% of your maximum Charge.",
    "type": "consumable",
    "cost": 300,
    "effects": [
        { "type": "charge", "amount": "byte.needs.charge.maxValue * 0.5" }
    ]
}
```

### 3. Key Item (Unlocks things, not consumed)

A permanent access card. Because `type` is `"key"`, it naturally sets `isConsumed: false` and the shop system will prevent players from buying duplicates.

```json
{
    "id": "vip_passcard",
    "name": "VIP Passcard",
    "description": "Grants access to premium network sectors. Does not expire.",
    "type": "key",
    "cost": 5000,
    "maxCount": 1
}
```

### 4. Loot Box (Grants random items)

An item that gives the player a roll on a loot table when opened.

```json
{
    "id": "mystery_cache",
    "name": "Mystery Cache",
    "description": "A secured data cache. Open it to extract random items and bits!",
    "type": "consumable",
    "effects": [{ "type": "loot", "table": "mystery_cache_drops" }]
}
```

### 5. Conditional Limits (Energy Drink)

An item that grants 20 Player Energy, but will completely refuse to provide energy if you are already above 80 Energy.

```json
{
    "id": "energy_drink",
    "name": "Energy Drink",
    "description": "Restores 20 Energy, but has no effect if you already have 80 or more.",
    "type": "consumable",
    "cost": 50,
    "effects": [{ "type": "energy", "amount": 20, "maxLimit": 80 }]
}
```

### 6. Hediff Inducer (Status Effect Item)

An item that buffs the Byte by applying a status effect.

```json
{
    "id": "overclock_stim",
    "name": "Overclock Stim",
    "description": "Temporarily overclocks the system, increasing combat efficiency.",
    "type": "consumable",
    "cooldown": 60,
    "effects": [{ "type": "hediff", "id": "overclocked", "action": "escalate" }]
}
```
