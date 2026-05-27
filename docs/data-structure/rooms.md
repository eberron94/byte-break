# Rooms Configuration (`rooms.json`)

The `rooms.json` file defines the different locations, environments, or network nodes a Byte can occupy. Rooms dictate which activities are available to the player and can apply passive modifiers (like healing or hazard damage) over time.

The file should contain a single JSON array composed of Room objects.

## Room Object Properties

| Property            | Type   | Default      | Description                                                                                                             |
| :------------------ | :----- | :----------- | :---------------------------------------------------------------------------------------------------------------------- |
| `id`                | String | **Required** | The unique identifier for the room.                                                                                     |
| `name`              | String | **Required** | The display name of the room shown in the UI.                                                                           |
| `description`       | String | `""`         | The flavor text describing the room.                                                                                    |
| `allowedActivities` | Array  | `[]`         | An array of activity IDs that can be performed while in this room.                                                      |
| `tickEffects`       | Array  | `null`       | An array of effect objects applied passively to the Byte while they remain in the room. See Effects Configuration.      |
| `requirements`      | Array  | `[]`         | An array of prerequisite conditions that must be met for a Byte to travel to this room. See Requirements Configuration. |

---

## Passive Modifiers (`tickEffects`)

Rooms can passively modify a Byte's needs, pools, or stats using `tickEffects`. These effects are processed automatically by the `GameManager` during the global tick loop (typically once a minute).

- **Frequency Control:** You can control how often an effect applies using the `ticksPerTrigger` property on the effect object (e.g., applying an effect only every 5 ticks). If omitted, the effect applies every tick.
- **Environment Isolation:** Offline or Asleep Bytes do not trigger active room environments, meaning they will not receive `tickEffects` until they wake up.
- **Clamping Bounds:** You can use `maxLimit` and `minLimit` to prevent passive effects from endlessly raising or lowering a stat beyond your intended environment baseline.

---

## Examples

### 1. Basic Room

A simple room that allows a few activities but has no passive effects or entry requirements.

```json
{
    "id": "living_room",
    "name": "Living Room",
    "description": "A comfortable space for your Byte to relax and play.",
    "allowedActivities": ["play_game", "pet_byte"]
}
```

### 2. Restorative Environment

A room that slowly restores a Byte's charge and thermal needs over time, but limits what activities can be done. It uses `maxLimit` to ensure the room only heals the Byte up to 80% capacity natively.

```json
{
    "id": "charging_station",
    "name": "Charging Station",
    "description": "A dedicated pod for recharging core systems.",
    "allowedActivities": ["power_down"],
    "tickEffects": [
        { "type": "charge", "amount": 2, "maxLimit": 80 },
        { "type": "thermal", "amount": 1, "maxLimit": 80 }
    ]
}
```

### 3. Hazard Room with Frequency Control

A dangerous room that damages the Byte's integrity, but only applies the damage once every 5 ticks.

```json
{
    "id": "overheated_server",
    "name": "Overheated Server",
    "description": "It's scorching hot in here. Extended exposure is not recommended.",
    "allowedActivities": ["hack_terminal", "scavenge_parts"],
    "tickEffects": [{ "type": "integrity", "amount": -5, "ticksPerTrigger": 5 }]
}
```

### 4. Restricted Access Room

A room that requires a specific item (a VIP pass) to enter. If the player does not have the item, the room will not be visible in their navigation menu.

```json
{
    "id": "vip_lounge",
    "name": "VIP Lounge",
    "description": "An exclusive network node for premium users.",
    "allowedActivities": ["premium_shop", "relax"],
    "requirements": [{ "type": "inventory", "id": "vip_passcard", "min": 1 }]
}
```
