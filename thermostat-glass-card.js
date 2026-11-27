const CARD_VERSION = "1.3.0";
// eslint-disable-next-line no-console
console.info(`%c THERMOSTAT-GLASS-CARD %c v${CARD_VERSION} `, "color: white; background: #e2835a; font-weight: 700;", "color: #e2835a; background: white; font-weight: 700;");

const TGC_TEXT = {
  de: { title: "Thermostate", off: "Aus", heating: "Heizt", on: "An", valveClosed: "Ventil zu", valve: "Ventil", notFound: "Entität nicht gefunden: ", manual: "Manuell", window: "Fenster", reset: "↺ Plan" },
  en: { title: "Thermostats", off: "Off", heating: "Heating", on: "On", valveClosed: "Valve closed", valve: "Valve", notFound: "Entity not found: ", manual: "Manual", window: "Window", reset: "↺ Schedule" },
};

class ThermostatGlassCard extends HTMLElement {
  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error("Please provide 'entities' as a list of climate entity IDs.");
    }
    this._config = config;
    this._step = config.step ?? 0.5;
    this._bgOpacity = config.bg_opacity ?? 0.045;
    this._blur = config.blur ?? 16;
    this._saturate = config.saturate ?? 160;
    this._tileShade = config.tile_shade ?? 15;
    this._panelShade = config.panel_shade ?? 6;
    this._demandThreshold = config.demand_threshold ?? 10;
    this._expanded = this._expanded || new Set();
    this._lastStates = null;
    // No `look` in the config: the theme decides (--lg-look). Re-read it
    // here too (setConfig is rare), so removing an override in the editor
    // picks up the theme's current look right away.
    if (!this._lookOverride() && this.isConnected) this._themeLook = ThermostatGlassCard._readThemeLook(this);
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = "";
    this._buildStyles();
    if (this._hass) this._render();
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "tile_shade", selector: { number: { min: -100, max: 100, step: 5, mode: "slider", unit_of_measurement: "%" } } },
        { name: "panel_shade", selector: { number: { min: -100, max: 100, step: 5, mode: "slider", unit_of_measurement: "%" } } },
        { name: "look", selector: { select: { mode: "dropdown", options: [{ value: "glass", label: "Glas" }, { value: "solid", label: "Solide" }] } } },
      ],
      computeLabel: (s) => {
        switch (s.name) {
          case "tile_shade": return "Tile brightness";
          case "panel_shade": return "Panel brightness";
          case "look": return "Stil";
        }
        return s.name;
      },
      computeHelper: (s) => {
        switch (s.name) {
          case "tile_shade": return "Negative = darker, positive = lighter (background of each individual thermostat tile)";
          case "panel_shade": return "Negative = darker, positive = lighter (background of the entire widget panel)";
          case "look": return "Empty = from the theme (lg-look), otherwise glass. Solide: calm solid tiles without glass, blur or glows (brightness sliders have no effect)";
        }
        return "";
      },
    };
  }

  // Every entity this card reads: the climate entities plus their optional
  // valve-demand and status sensors.
  _watchedIds() {
    const ids = [];
    for (const item of this._config.entities) {
      const entityId = typeof item === "string" ? item : item.entity;
      ids.push(entityId, this._demandId(item, entityId));
      if (typeof item !== "string" && item.status_entity) ids.push(item.status_entity);
    }
    return ids;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    // Theme switch (new themes object, other theme or dark mode): the
    // theme's --lg-look may have changed. Only then - never per tick.
    const th = hass && hass.themes;
    if (th !== this._themesRef || th?.theme !== this._themeName || th?.darkMode !== this._darkMode) {
      this._themesRef = th;
      this._themeName = th?.theme;
      this._darkMode = th?.darkMode;
      this._recheckThemeLook();
    }
    // HA calls this on every state change anywhere; rebuilding the tiles
    // (and their listeners) only makes sense when one of ours changed.
    const ids = this._watchedIds();
    const changed = !this._lastStates || ids.some((id, i) => hass.states[id] !== this._lastStates[i]);
    if (!changed) return;
    this._lastStates = ids.map((id) => hass.states[id]);
    this._render();
  }

  // ---- look from the theme ---------------------------------------------
  // `look: solid | glass` in the card config wins. Without it the theme
  // decides for all Liquid Glass cards at once through the CSS variable
  // --lg-look (theme YAML: `lg-look: solid`); without that it's glass.
  // Read on connect (plus one frame later), on a hass.themes change and on
  // the window event `lg-theme-changed` - never on every hass tick.
  connectedCallback() {
    if (!this._onThemeChanged) this._onThemeChanged = () => this._checkThemeLook();
    window.addEventListener("lg-theme-changed", this._onThemeChanged);
    this._recheckThemeLook();
  }

  disconnectedCallback() {
    if (this._onThemeChanged) window.removeEventListener("lg-theme-changed", this._onThemeChanged);
    if (this._lookRaf) cancelAnimationFrame(this._lookRaf);
    this._lookRaf = null;
  }

  static _readThemeLook(el) {
    try {
      const v = getComputedStyle(el).getPropertyValue("--lg-look")
        .trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
      return v === "solid" || v === "glass" ? v : null;
    } catch (e) {
      return null;
    }
  }

  _lookOverride() {
    const look = this._config && this._config.look;
    return look === "solid" || look === "glass" ? look : null;
  }

  _isSolid() {
    return (this._lookOverride() || this._themeLook || "glass") === "solid";
  }

  _recheckThemeLook() {
    this._checkThemeLook();
    if (typeof requestAnimationFrame !== "function" || this._lookRaf) return;
    this._lookRaf = requestAnimationFrame(() => {
      this._lookRaf = null;
      this._checkThemeLook();
    });
  }

  _checkThemeLook() {
    if (!this._config || this._lookOverride() || !this.isConnected) return;
    const look = ThermostatGlassCard._readThemeLook(this);
    if (look === this._themeLook) return;
    this._themeLook = look;
    // Only CSS depends on the look here, so the class is enough.
    if (this._root) this._root.classList.toggle("solid", this._isSolid());
  }

  getCardSize() {
    return Math.ceil((this._config?.entities?.length || 1) / 2) * 2 + 1;
  }

  _t(key) {
    const lang = String((this._hass && ((this._hass.locale && this._hass.locale.language) || this._hass.language)) || "en");
    return (lang.startsWith("de") ? TGC_TEXT.de : TGC_TEXT.en)[key];
  }

  static _shadeCss(value, maxWhite, maxBlack) {
    const v = Number(value) || 0;
    if (v >= 0) return "rgba(255,255,255," + ((v / 100) * maxWhite).toFixed(3) + ")";
    return "rgba(20,20,24," + ((Math.abs(v) / 100) * maxBlack).toFixed(3) + ")";
  }

  static _icon(path, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '"><path d="' + path + '"/></svg>';
  }

  static _esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  static _colorRgb(name) {
    const MAP = {
      "deep-orange": "226,131,90",
      "orange": "230,150,90",
      "teal": "77,182,172",
      "indigo": "124,137,209",
      "cyan": "79,195,217",
      "pink": "225,127,166",
      "green": "124,180,124",
      "red": "224,110,110",
      "blue": "100,150,220",
      "purple": "170,130,210",
      "amber": "224,180,100",
      "yellow": "220,200,110",
      "brown": "168,138,118",
      "grey": "158,164,172",
      "gray": "158,164,172"
    };
    if (!name) return null;
    if (MAP[name]) return MAP[name];
    const m = String(name).trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (m) {
      const hex = m[1];
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return r + "," + g + "," + b;
    }
    return null;
  }

  _buildStyles() {
    const blur = this._blur;
    const sat = this._saturate;
    const bg = this._bgOpacity;
    const panelBg = ThermostatGlassCard._shadeCss(this._panelShade, 0.3, 0.5);
    // tile_shade only overrides the tile background when set explicitly, so
    // the default look (a tint of the theme's text color) stays unchanged.
    const tileBg = this._config.tile_shade != null
      ? ThermostatGlassCard._shadeCss(this._tileShade, 0.3, 0.5)
      : "color-mix(in srgb, var(--primary-text-color, #fff) 9%, transparent)";
    // Card options win; otherwise a theme can set --lg-backdrop for all glass cards.
    const ownBackdrop = `blur(${blur}px) saturate(${sat}%)`;
    const backdrop = this._config.blur != null || this._config.saturate != null ? ownBackdrop : `var(--lg-backdrop, ${ownBackdrop})`;
    const style = document.createElement("style");
    style.textContent = `
      :host { display:block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
      .wrap {
        padding:16px;
        border-radius:var(--lg-radius, 20px);
        background: ${panelBg};
        backdrop-filter: ${backdrop};
        -webkit-backdrop-filter: ${backdrop};
        border: 1px solid rgba(255,255,255,0.05);
      }
      /* frame: false - no panel, tiles sit directly on the background (e.g. in pop-ups) */
      .wrap.frameless {
        padding:0;
        border-radius:0;
        background:none;
        backdrop-filter:none;
        -webkit-backdrop-filter:none;
        border:none;
        box-shadow:none;
      }
      .title { display:flex; align-items:center; gap:8px; color:var(--secondary-text-color, rgba(255,255,255,0.7)); font-size:14px; font-weight:600; margin-bottom:12px; }
      .title svg { fill:currentColor; opacity:0.85; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .tile {
        position:relative;
        background: ${tileBg};
        border-radius:16px;
        padding:10px;
        min-width:0;
        border: 1px solid color-mix(in srgb, var(--primary-text-color, #fff) 14%, transparent);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 16px -8px rgba(0,0,0,0.4);
      }
      .tile.active {
        border: 1px solid rgba(var(--tile-tint-rgb, 154,163,173),0.7);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 0 4px rgba(var(--tile-tint-rgb, 154,163,173),0.6), 0 0 26px rgba(var(--tile-tint-rgb, 154,163,173),0.55), 0 0 46px rgba(var(--tile-tint-rgb, 154,163,173),0.3);
      }
      .row { display:flex; gap:8px; align-items:center; margin-bottom:10px; min-width:0; }
      .row > div:last-child { min-width:0; overflow:hidden; }
      .icon-wrap { position:relative; width:36px; height:36px; flex:0 0 auto; }
      .icon-glow { position:absolute; inset:-8px; border-radius:50%; background:radial-gradient(circle, rgba(var(--tile-tint-rgb, 154,163,173),0.65), transparent 70%); filter:blur(7px); }
      .icon-glow.off { background:radial-gradient(circle, rgba(140,150,160,0.3), transparent 70%); }
      /* glow: false - calm look without drop shadow and outer glows */
      .wrap.calm .tile { box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }
      .wrap.calm .tile.active {
        border: 1px solid rgba(var(--tile-tint-rgb, 154,163,173),0.35);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
      }
      .wrap.calm .icon-glow { opacity:0.45; }
      .icon-glass {
        position:relative; width:36px; height:36px; border-radius:50%;
        background: linear-gradient(155deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0.4) 100%);
        border:1px solid color-mix(in srgb, var(--primary-text-color, #fff) 26%, rgba(255,255,255,0.5));
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.28), inset 2px 0 4px rgba(80,200,255,0.28), inset -2px 0 4px rgba(255,90,190,0.25);
        display:flex; align-items:center; justify-content:center;
      }
      .icon-glass svg { fill: var(--tile-tint, #9aa3ad); width:16px; height:16px; }
      .icon-glass.off svg { fill: var(--primary-text-color, #9aa3ad); }
      .badge {
        position:absolute; top:-3px; right:-3px; width:14px; height:14px; border-radius:50%;
        background: rgba(20,20,24,0.55);
        border:1px solid rgba(255,255,255,0.14);
        display:flex; align-items:center; justify-content:center;
      }
      .badge svg { fill:rgba(255,255,255,0.65); width:8px; height:8px; }
      .badge.heat svg { fill: var(--tile-tint, #9aa3ad); }
      .name { color:var(--primary-text-color, #fff); font-size:12.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .sub { color:var(--secondary-text-color, rgba(255,255,255,0.5)); font-size:10.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .sub .valve-open { color: var(--tile-tint, var(--primary-text-color, #fff)); font-weight:600; }
      .controls { display:flex; align-items:center; justify-content:space-between; gap:2px; }
      .btn {
        width:26px; height:26px; border-radius:50%; flex:0 0 auto;
        background: rgba(255,255,255,${bg * 1.3});
        border:1px solid rgba(255,255,255,0.06);
        color:var(--primary-text-color, #fff);
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; user-select:none;
        backdrop-filter: saturate(180%) brightness(1.15); -webkit-backdrop-filter: saturate(180%) brightness(1.15);
        box-shadow: inset 1px 0 3px rgba(80,200,255,0.26), inset -1px 0 3px rgba(255,90,190,0.24);
      }
      .btn svg { fill:currentColor; }
      .btn:active { background: rgba(255,255,255,${bg * 2.2}); }
      .btn.power.active svg { fill: var(--tile-tint, #9aa3ad); }
      .temp { color:var(--primary-text-color, #fff); font-size:14px; font-weight:600; }
      .status {
        margin-top:8px; padding-top:7px;
        border-top:1px solid color-mix(in srgb, var(--primary-text-color, #fff) 10%, transparent);
        display:flex; align-items:center; justify-content:space-between; gap:6px;
        color:var(--secondary-text-color, rgba(255,255,255,0.55));
        font-size:10.5px; line-height:1.3;
      }
      .status .txt { min-width:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; cursor:pointer; -webkit-tap-highlight-color:transparent; }
      .status.expanded { align-items:flex-start; }
      .status.expanded .txt { display:block; -webkit-line-clamp:unset; overflow:visible; }
      .status.manual .txt { color: var(--tile-tint, var(--primary-text-color, #fff)); font-weight:600; }
      .status.window .txt { color: rgb(100,170,230); font-weight:600; }
      .status .reset {
        flex:0 0 auto; padding:3px 9px; border-radius:11px; cursor:pointer; user-select:none;
        font-weight:600; font-size:10.5px; color:var(--primary-text-color, #fff);
        background: rgba(255,255,255,${bg * 2.2});
        border:1px solid rgba(255,255,255,0.12);
        box-shadow: inset 1px 0 3px rgba(80,200,255,0.26), inset -1px 0 3px rgba(255,90,190,0.24);
      }
      .status .reset:active { background: rgba(255,255,255,${bg * 3.5}); }
      /* look: solid - calm solid surfaces instead of glass: no blur, no
         gradients, no cyan/pink inner edges, no glows (whatever glow says).
         Off tiles stay neutral; an on tile is tinted with its colour and
         its icon circle is filled with it. --c is the tile's icon_color,
         or a warm orange when none is set. Only applies with .solid, the
         glass rules above stay untouched. */
      .wrap.solid { --tgc-ink: var(--primary-text-color, #fff);
        --tgc-tile: var(--lg-tile-bg, color-mix(in srgb, var(--tgc-ink) 8%, transparent)); }
      .wrap.solid:not(.frameless) {
        padding:16px; border-radius:var(--lg-radius, 20px);
        background: var(--lg-tile-bg, var(--surface, color-mix(in srgb, var(--card-background-color, #1c1f28) 88%, transparent)));
        backdrop-filter: var(--lg-panel-backdrop, none); -webkit-backdrop-filter: var(--lg-panel-backdrop, none);
        border: var(--lg-tile-edge, 1px solid rgba(255,255,255,0.06)); box-shadow: var(--lg-tile-shadow, none);
      }
      .wrap.solid .title { font-size:15px; font-weight:600; }
      .wrap.solid .title svg { opacity:1; }
      .wrap.solid .tile {
        --c: var(--tile-tint, #e2835a);
        background: var(--tgc-tile);
        border:var(--lg-tile-edge, 1px solid rgba(255,255,255,0.04)); border-radius:calc(var(--lg-radius, 20px) - 4px);
        padding:12px 10px; box-shadow:var(--lg-tile-shadow, none); transition: background .2s ease;
      }
      .wrap.solid .tile.active { border:var(--lg-tile-edge, 1px solid rgba(255,255,255,0.04)); box-shadow:var(--lg-tile-shadow, none);
        background: color-mix(in srgb, var(--c) 20%, var(--tgc-tile)); }
      .wrap.solid .row { gap:10px; }
      .wrap.solid .icon-glow { display:none; }
      .wrap.solid .icon-glass { border:none; box-shadow:none; background: var(--c); transition: background .2s ease; }
      .wrap.solid .icon-glass svg { fill:#16181d; width:20px; height:20px; }
      .wrap.solid .icon-glass.off { background: color-mix(in srgb, var(--tgc-ink) 10%, transparent); }
      .wrap.solid .icon-glass.off svg { fill: var(--secondary-text-color, rgba(255,255,255,0.6)); }
      .wrap.solid .badge { background: var(--surface, #1c1f28); border:1px solid rgba(255,255,255,0.06); }
      .wrap.solid .badge svg { fill: var(--secondary-text-color, rgba(255,255,255,0.6)); }
      .wrap.solid .badge.heat svg { fill: var(--c); }
      .wrap.solid .name { font-size:15px; font-weight:600; }
      .wrap.solid .sub { font-size:13px; }
      .wrap.solid .sub .valve-open { color: color-mix(in srgb, var(--c) 55%, var(--tgc-ink)); }
      .wrap.solid .controls { margin-top:2px; container-type:inline-size; }
      .wrap.solid .btn {
        position:relative; width:32px; height:32px; border-radius:999px;
        background: color-mix(in srgb, var(--tgc-ink) 14%, transparent); box-sizing:border-box;
        border:var(--lg-tile-edge, none); box-shadow:var(--lg-tile-shadow, none); backdrop-filter:none; -webkit-backdrop-filter:none;
        transition: background .15s ease;
      }
      /* invisible hit area: 44px tall without touching the neighbours */
      .wrap.solid .btn::after { content:""; position:absolute; inset:-6px 0; }
      .wrap.solid .btn:active { background: color-mix(in srgb, var(--tgc-ink) 24%, transparent); }
      .wrap.solid .btn svg { width:16px; height:16px; }
      .wrap.solid .btn.power.active svg { fill: var(--c); }
      .wrap.solid .temp { font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; }
      .wrap.solid .status { font-size:13px; border-top-color: color-mix(in srgb, var(--tgc-ink) 8%, transparent); }
      .wrap.solid .status.manual .txt { color: color-mix(in srgb, var(--c) 55%, var(--tgc-ink)); }
      .wrap.solid .status .reset {
        position:relative; padding:4px 10px; border-radius:999px; font-size:13px; font-weight:500;
        background: color-mix(in srgb, var(--tgc-ink) 14%, transparent);
        border:none; box-shadow:none; transition: background .15s ease;
      }
      .wrap.solid .status .reset::after { content:""; position:absolute; inset:-10px 0; }
      .wrap.solid .status .reset:active { background: color-mix(in srgb, var(--tgc-ink) 24%, transparent); }
      /* narrow tiles (small phones): smaller buttons, same 44px tap height */
      @container (max-width: 136px) {
        .wrap.solid .btn { width:28px; height:28px; }
        .wrap.solid .btn::after { inset:-8px 0; }
      }
      @container (max-width: 124px) {
        .wrap.solid .btn { width:26px; height:26px; }
        .wrap.solid .btn::after { inset:-9px 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .wrap.solid .tile, .wrap.solid .icon-glass, .wrap.solid .btn, .wrap.solid .status .reset { transition:none; }
      }
    `;
    this.shadowRoot.appendChild(style);
    this._root = document.createElement("div");
    this._root.className = "wrap"
      + (this._config.frame === false ? " frameless" : "")
      + (this._config.glow === false ? " calm" : "")
      // look: solid is opt-in (config `look`, else the theme's --lg-look);
      // anything else keeps the glass look untouched.
      + (this._isSolid() ? " solid" : "");
    this.shadowRoot.appendChild(this._root);
  }

  _setTemp(entityId, temp) {
    this._hass.callService("climate", "set_temperature", { entity_id: entityId, temperature: temp });
  }

  _callAction(cfg) {
    if (!cfg || !cfg.action) return;
    const parts = String(cfg.action).split(".");
    if (parts.length !== 2) return;
    this._hass.callService(parts[0], parts[1], cfg.data || {});
  }

  static _lastTempKey(entityId) {
    return "thermostat-glass-card:last-temp:" + entityId;
  }

  static _saveLastTemp(entityId, temp) {
    try { window.localStorage.setItem(ThermostatGlassCard._lastTempKey(entityId), String(temp)); } catch (e) {}
  }

  static _loadLastTemp(entityId) {
    try {
      const v = window.localStorage.getItem(ThermostatGlassCard._lastTempKey(entityId));
      const n = v != null ? parseFloat(v) : NaN;
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  // Power button: "off" = setting the off temperature. Turning back on
  // restores the last target this browser saw before switching off.
  _togglePower(entityId, target, offTemp, fallbackOn) {
    const isOff = target <= offTemp + 0.01;
    if (isOff) {
      const restore = ThermostatGlassCard._loadLastTemp(entityId);
      this._setTemp(entityId, (restore != null && restore > offTemp) ? restore : fallbackOn);
    } else {
      ThermostatGlassCard._saveLastTemp(entityId, target);
      this._setTemp(entityId, offTemp);
    }
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId: entityId },
      bubbles: true,
      composed: true,
    }));
  }

  // Valve opening sensor: item.demand_entity if configured, otherwise
  // sensor.<climate_object_id>_pi_heating_demand (e.g. Danfoss Ally via
  // Zigbee2MQTT). If the entity doesn't exist the valve display is skipped.
  _demandId(item, entityId) {
    const cfg = typeof item === "string" ? null : item.demand_entity;
    return cfg || ("sensor." + entityId.split(".")[1] + "_pi_heating_demand");
  }

  // hvac_action as Home Assistant translates it ("Heizen", "Leerlauf" ...).
  _actionText(stateObj) {
    const a = stateObj.attributes.hvac_action;
    if (this._hass && typeof this._hass.formatEntityAttributeValue === "function") {
      try {
        const t = this._hass.formatEntityAttributeValue(stateObj, "hvac_action");
        if (t) return String(t);
      } catch (e) { /* fall through */ }
    }
    return a === "heating" ? this._t("heating") : a === "off" ? this._t("off") : String(a);
  }

  _num(value, fixed) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const lang = this._hass?.locale?.language || this._hass?.language || "de";
    const opts = fixed != null ? { minimumFractionDigits: fixed, maximumFractionDigits: fixed } : { maximumFractionDigits: 1 };
    try { return n.toLocaleString(lang, opts); } catch (e) { return fixed != null ? n.toFixed(fixed) : String(n); }
  }

  _demand(item, entityId) {
    const st = this._hass.states[this._demandId(item, entityId)];
    return st ? parseFloat(st.state) : NaN;
  }

  // Optional status line per entity (status_entity). Text starting with
  // reset_when (default "Manuell"/"Manual") shows the reset chip, which runs
  // reset_action; text starting with window_prefix ("Fenster"/"Window") is
  // shown in blue. Tapping the text toggles between 2 lines and full text.
  _status(item) {
    if (typeof item === "string" || !item.status_entity) return null;
    const st = this._hass.states[item.status_entity];
    if (!st || st.state === "unavailable" || st.state === "unknown") return null;
    const raw = st.state;
    // Shown in HA's language (enum/select states get translated); prefixes
    // still match the raw state, so existing reset_when/window_prefix work.
    const text = this._formatState(st);
    const starts = (prefix) => raw.startsWith(prefix) || text.startsWith(prefix);
    const resetWhen = item.reset_when ?? this._t("manual");
    const windowPrefix = item.window_prefix ?? this._t("window");
    const canReset = !!item.reset_action && starts(resetWhen);
    let cls = "";
    if (starts(resetWhen)) cls = "manual";
    else if (starts(windowPrefix)) cls = "window";
    return { text, cls, canReset, resetAction: item.reset_action, resetLabel: item.reset_label ?? this._t("reset") };
  }

  // Localized entity state via HA's formatter (2023.9+), raw state as fallback.
  _formatState(stateObj) {
    if (typeof this._hass.formatEntityState === "function") {
      try {
        const s = this._hass.formatEntityState(stateObj);
        if (s != null && s !== "") return String(s);
      } catch (e) {}
    }
    return stateObj.state;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const esc = ThermostatGlassCard._esc;
    const step = this._step;
    const ICON_THERMO = "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 1,0 15,13M12,4A1,1 0 0,1 13,5V13.5L13.5,13.83A3,3 0 1,1 10.5,13.83L11,13.5V5A1,1 0 0,1 12,4Z";
    const ICON_MINUS = "M19,13H5V11H19V13Z";
    const ICON_PLUS = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";
    const ICON_POWER = "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13V3Z";
    const items = this._config.entities.map((item) => {
      const entityId = typeof item === "string" ? item : item.entity;
      const label = typeof item === "string" ? null : item.name;
      const iconColor = typeof item === "string" ? null : item.icon_color;
      const offTempCfg = typeof item === "string" ? null : item.off_temperature;
      const fallbackOnCfg = typeof item === "string" ? null : item.default_on_temperature;
      const state = this._hass.states[entityId];
      if (!state) return { entityId, missing: true };
      const name = label || state.attributes.friendly_name || entityId;
      const current = state.attributes.current_temperature;
      const target = state.attributes.temperature ?? 0;
      const minTemp = state.attributes.min_temp ?? 5;
      const offTemp = Math.max(minTemp, offTempCfg ?? 5);
      const fallbackOn = fallbackOnCfg ?? 21;
      const isOff = target <= offTemp + 0.01;
      const demand = this._demand(item, entityId);
      const hasDemand = Number.isFinite(demand);
      const action = state.attributes.hvac_action;
      const valveOpen = !isOff && (hasDemand ? demand >= this._demandThreshold : action === "heating");
      let modeLabel;
      if (isOff) modeLabel = esc(this._t("off"));
      else if (!hasDemand && action) modeLabel = esc(this._actionText(state));
      else if (!hasDemand) modeLabel = esc(this._t("on"));
      else if (demand <= 0) modeLabel = esc(this._t("valveClosed"));
      else modeLabel = '<span class="' + (valveOpen ? "valve-open" : "") + '">' + esc(this._t("valve")) + " " + Math.round(demand) + " %</span>";
      const sub = current != null ? (modeLabel + " &middot; " + esc(this._num(current)) + "&nbsp;&deg;C") : modeLabel;
      const tintRgb = ThermostatGlassCard._colorRgb(iconColor);
      const status = this._status(item);
      return { entityId, name, sub, target, isOff, valveOpen, tintRgb, offTemp, fallbackOn, status };
    });

    const showTitle = this._config.show_title !== false;
    this._root.innerHTML = `
      ${showTitle ? `<div class="title">${ThermostatGlassCard._icon(ICON_THERMO, 16)}<span>${esc(this._config.title || this._t("title"))}</span></div>` : ""}
      <div class="grid">
        ${items.map((it, i) => it.missing ? `
          <div class="tile"><div class="sub">${esc(this._t("notFound") + it.entityId)}</div></div>
        ` : `
          <div class="tile ${!it.isOff ? "active" : ""}" data-i="${i}" style="${it.tintRgb && !it.isOff ? ("--tile-tint-rgb:" + it.tintRgb + ";--tile-tint:rgb(" + it.tintRgb + ");") : ""}">
            <div class="row">
              <div class="icon-wrap">
                <div class="icon-glow ${it.isOff ? "off" : ""}"></div>
                <div class="icon-glass ${it.isOff ? "off" : ""}">${ThermostatGlassCard._icon(ICON_THERMO, 16)}</div>
                <div class="badge ${it.valveOpen ? "heat" : ""}">${ThermostatGlassCard._icon(ICON_POWER, 8)}</div>
              </div>
              <div>
                <div class="name">${esc(it.name)}</div>
                <div class="sub">${it.sub}</div>
              </div>
            </div>
            <div class="controls">
              <div class="btn minus">${ThermostatGlassCard._icon(ICON_MINUS, 12)}</div>
              <div class="temp">${esc(this._num(it.target, 1))}</div>
              <div class="btn plus">${ThermostatGlassCard._icon(ICON_PLUS, 12)}</div>
              <div class="btn power ${it.isOff ? "" : "active"}">${ThermostatGlassCard._icon(ICON_POWER, 13)}</div>
            </div>
            ${it.status ? `
              <div class="status ${it.status.cls} ${this._expanded.has(it.entityId) ? "expanded" : ""}">
                <span class="txt" title="${esc(it.status.text)}">${esc(it.status.text)}</span>
                ${it.status.canReset ? `<span class="reset">${esc(it.status.resetLabel)}</span>` : ""}
              </div>
            ` : ""}
          </div>
        `).join("")}
      </div>
    `;

    this._root.querySelectorAll(".tile[data-i]").forEach((tile) => {
      const i = parseInt(tile.dataset.i, 10);
      const it = items[i];
      tile.querySelector(".minus").addEventListener("click", (ev) => { ev.stopPropagation(); this._setTemp(it.entityId, it.target - step); });
      tile.querySelector(".plus").addEventListener("click", (ev) => { ev.stopPropagation(); this._setTemp(it.entityId, it.target + step); });
      tile.querySelector(".power").addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._togglePower(it.entityId, it.target, it.offTemp, it.fallbackOn);
      });
      const txt = tile.querySelector(".status .txt");
      if (txt) txt.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (this._expanded.has(it.entityId)) this._expanded.delete(it.entityId);
        else this._expanded.add(it.entityId);
        this._render();
      });
      const reset = tile.querySelector(".reset");
      if (reset) reset.addEventListener("click", (ev) => { ev.stopPropagation(); this._callAction(it.status.resetAction); });
      tile.addEventListener("click", () => this._moreInfo(it.entityId));
    });
  }
}

customElements.define("thermostat-glass-card", ThermostatGlassCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "thermostat-glass-card",
  name: "Thermostat Glass Card",
  description: "Frosted-glass thermostat widget in the Liquid Glass style, with valve opening, status line and power toggle.",
});
