[README.md](https://github.com/user-attachments/files/30187789/README.md)
# Thermostat Glass Card

A frosted-glass ("Liquid Glass") styled thermostat widget for Home Assistant
(`custom:thermostat-glass-card`). Displays multiple `climate` entities as a grid of tiles
with plus/minus stepper controls and a power toggle.

## Installation

### HACS (custom repository)

1. HACS → the "⋮" menu (top right) → **Custom repositories**.
2. Add this repository's URL, category **Dashboard**.
3. Install **Thermostat Glass Card**, then add the resource if HACS doesn't do it automatically:
   - Settings → Dashboards → Resources → **+ Add resource**
   - URL: `/hacsfiles/liquid-glass-thermostat/thermostat-glass-card.js`
   - Type: **JavaScript Module**

### Manual

1. Copy `thermostat-glass-card.js` into `<config>/www/`.
2. Settings → Dashboards → Resources → **+ Add resource**
   - URL: `/local/thermostat-glass-card.js`
   - Type: **JavaScript Module**

## Configuration

```yaml
type: custom:thermostat-glass-card
title: Thermostats
entities:
  - entity: climate.living_room
    name: Living Room
    icon_color: teal
  - climate.bathroom
step: 0.5
```

### Card-level options

| Option | Type | Default | Description |
|---|---|---|---|
| `entities` | list | — | **Required.** List of `climate` entity IDs, or objects (see below) |
| `step` | number | `0.5` | Step size per plus/minus tap |
| `title` | string | `"Thermostats"` | Card title |
| `show_title` | boolean | `true` | Show/hide the title |
| `bg_opacity` | number | `0.045` | Button background opacity |
| `blur` | number | `16` | Backdrop blur in px |
| `saturate` | number | `160` | Backdrop saturation % |
| `tile_shade` | number | `15` | Tile background brightness, -100 (darker) to 100 (lighter) |
| `panel_shade` | number | `6` | Panel background brightness, -100 (darker) to 100 (lighter) |

### Per-entity options (inside `entities`)

| Option | Type | Description |
|---|---|---|
| `entity` | string (required) | Climate entity ID |
| `name` | string | Overrides the friendly name |
| `icon_color` | string | Named color (e.g. `teal`, `deep-orange`) or hex, used for the active-state glow/tint |
| `off_temperature` | number | Temperature treated as "off" (defaults to the entity's `min_temp`) |
| `default_on_temperature` | number | Temperature to restore when turning back on (default `21`) |

## License

MIT.

## Credits

Built iteratively in conversation with Claude (Anthropic) against a real Home Assistant dashboard,
then cleaned up for public release.
