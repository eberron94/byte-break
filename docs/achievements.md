# Achievements Configuration (`achievements.json`)

The `achievements.json` file defines the milestone-based goals players can work towards to earn Achievement Points (α). These points are a special currency used exclusively to unlock and upgrade permanent Talents.

The file should contain a single JSON array composed of Achievement objects.

## Achievement Object Properties

| Property      | Type             | Default      | Description                                                                                                                                                                    |
| :------------ | :--------------- | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | String           | **Required** | The unique identifier for the achievement. The `AchievementManager` explicitly listens for Game Events and increments progress based on these exact IDs (e.g., `"level_ups"`). |
| `name`        | String           | **Required** | The display title of the achievement in the Web App UI.                                                                                                                        |
| `description` | String           | `""`         | The flavor text describing what action the player needs to perform to progress this achievement.                                                                               |
| `tiers`       | Array of Objects | `[]`         | The progressive milestones required to unlock each tier of the achievement. Each object contains properties for that tier.                                                     |

---

## Tier System

Achievements in Tele-grow are progressive. Rather than having a separate achievement for "Win 10 Battles" and "Win 50 Battles", a single achievement contains multiple tiers.

- **`requirement`**: The cumulative progress required to complete this tier (e.g., `10`).
- **`reward`**: The payout in Achievement Points (α) upon reaching this milestone (e.g., `1`).
- **`description`**: *(Optional)* A custom description that overrides the base achievement description for this specific tier.
- **`effects`**: *(Optional)* An array of effect objects applied to the Byte and Player when this tier is reached. See Effects Configuration.

---

## Examples

### 1. Simple Multi-Tier Achievement (Level Ups)

An achievement that tracks how many times the player's Bytes have leveled up. It rewards increasing amounts of AP as the player hits the 5, 25, 50, and 100 milestones.

```json
{
    "id": "level_ups",
    "name": "Rapid Growth",
    "description": "Level up your Bytes to unlock new potentials.",
    "tiers": [
        { "requirement": 5, "reward": 1, "description": "Reach level 5." },
        { "requirement": 25, "reward": 2, "description": "Reach level 25." },
        { "requirement": 50, "reward": 3, "description": "Reach level 50." },
        { "requirement": 100, "reward": 5, "description": "Reach level 100." }
    ]
}
```

### 2. Single-Tier Milestone (Minigame Mastery)

An achievement with only a single goal. Once the player beats the Packet Sniffer minigame on Normal difficulty 10 times, it grants a massive 5 AP and is permanently completed.

```json
{
    "id": "packet_sniffer_normal_wins",
    "name": "Elite Hacker",
    "description": "Successfully crack the Packet Sniffer on Normal difficulty.",
    "tiers": [10],
    "rewards": [5]
}
```
