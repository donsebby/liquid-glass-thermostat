# Thermostat Glass Card

Frosted-Glass Thermostat-Widget im Liquid-Glass-Stil für Home Assistant (`custom:thermostat-glass-card`).
Zeigt mehrere `climate`-Entities als Grid von Kacheln mit Plus/Minus-Steuerung und Power-Toggle.

**Status:** Bisher nur als Inline-Dashboard-Ressource in HA gepflegt, kein Git-Repo. Diese Datei
ist der Source-Stand vom 20.07.2026 (inkl. Fix: Icon-Farbe im Aus-Zustand jetzt theme-adaptiv über
`var(--primary-text-color)` statt hartcodiertem Grau).

## Installation

1. `thermostat-glass-card.js` als Lovelace-Ressource hinzufügen:
   - Settings → Dashboards → ⋮ → Resources → Add Resource
   - URL: z.B. `/local/thermostat-glass-card.js` (Datei nach `config/www/` kopieren)
   - Resource type: JavaScript Module

## Konfiguration

```yaml
type: custom:thermostat-glass-card
title: Thermostate
entities:
  - entity: climate.thermostat_wz
    name: Wohnzimmer
    icon_color: teal
  - climate.thermostat_bz
step: 0.5
```

| Option | Typ | Beschreibung |
|---|---|---|
| `entities` | list | Liste aus `climate`-Entity-IDs oder Objekten (`entity`, `name`, `icon_color`, `off_temperature`, `default_on_temperature`) |
| `step` | number | Schrittweite pro Plus/Minus-Tap (Default `0.5`) |
| `title` | string | Card-Titel |
| `show_title` | boolean | Titel ein-/ausblenden |
| `tile_shade` / `panel_shade` | number | Helligkeit der Kachel-/Kasten-Hintergründe (-100 bis 100) |

## License

MIT (analog zu den Schwester-Karten `liquid-glass-tile-card`, `liquid-lens-navbar-card`).
