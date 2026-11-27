# Thermostat Glass Card

A frosted-glass ("Liquid Glass") styled thermostat widget for Home Assistant
(`custom:thermostat-glass-card`). Displays multiple `climate` entities as a grid of tiles
with plus/minus stepper controls and a power toggle.

![Thermostat Glass Card with valve opening, status line and power toggle](asset/thermostat-glass-card.png)

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
| `demand_threshold` | number | `10` | Valve opening (%) from which a tile counts as "heating" (badge and valve text light up) |
| `frame` | boolean | `true` | `false` removes the outer glass panel (background, border, blur, padding), so the tiles sit directly on the background behind – useful inside pop-ups |
| `glow` | boolean | `true` | `false` gives a calmer look: no tile drop shadow, active tiles get only a subtle tinted border instead of the glow, weaker icon glow |
| `look` | string | theme, else `glass` | `solid` switches to calm solid tiles without glass, blur or glows, see *Solid look*. `glass` forces the glass look. Without it the theme decides (`lg-look`), otherwise glass |

### Per-entity options (inside `entities`)

| Option | Type | Description |
|---|---|---|
| `entity` | string (required) | Climate entity ID |
| `name` | string | Overrides the friendly name |
| `icon_color` | string | Named color (e.g. `teal`, `deep-orange`) or hex, used for the active-state glow/tint |
| `off_temperature` | number | Temperature treated as "off" (defaults to the entity's `min_temp`) |
| `default_on_temperature` | number | Fallback when turning back on. The power button normally restores the last target this browser saw before switching off (default `21`) |
| `demand_entity` | string | Valve-opening sensor in %. Defaults to `sensor.<climate_object_id>_pi_heating_demand` (e.g. Danfoss Ally via Zigbee2MQTT); without one the tile just shows "Heating"/"Off" |
| `status_entity` | string | Optional status line under the tile (2 lines, tap to expand) |
| `reset_when` | string | Status text prefix that marks a manual override (default `Manuell` / `Manual` by HA language); highlighted and offers a reset chip |
| `reset_action` | object | Action for the reset chip, e.g. `{ action: script.resume_schedule, data: {...} }` |
| `reset_label` | string | Chip label (default `↺ Plan` / `↺ Schedule`) |
| `window_prefix` | string | Status text prefix shown in blue (default `Fenster` / `Window`) |

## Solid look

`look: solid` replaces the glass with quiet, solid surfaces — for dashboards whose page background already does the visual work:

- **Panel:** solid surface (`--surface`, default the theme's card colour at 88 %), thin 1 px edge, `--lg-radius` corners (default 20 px), no blur. `frame: false` still removes it.
- **Tiles:** solid inner surface (`--lg-tile-bg`), no shadows, no gradients and no glows (whatever `glow` says). A tile that is on is tinted with its `icon_color` (warm orange when none is set) and its icon sits in a round circle filled with that colour; off tiles stay neutral with a grey icon circle.
- **Buttons:** flat, fully round buttons without glass edges; the power icon takes the tile colour while the thermostat is on. Each button has a 44 px tall tap area; on very narrow tiles (small phones) the buttons get a little smaller so all four still fit.
- Larger text (names 15 px, details 13 px), tabular numbers for the target temperature.
- `tile_shade`, `panel_shade`, `blur`, `saturate` and `bg_opacity` have no effect in this look.
- `prefers-reduced-motion` is respected.

```yaml
type: custom:thermostat-glass-card
look: solid
entities:
  - entity: climate.living_room
    icon_color: teal
  - climate.bathroom
```

The visual editor offers it as *Stil: Glas / Solide*.

The look can also come from the theme for all Liquid Glass cards at once: set `lg-look: solid` in your Home Assistant theme (CSS variable `--lg-look`, `solid` or `glass`). `look:` on a card overrides it for that card, e.g. `look: glass` keeps one card glass on a solid theme. The card re-reads the variable when the theme or dark mode changes, or when the window event `lg-theme-changed` fires.

## Theme variables

Like the other Liquid Glass cards, this card reads optional CSS variables, so one theme can align all of them:

```yaml
# in your Home Assistant theme
lg-radius: 22px                          # corner radius of the glass panel
lg-backdrop: blur(22px) saturate(180%)   # blur/saturation behind the panel
lg-look: solid                           # solid look for all Liquid Glass cards (card `look:` wins)
```

Without them nothing changes. Options set on the card itself (e.g. `blur`) still win.

## Changelog

### 1.4.1
- Solid look: the panel reads its own variables (`--lg-panel-bg`, `--lg-panel-edge`, `--lg-panel-shadow`), so a theme can style panels inside pop-ups differently from cards on the page.

### 1.4.0
- Solid look: round buttons take edge and shadow from the theme too.
- Solid look: the panel takes its fill from `--lg-tile-bg` when the theme sets it (glass solid look).
- Solid look: the card's own panel takes edge, shadow and blur from the theme (`--lg-tile-edge`, `--lg-tile-shadow`, `--lg-panel-backdrop`).
- Solid look: inner surfaces take their edge and shadow from the theme (`--lg-tile-edge`, `--lg-tile-shadow`), so a glass theme can give them a light glass edge.

### 1.3.0
- The look can come from the theme: `lg-look: solid` (CSS variable `--lg-look`) switches the card to the solid look when it has no `look` of its own; `look: glass` / `look: solid` on the card overrides it. Re-checked on theme/dark-mode changes and on the `lg-theme-changed` window event.
- New option `look: solid`: calm solid tiles without glass, blur or glows; tiles that are on are tinted with their colour and get a filled icon circle, flat round buttons. Uses the optional design tokens `--surface` and `--lg-tile-bg` (see *Solid look*). Without the option the card looks exactly as before.

### 1.2.1
- Without a valve sensor the tile now shows the thermostat's own `hvac_action` as Home Assistant translates it (e.g. "Heizen", "Leerlauf") instead of always "Heating". Thermostats that report neither show a neutral "On"; the heat badge then stays dark instead of claiming the valve is open.

### 1.2.0
- New option `frame: false`: no outer panel, the tiles sit directly on the background (e.g. inside pop-ups).
- New option `glow: false`: calm look without drop shadows and glows; active tiles only get a subtle tinted border.
- The status line (`status_entity`) shows the state as formatted by Home Assistant, so translated states (e.g. of `enum`/`select` entities) appear in the user's language. `reset_when` and `window_prefix` keep matching the raw state.
- Numbers follow the Home Assistant locale (e.g. "22,5" in German) and the unit gets a space ("22,5 °C").

### 1.1.0
- Reads the optional theme variables `--lg-radius` and `--lg-backdrop` (see *Theme variables*).
- Valve opening per tile ("Valve 64 %"), from `demand_entity` or the Zigbee2MQTT `_pi_heating_demand` sensor; `demand_threshold` decides when a tile counts as heating.
- Optional status line (`status_entity`) with a reset chip for manual overrides (`reset_when`, `reset_action`, `reset_label`) and blue window hints (`window_prefix`).
- Power button restores the last target temperature instead of a fixed value.
- Texts follow the Home Assistant language (German/English).
- Fixed: `tile_shade` had no effect.
- Only re-renders when one of the card's own entities changes; names and texts are HTML-escaped.

## License

MIT.

## Credits

Built iteratively in conversation with Claude (Anthropic) against a real Home Assistant dashboard,
then cleaned up for public release.
