import { lengthContractionRatio } from '../physics/relativity.js';

/** Dual measurement rods (parallel ∥ vs perpendicular ⊥) — 2D demo panel. */
export class RodPanel {
  constructor() {
    this.canvas = document.getElementById('rod-canvas');
    this.ratioParallel = document.getElementById('rod-ratio-parallel');
    this.ratioPerp = document.getElementById('rod-ratio-perp');
    this.noteEl = document.getElementById('rod-note');
    this.ctx = this.canvas?.getContext('2d');
  }

  update(beta, viewMode) {
    if (!this.ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const ratio = lengthContractionRatio(beta);
    const measured = viewMode === 'measured';
    const parallelRatio = measured ? ratio : Math.max(0.25, ratio * 0.92 + 0.08);
    const perpRatio = 1;
    const color = measured ? '#ffd36b' : '#88c7ff';

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07111f';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(157,183,255,0.1)';
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const maxLen = w - 56;
    const ox = 28;

    // ── Rod A: parallel to motion (∥) ──
    const parY = h * 0.32;
    const parW = maxLen * parallelRatio;
    ctx.fillStyle = color;
    ctx.fillRect(ox, parY, parW, 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const tx = ox + (maxLen * i / 10) * parallelRatio;
      if (tx <= ox + parW + 1) {
        ctx.beginPath();
        ctx.moveTo(tx, parY - 3);
        ctx.lineTo(tx, parY + 23);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#e8f1ff';
    ctx.font = '12px sans-serif';
    ctx.fillText('杆 A  ∥ 运动方向', ox, parY - 8);
    ctx.fillStyle = color;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`L/L₀ = ${parallelRatio.toFixed(3)}`, ox, parY + 42);

    // ── Rod B: perpendicular (⊥) ──
    const perpX = ox + maxLen * 0.62;
    const perpH = maxLen * 0.55 * perpRatio;
    const perpTop = h * 0.52;
    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(perpX, perpTop, 14, perpH);
    ctx.strokeStyle = '#fff';
    for (let i = 0; i <= 5; i++) {
      const ty = perpTop + (perpH * i) / 5;
      ctx.beginPath();
      ctx.moveTo(perpX - 4, ty);
      ctx.lineTo(perpX + 18, ty);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8f1ff';
    ctx.font = '12px sans-serif';
    ctx.fillText('杆 B  ⊥ 运动方向', ox, perpTop - 8);
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`L/L₀ = ${perpRatio.toFixed(3)}`, ox, perpTop + perpH + 22);

    // Arrow showing motion direction
    ctx.strokeStyle = 'rgba(125,211,252,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox, h - 28);
    ctx.lineTo(ox + maxLen * 0.45, h - 28);
    ctx.lineTo(ox + maxLen * 0.38, h - 34);
    ctx.moveTo(ox + maxLen * 0.45, h - 28);
    ctx.lineTo(ox + maxLen * 0.38, h - 22);
    ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '11px sans-serif';
    ctx.fillText('→ 运动方向', ox, h - 12);

    if (this.ratioParallel) this.ratioParallel.textContent = parallelRatio.toFixed(3);
    if (this.ratioPerp) this.ratioPerp.textContent = perpRatio.toFixed(3);
    if (this.noteEl) {
      this.noteEl.textContent = measured
        ? `β=${beta.toFixed(2)}：仅 ∥ 杆收缩，⊥ 杆不变`
        : 'Observed 模式（视觉近似，∥ 杆略有差异）';
    }
  }
}
