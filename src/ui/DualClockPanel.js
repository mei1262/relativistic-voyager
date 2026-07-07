import { computeRelativityState } from '../physics/relativity.js';

/**
 * DualClockPanel — DOM-driven dual-clock display for time-dilation
 * visualization (CHANGE.md §2.2 T1 + §2.3 T2).
 *
 * Shows Earth clock and Ship clock side-by-side with a time-difference
 * bar chart so users can perceive the growing gap between coordinate
 * time and proper time as beta increases.
 *
 * Inserts content into the existing #hud-panel, below the <dl> grid.
 */
export class DualClockPanel {
  /**
   * @param {object} state — shared mutable application state
   * @param {object} [opts]
   * @param {string} [opts.container='#hud-panel'] — CSS selector for the host panel
   */
  constructor(state, opts = {}) {
    this.state = state;
    this.containerSel = opts.container || '#hud-panel';
    this._prevEarth = 0;
    this._prevShip = 0;
  }

  // -- Initialisation -----------------------------------------------------------

  init() {
    const panel = document.querySelector(this.containerSel);
    if (!panel) return;

    // Build clock DOM subtree
    const root = document.createElement('div');
    root.id = 'dual-clock';
    root.innerHTML = `
      <div class="clock-row">
        <div class="clock-box earth-clock">
          <span class="clock-label">🌍 地球钟 Earth</span>
          <span class="clock-value" id="earth-clock-val">0.00 yr</span>
        </div>
        <div class="clock-box ship-clock">
          <span class="clock-label">🚀 飞船钟 Ship</span>
          <span class="clock-value" id="ship-clock-val">0.00 yr</span>
        </div>
      </div>
      <div class="time-bar-container">
        <div class="time-bar-track">
          <div class="time-bar-fill earth-fill" id="bar-earth-fill"></div>
          <div class="time-bar-fill ship-fill" id="bar-ship-fill"></div>
        </div>
        <span class="bar-hint">「地球多过的岁月」<span id="time-gap-val">0.00 yr</span></span>
      </div>
    `;

    panel.appendChild(root);

    this.el = {
      earthVal:    root.querySelector('#earth-clock-val'),
      shipVal:     root.querySelector('#ship-clock-val'),
      barEarth:    root.querySelector('#bar-earth-fill'),
      barShip:     root.querySelector('#bar-ship-fill'),
      gapVal:      root.querySelector('#time-gap-val')
    };
  }

  // -- Per-frame update ---------------------------------------------------------

  /**
   * @param {object} r — result from computeRelativityState(state)
   */
  update(r) {
    if (!this.el) return;

    // Smooth interpolation for the clock digits (reduce jitter at low dt)
    const alpha = 0.18;
    this._prevEarth += (r.earthTime - this._prevEarth) * alpha;
    this._prevShip  += (r.shipTime  - this._prevShip)  * alpha;

    // Clock digits
    this.el.earthVal.textContent = this._prevEarth.toFixed(2) + ' yr';
    this.el.shipVal.textContent  = this._prevShip.toFixed(2)  + ' yr';

    // Colour shifts — earth clock gets warmer as gap grows,
    // ship clock gets cooler (emphasising "slower time" feel)
    const gap = Math.max(0, this._prevEarth - this._prevShip);
    const gapRatio = this._prevEarth > 0.01
      ? Math.min(1, gap / this._prevEarth)
      : 0;

    const warm = Math.floor(180 + gapRatio * 75);
    this.el.earthVal.style.color = `rgb(255, ${warm - 40}, ${warm - 80})`;

    const cool = Math.floor(180 - gapRatio * 80);
    this.el.shipVal.style.color = `rgb(${cool - 20}, ${cool + 20}, 255)`;

    // ---- Bar chart — visual comparison of elapsed times -----------------------
    const maxTime = Math.max(this._prevEarth, this._prevShip, 0.001);
    const earthPct = (this._prevEarth / maxTime) * 100;
    const shipPct  = (this._prevShip  / maxTime) * 100;

    this.el.barEarth.style.width = earthPct + '%';
    this.el.barShip.style.width  = shipPct  + '%';

    // Show the gap explicitly
    this.el.gapVal.textContent = gap.toFixed(2) + ' yr';

    // Fade the bar hint when beta is too low to see an effect
    const barContainer = this.el.gapVal.closest('.time-bar-container');
    if (barContainer) {
      barContainer.style.opacity = gapRatio < 0.005 ? '0.35' : '1';
    }

    // Animate earth bar colour toward red as gap grows
    const red = Math.floor(100 + gapRatio * 155);
    const green = Math.floor(160 - gapRatio * 140);
    this.el.barEarth.style.background =
      `rgba(${red}, ${green}, ${Math.floor(100 - gapRatio * 80)}, 0.75)`;
  }

  // -- Resize (no-op — DOM layout handles itself) -------------------------------
  resize() {
    // DOM-based panel sizes itself via CSS; nothing needed here.
  }
}
