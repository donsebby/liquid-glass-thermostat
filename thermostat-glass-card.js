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
      ],
      computeLabel: (s) => {
        switch (s.name) {
          case "tile_shade": return "Tile brightness";
          case "panel_shade": return "Panel brightness";
        }
        return s.name;
      },
      computeHelper: (s) => {
        switch (s.name) {
          case "tile_shade": return "Negative = darker, positive = lighter (background of each individual thermostat tile)";
          case "panel_shade": return "Negative = darker, positive = lighter (background of the entire widget panel)";
        }
        return "";
      },
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return Math.ceil((this._config?.entities?.length || 1) / 2) * 2 + 1;
  }

  static _shadeCss(value, maxWhite, maxBlack) {
    const v = Number(value) || 0;
    if (v >= 0) return "rgba(255,255,255," + ((v / 100) * maxWhite).toFixed(3) + ")";
    return "rgba(20,20,24," + ((Math.abs(v) / 100) * maxBlack).toFixed(3) + ")";
  }

  static _icon(path, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '"><path d="' + path + '"/></svg>';
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
    const tileBg = ThermostatGlassCard._shadeCss(this._tileShade, 0.3, 0.5);
    const style = document.createElement("style");
    style.textContent = `
      :host { display:block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
      .wrap {
        padding:16px;
        border-radius:20px;
        background: ${panelBg};
        backdrop-filter: blur(${blur}px) saturate(${sat}%);
        -webkit-backdrop-filter: blur(${blur}px) saturate(${sat}%);
        border: 1px solid rgba(255,255,255,0.05);
      }
      .title { display:flex; align-items:center; gap:8px; color:var(--secondary-text-color, rgba(255,255,255,0.7)); font-size:14px; font-weight:600; margin-bottom:12px; }
      .title svg { fill:currentColor; opacity:0.85; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .tile {
        position:relative;
        background: color-mix(in srgb, var(--primary-text-color, #fff) 9%, transparent);
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
    `;
    this.shadowRoot.appendChild(style);
    this._root = document.createElement("div");
    this._root.className = "wrap";
    this.shadowRoot.appendChild(this._root);
  }

  _setTemp(entityId, temp) {
    this._hass.callService("climate", "set_temperature", { entity_id: entityId, temperature: temp });
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

  _render() {
    if (!this._hass || !this._config) return;
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
      const modeLabel = isOff ? "Off" : "Heating";
      const sub = current != null ? (modeLabel + " &middot; " + current + "&deg;C") : modeLabel;
      const tintRgb = ThermostatGlassCard._colorRgb(iconColor);
      return { entityId, name, sub, target, isOff, tintRgb, offTemp, fallbackOn };
    });

    const showTitle = this._config.show_title !== false;
    this._root.innerHTML = `
      ${showTitle ? `<div class="title">${ThermostatGlassCard._icon(ICON_THERMO, 16)}<span>${this._config.title || "Thermostats"}</span></div>` : ""}
      <div class="grid">
        ${items.map((it, i) => it.missing ? `
          <div class="tile"><div class="sub">Entity not found: ${it.entityId}</div></div>
        ` : `
          <div class="tile ${!it.isOff ? "active" : ""}" data-i="${i}" style="${it.tintRgb && !it.isOff ? ("--tile-tint-rgb:" + it.tintRgb + ";--tile-tint:rgb(" + it.tintRgb + ");") : ""}">
            <div class="row">
              <div class="icon-wrap">
                <div class="icon-glow ${it.isOff ? "off" : ""}"></div>
                <div class="icon-glass ${it.isOff ? "off" : ""}">${ThermostatGlassCard._icon(ICON_THERMO, 16)}</div>
                <div class="badge ${it.isOff ? "" : "heat"}">${ThermostatGlassCard._icon(ICON_POWER, 8)}</div>
              </div>
              <div>
                <div class="name">${it.name}</div>
                <div class="sub">${it.sub}</div>
              </div>
            </div>
            <div class="controls">
              <div class="btn minus">${ThermostatGlassCard._icon(ICON_MINUS, 12)}</div>
              <div class="temp">${it.target.toFixed(1)}</div>
              <div class="btn plus">${ThermostatGlassCard._icon(ICON_PLUS, 12)}</div>
              <div class="btn power ${it.isOff ? "" : "active"}">${ThermostatGlassCard._icon(ICON_POWER, 13)}</div>
            </div>
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
      tile.addEventListener("click", () => this._moreInfo(it.entityId));
    });
  }
}

customElements.define("thermostat-glass-card", ThermostatGlassCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "thermostat-glass-card",
  name: "Thermostat Glass Card",
  description: "Frosted-glass thermostat widget in the Liquid Glass style.",
});
