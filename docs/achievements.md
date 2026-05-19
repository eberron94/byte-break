# Achievements Configuration (`achievements.json`)

The `achievements.json` file defines the milestone-based goals players can work towards to earn Achievement Points (α). These points are a special currency used exclusively to unlock and upgrade permanent Talents.

The file should contain a single JSON array composed of Achievement objects.

## Achievement Object Properties

| Property      | Type             | Default      | Description                                                                                                                                                                    |
| :------------ | :--------------- | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | String           | **Required** | The unique identifier for the achievement. The `AchievementManager` explicitly listens for Game Events and increments progress based on these exact IDs (e.g., `"level_ups"`). |
| `name`        | String           | **Required** | The display title of the achievement in the Web App UI.                                                                                                                        |
| `description` | String           | `""`         | The flavor text describing what action the player needs to perform to progress this achievement.                                                                               |
| `tiers`       | Array of Numbers | `[]`         | The progressive milestones/thresholds required to unlock each tier of the achievement. Must correspond 1-to-1 with the `rewards` array.                                        |
| `rewards`     | Array of Numbers | `[]`         | The amount of Achievement Points (α) granted upon reaching the corresponding threshold in the `tiers` array.                                                                   |

---

## Tier System

Achievements in Tele-grow are progressive. Rather than having a separate achievement for "Win 10 Battles" and "Win 50 Battles", a single achievement contains multiple tiers.

- **`tiers`**: Determines the cumulative progress required. `[10, 50, 100]` means Tier 1 unlocks at 10 progress, Tier 2 unlocks at 50, and Tier 3 unlocks at 100.
- **`rewards`**: Determines the payout at those exact milestones. `[1, 3, 5]` means Tier 1 gives 1 α, Tier 2 gives 3 α, and Tier 3 gives 5 α.

_Note: The `tiers` and `rewards` arrays must always have the exact same number of elements!_

---

## Examples

### 1. Simple Multi-Tier Achievement (Level Ups)

An achievement that tracks how many times the player's Bytes have leveled up. It rewards increasing amounts of AP as the player hits the 5, 25, 50, and 100 milestones.

```json
{
    "id": "level_ups",
    "name": "Rapid Growth",
    "description": "Level up your Bytes.",
    "tiers": [5, 25, 50, 100],
    "rewards": [1, 2, 3, 5]
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
