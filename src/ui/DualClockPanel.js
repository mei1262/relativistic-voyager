import { computeRelativityState } from '../physics/relativity.js';

/**
 * DualClockPanel — DOM-driven dual clock for time-dilation visualization.
 *
 * Shows Earth clock (coordinate time t) and Ship clock (proper time τ)
 * side-by-side with animated progress bars.  Injected into #hud-panel
 * below the existing <dl> grid.
 */
export class DualClockPanel {
  constructor(state) {
    this.state = state;
    this._prevEarth = 0;
    this._prevShip = 0;
  }

  // -- Initialisation -------------------------------------------------------

  init() {
    const panel = document.querySelector('#hud-panel');
    if (!panel) return;

    const root = document.createElement('div');
    root.id = 'dual-clock';
    root.innerHTML = `
      <div class="dual-clock-row">
        <div class="clock-card earth-card">
          <span class="clock-card-label">🌍 地球钟 t</span>
          <span class="clock-card-value" id="dc-earth-val">0.00 年</span>
          <div class="clock-bar-track">
            <div class="clock-bar-fill earth-bar-fill" id="dc-earth-bar"></div>
          </div>
          <span class="clock-card-hint">坐标时间 · 走得较快</span>
        </div>
        <div class="clock-card ship-card">
          <span class="clock-card-label">🚀 飞船钟 τ</span>
          <span class="clock-card-value" id="dc-ship-val">0.00 年</span>
          <div class="clock-bar-track">
            <div class="clock-bar-fill ship-bar-fill" id="dc-ship-bar"></div>
          </div>
          <span class="clock-card-hint">固有时间 · 走得较慢</span>
        </div>
      </div>
      <div class="dual-clock-gap">
        地球多过的岁月：<span id="dc-gap-val">0.00 年</span>
      </div>
    `;

    panel.appendChild(root);

    this.el = {
      earthVal: root.querySelector('#dc-earth-val'),
      shipVal:  root.querySelector('#dc-ship-val'),
      earthBar: root.querySelector('#dc-earth-bar'),
      shipBar:  root.querySelector('#dc-ship-bar'),
      gapVal:   root.querySelector('#dc-gap-val')
    };
  }

  // -- Per-frame update -----------------------------------------------------

  update(r) {
    if (!this.el) return;

    // Smooth interpolation (exponential moving average)
    const alpha = 0.18;
    this._prevEarth += (r.earthTime - this._prevEarth) * alpha;
    this._prevShip  += (r.shipTime  - this._prevShip)  * alpha;

    // Clock digits
    this.el.earthVal.textContent = this._prevEarth.toFixed(3) + ' 年';
    this.el.shipVal.textContent  = this._prevShip.toFixed(3)  + ' 年';

    // Gap display
    const gap = Math.max(0, this._prevEarth - this._prevShip);
    this.el.gapVal.textContent = gap.toFixed(3) + ' 年';

    // Bar widths — both fill relative to the larger of the two
    const maxTime = Math.max(this._prevEarth, this._prevShip, 0.001);
    const earthPct = (this._prevEarth / maxTime) * 100;
    const shipPct  = (this._prevShip  / maxTime) * 100;

    this.el.earthBar.style.width = earthPct + '%';
    this.el.shipBar.style.width  = shipPct  + '%';

    // Dynamic colour: earth gets warmer red as gap grows, ship stays cool blue
    const gapRatio = this._prevEarth > 0.01
      ? Math.min(1, gap / this._prevEarth)
      : 0;

    const warmR = Math.floor(120 + gapRatio * 135);
    const warmG = Math.floor(180 - gapRatio * 140);
    const warmB = Math.floor(220 - gapRatio * 160);
    this.el.earthVal.style.color = `rgb(${warmR}, ${warmG}, ${warmB})`;
    this.el.earthBar.style.background =
      `linear-gradient(90deg, #ff9966, rgb(${warmR}, ${Math.max(40, warmG)}, ${Math.max(60, warmB)}))`;

    const coolR = Math.floor(100 - gapRatio * 40);
    const coolG = Math.floor(160 - gapRatio * 40);
    this.el.shipVal.style.color = `rgb(${coolR}, ${coolG}, 255)`;

    // Fade gap text when beta is negligible
    const gapEl = this.el.gapVal.parentElement;
    if (gapEl) {
      gapEl.style.opacity = gapRatio < 0.005 ? '0.4' : '1';
    }
  }

  // -- Resize (no-op — DOM handles layout via CSS) --------------------------

  resize() {
    // DOM-based; CSS flexbox handles responsive sizing.
  }
}
