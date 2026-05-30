# Activities Configuration (`activities.json`)

The `activities.json` file defines all the actions a player can explicitly instruct their Byte to perform. Activities can consume energy, require specific items, trigger minigames, or initiate combat simulations.

The file should contain a single JSON array composed of Activity objects.

## Activity Object Properties

| Property       | Type    | Default      | Description                                                                                                     |
| :------------- | :------ | :----------- | :-------------------------------------------------------------------------------------------------------------- |
| `id`           | String  | **Required** | The unique identifier for the activity.                                                                         |
| `name`         | String  | **Required** | The display title of the activity shown on the button.                                                          |
| `description`  | String  | `""`         | The flavor text describing the activity.                                                                        |
| `requirements` | Array   | `[]`         | An array of prerequisite conditions that must be met to perform this activity. See Requirements Configuration.  |
| `effects`      | Array   | `[]`         | An array of effect objects applied when the activity is performed. See Effects Configuration.                   |
| `itemSelect`   | Object  | `null`       | If provided, forces the player to select a valid item from their inventory before performing the activity.      |
| `isWebView`    | Boolean | `false`      | If `true`, the activity button will open the Web App to a specific view instead of performing an inline action. |
| `isMinigame`   | Boolean | `false`      | If `true`, clicking the activity will lock the player into a minigame sequence. Requires the `minigame` object. |
| `minigame`     | Object  | `null`       | Configuration for the minigame if `isMinigame` is true.                                                         |
| `isCombat`     | Boolean | `false`      | If `true`, the activity will initiate a combat simulation against an NPC. Requires the `combat` object.         |
| `combat`       | Object  | `null`       | Configuration for the combat simulation if `isCombat` is true.                                                  |

---

## Item Selection (`itemSelect`)

If an activity requires the player to sacrifice or use a specific item (like feeding the Byte or installing a module), you can define the `itemSelect` object. The UI will automatically filter the player's inventory and prompt them to pick a valid item.

If the selected item has `"isConsumed": true` in `items.json`, it will automatically be removed from the player's inventory upon successful execution.

**Dynamic Context:** When an activity uses `itemSelect`, the specific item chosen by the player is injected into the math evaluator as `item`. You can use this to dynamically scale effects based on the item's properties (like `item.cost`).

| Property | Type   | Description                                                                                      |
| :------- | :----- | :----------------------------------------------------------------------------------------------- |
| `type`   | String | Filters the selection to only allow items of this specific type (e.g., `"consumable"`, `"key"`). |
| `ids`    | Array  | Filters the selection to only allow items that match these specific string IDs.                  |

---

## Combat Configuration (`combat`)

When `isCombat` is `true`, the Web API expects a `combat` configuration object to generate the NPC opponent.

| Property    | Type   | Default            | Description                                                                                         |
| :---------- | :----- | :----------------- | :-------------------------------------------------------------------------------------------------- |
| `enemyId`   | String | `"training_virus"` | The ID of the enemy configured in `enemies.json`.                                                   |
| `hp` / `tf` | Number | `100`              | Flat pool values for the enemy. Overrides defaults in `enemies.json`.                               |
| `skills`    | Object | `{}`               | An object overriding the enemy's specific invested skills (e.g., `{"assault": 10, "firewall": 5}`). |

---

## Minigame Configuration (`minigame`)

When `isMinigame` is `true`, this object routes the activity to a specific minigame engine and provides it with parameters.

| Property      | Type   | Default                | Description                                                                                                   |
| :------------ | :----- | :--------------------- | :------------------------------------------------------------------------------------------------------------ |
| `id`          | String | _Inherits Activity ID_ | The internal ID of the minigame to load (e.g., `"packet_sniffer"`).                                           |
| `difficulty`  | Object | `{}`                   | A configuration object passed to the minigame containing difficulty parameters (like `guessLength`, `level`). |
| `winEffects`  | Array  | `[]`                   | Effects applied to the player if they win the minigame.                                                       |
| `loseEffects` | Array  | `[]`                   | Effects applied to the player if they lose the minigame.                                                      |

---

## Examples

### 1. Basic Action (Sleep)

An activity that requires the Byte to be awake, costs no energy, and puts the Byte into Stasis.

```json
{
    "id": "power_down",
    "name": "Power Down",
    "description": "Puts the Byte into stasis, restoring core needs over time.",
    "requirements": [{ "type": "stat", "key": "isAsleep", "max": 0 }],
    "effects": [{ "type": "isAsleep", "amount": 1 }]
}
```

### 2. Item Select Activity (Feed)

An activity that costs 5 Player Energy and prompts the user to select any `"consumable"` item to use.

```json
{
    "id": "feed_byte",
    "name": "Feed Byte",
    "description": "Give your Byte a consumable item.",
    "effects": [{ "type": "energy", "amount": -5 }],
    "itemSelect": {
        "type": "consumable"
    }
}
```

### 3. Combat Simulation (Dojo Training)

Opens the Web App to initiate a scaled combat simulation. Note that `isWebView` and `isCombat` are used together, sending the player to the UI to watch the fight!

```json
{
    "id": "training_routine",
    "name": "Combat Training",
    "description": "Fight a training dummy to earn bits.",
    "isWebView": true,
    "isCombat": true,
    "effects": [{ "type": "energy", "amount": -20 }],
    "combat": {
        "enemyId": "training_virus",
        "skills": {
            "firewall": 5
        }
    }
}
```

### 4. Minigame Activity (Packet Sniffer)

Starts a hacking minigame. It dynamically determines the minigame configuration based on the player's `logic` stat!

```json
{
    "id": "hack_terminal",
    "name": "Hack Terminal",
    "isMinigame": true,
    "effects": [{ "type": "energy", "amount": -15 }],
    "minigame": {
        "id": "packet_sniffer",
        "difficulty": {
            "level": "normal",
            "guessLength": 4,
            "poolSize": "8 - (byte.stats.logic.value * 0.1)",
            "maxGuesses": 6
        },
        "winEffects": [{ "type": "bits", "amount": 250 }]
    }
}
```

### 5. Dynamic Item Consumption (Wishing Well)

An activity that forces the player to select a `"currency"` item and consumes it. It then dynamically scales the amount of "Lucky" status stacks the player receives based on the monetary value of the coin they tossed in!

```json
{
    "id": "wishing_well",
    "name": "Toss Coin",
    "description": "Toss a currency item into the roaming digital well to gain its favor.",
    "itemSelect": {
        "type": "currency",
        "isConsumed": true
    },
    "effects": [
        {
            "type": "hediff",
            "id": "lucky",
            "action": "escalate",
            "amount": "Math.max(1, Math.floor(item.cost / 100))"
        }
    ]
}
```

```

```
