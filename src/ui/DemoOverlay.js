import { computeRelativityState, dopplerFactor } from '../physics/relativity.js';

/** Draw analog clock faces — earth vs ship proper time comparison. */
export class AnalogClockPanel {
  constructor(state) {
    this.state = state;
    this.earthCanvas = document.getElementById('earth-clock-canvas');
    this.shipCanvas = document.getElementById('ship-clock-canvas');
    this.earthLabel = document.getElementById('earth-clock-digital');
    this.shipLabel = document.getElementById('ship-clock-digital');
    this.gammaEl = document.getElementById('demo-gamma');
  }

  /** @param {number} timeYears — displayed time in years */
  _drawFace(ctx, cx, cy, r, timeYears, color, label) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Face
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1628';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Ticks
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const inner = r - (i % 3 === 0 ? 14 : 8);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
      ctx.strokeStyle = i % 3 === 0 ? color : 'rgba(200,220,255,0.45)';
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.stroke();
    }

    // Hands — 3 revolutions per year-unit for visible motion in demo
    const rev = timeYears * Math.PI * 2 * 4;
    const minuteA = rev - Math.PI / 2;
    const hourA = rev / 12 - Math.PI / 2;

    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hourA) * r * 0.45, cy + Math.sin(hourA) * r * 0.45);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minuteA) * r * 0.68, cy + Math.sin(minuteA) * r * 0.68);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label under face (drawn in canvas bottom)
    ctx.fillStyle = '#9fb0d0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, ctx.canvas.height - 6);
  }

  update() {
    const r = computeRelativityState(this.state);

    if (this.earthCanvas) {
      const ctx = this.earthCanvas.getContext('2d');
      this._drawFace(ctx, 70, 72, 58, r.earthTime, '#7dd3fc', '地球时间 t');
    }
    if (this.shipCanvas) {
      const ctx = this.shipCanvas.getContext('2d');
      this._drawFace(ctx, 70, 72, 58, r.shipTime, '#facc15', '飞船固有时间 τ');
    }
    if (this.earthLabel) this.earthLabel.textContent = `${r.earthTime.toFixed(2)} yr`;
    if (this.shipLabel) this.shipLabel.textContent = `${r.shipTime.toFixed(2)} yr`;
    if (this.gammaEl) this.gammaEl.textContent = `γ = ${r.gamma.toFixed(2)}`;
  }
}

/** Demo HUD: view mode, blueshift overlay. */
export class DemoOverlay {
  constructor(state) {
    this.state = state;
    this.analogClocks = new AnalogClockPanel(state);
    this.viewBadge = document.getElementById('view-mode-badge');
    this.hintEl = document.getElementById('controls-hint');
    this.blueshiftEl = document.getElementById('blueshift-overlay');
    this.blueshiftVal = document.getElementById('blueshift-value');
    this.blueshiftSub = document.getElementById('blueshift-sub');
    this.blueGlow = document.getElementById('blueshift-glow');
  }

  setCameraMode(mode) {
    if (this.viewBadge) {
      this.viewBadge.textContent = mode === 'first'
        ? '第一人称 · 飞船视角'
        : '第三人称 · 地球静止参考系';
      this.viewBadge.classList.toggle('third-person', mode === 'third');
    }
    if (this.hintEl) {
      this.hintEl.innerHTML = mode === 'first'
        ? 'W 前进 · A/D 转向 · Shift/Ctrl 加减速 · <kbd>V</kbd> 切换第三人称'
        : '侧面观察飞船尺缩 · Shift/Ctrl 调节 β · <kbd>V</kbd> 切换第一人称';
    }
    document.getElementById('contraction-label')
      ?.classList.toggle('hidden', mode === 'first');
  }

  update(cameraMode, isThrusting) {
    const r = computeRelativityState(this.state);
    const doppler = dopplerFactor(this.state.beta, 1);
    const showBlue = cameraMode === 'first' && isThrusting && this.state.beta > 0.05;

    this.analogClocks.update();

    const contractLabel = document.getElementById('contraction-label');
    if (contractLabel && cameraMode === 'third') {
      contractLabel.textContent = `地球系观测 · 飞船长度 L/L₀ = ${r.lengthRatio.toFixed(3)}`;
    }

    this.blueshiftEl?.classList.toggle('active', showBlue);
    if (this.blueGlow) {
      this.blueGlow.style.opacity = String(showBlue ? Math.min(0.85, this.state.beta * 0.95) : 0);
    }
    if (this.blueshiftVal && showBlue) {
      this.blueshiftVal.textContent = `f′/f = ${doppler.toFixed(2)}`;
    }
    if (this.blueshiftSub && showBlue) {
      this.blueshiftSub.textContent = `β = ${this.state.beta.toFixed(2)}c · 正前方 = 前进方向 · 星光蓝移`;
    }
  }
}
