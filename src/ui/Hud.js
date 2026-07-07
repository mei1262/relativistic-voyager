import { computeRelativityState } from '../physics/relativity.js';

function fmt(value, digits = 3) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(digits);
}

function fmtYears(value) {
  if (!Number.isFinite(value)) return '--';
  if (value > 1000) return `${value.toExponential(2)} years`;
  return `${value.toFixed(2)} years`;
}

export class Hud {
  constructor(state) {
    this.state = state;
    this.el = {
      beta: document.getElementById('hud-beta'),
      gamma: document.getElementById('hud-gamma'),
      earthTime: document.getElementById('hud-earth-time'),
      shipTime: document.getElementById('hud-ship-time'),
      earthDistance: document.getElementById('hud-earth-distance'),
      shipDistance: document.getElementById('hud-ship-distance'),
      eta: document.getElementById('hud-eta'),
      lengthRatio: document.getElementById('hud-length-ratio'),
      badge: document.getElementById('mode-badge')
    };
  }

  update() {
    const r = computeRelativityState(this.state);
    this.el.beta.textContent = fmt(r.beta, 3);
    this.el.gamma.textContent = fmt(r.gamma, 3);
    this.el.earthTime.textContent = fmtYears(r.earthTime);
    this.el.shipTime.textContent = fmtYears(r.shipTime);
    this.el.earthDistance.textContent = `${fmt(r.earthDistance, 2)} ly`;
    this.el.shipDistance.textContent = `${fmt(r.shipDistance, 2)} ly`;
    this.el.eta.textContent = `${fmtYears(r.etaEarth)} / ${fmtYears(r.etaShip)}`;
    this.el.lengthRatio.textContent = fmt(r.lengthRatio, 3);
    this.el.badge.textContent = `${this.state.viewMode === 'measured' ? 'Measured' : 'Observed'} / ${this.state.frame} / ${this.state.viewPerspective === 'firstPerson' ? '1P' : '3P'}`;
  }
}
