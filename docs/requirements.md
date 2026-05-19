# Requirements Configuration (`requirements.md`)

The `requirements` array acts as a filter for events, activities, rooms, shops, and other game elements. If a Byte does not meet **all** the requirements listed in a requirements array, that element is completely ignored or blocked.

Many requirement fields (`min`, `max`, `rank`, `level`, etc.) support dynamic math expressions.

## Requirement Types

| `type`                                     | Required Fields | Description                                                                                         |
| :----------------------------------------- | :-------------- | :-------------------------------------------------------------------------------------------------- |
| `"room"`                                   | `id` or `ids`   | The Byte must be in the specified room (`id`) or one of the rooms in the array (`ids`).             |
| `"stat"` / `"skill"` / `"need"` / `"pool"` | `key`           | Checks the Byte's attributes. You can provide `min`, `max`, `maxValueMin`, or `maxValueMax` bounds. |
| `"energy"`                                 | None            | Checks the Player's energy. Accepts `min` and `max` bounds.                                         |
| `"history"`                                | `key`           | Checks how many times an action/event has occurred. Accepts `min` and `max`.                        |
| `"inventory"`                              | `id`            | Checks the amount of a specific item the player owns. Accepts `min` and `max`.                      |
| `"achievement"`                            | `id`            | Checks if the player has unlocked a certain achievement tier. Accepts `rank`.                       |
| `"talent"`                                 | `id`            | Checks the player's invested talent level. Accepts `level`.                                         |
| `"hediff"`                                 | `id`            | Checks the stack count of a status effect on the Byte. Accepts `minStacks` and `maxStacks`.         |
| `"timePhase"`                              | `phases`        | An array of valid time phases. Valid phases: `"day"`, `"evening"`, `"night"`.                       |
| `"dayOfWeek"`                              | `days`          | An array of valid days (0-6, where 0 is Sunday).                                                    |

---

## Environment Context in Expressions

When writing math expressions inside `requirements`, you have access to the following dynamic context variables:

- `byte`: The active pet (e.g., `byte.level`, `byte.stats.logic.value`).
- `player`: The owner (e.g., `player.energy.value`, `player.inventory.basic_patch`).
- `timePhase`: The current time block (`"day"`, `"evening"`, `"night"`).
- `dayOfWeek`: The current day of the week (Integer 0-6).