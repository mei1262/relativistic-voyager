import * as THREE from 'three';
import { aberratedCosTheta } from '../physics/relativity.js';

/**
 * StarField — a rich, bright star field filling the entire solar system volume.
 *
 * Features:
 *  - Stars distributed throughout spherical VOLUME (not just a surface shell)
 *    — inner radius 5 → outer radius 3000, stars visible everywhere among planets
 *  - Multiple layers with boosted sizes and opacities (bright, medium, dim)
 *  - Milky Way band of denser stars along a plane
 *  - Temperature-based star colors (blue-white → yellow → orange)
 *  - Subtle twinkling animation
 *  - Relativistic stellar aberration (first-person only, triggered by App.js)
 */

// Random direction on unit sphere
function randomDirection() {
  const u = Math.random() * 2 - 1;
  const phi = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(phi), s * Math.sin(phi), u).normalize();
}

// Random direction biased toward the Milky Way plane (Y ≈ 0)
function milkyWayDirection() {
  const y = (Math.random() - 0.5) * 0.35;
  const phi = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - y * y);
  return new THREE.Vector3(r * Math.cos(phi), y, r * Math.sin(phi)).normalize();
}

// Uniform volume distribution: r = R * cbrt(random)
// This gives equal density at all distances (compensates for spherical volume growth)
function volumeRadius(innerR, outerR) {
  const u = Math.random();
  // Map [0,1] to [innerR³, outerR³] then take cube root
  const v = innerR * innerR * innerR + u * (outerR * outerR * outerR - innerR * innerR * innerR);
  return Math.cbrt(v);
}

// Star color based on spectral class (temperature)
function starColor() {
  const colors = [
    [0.6, 0.7, 1.0],    // O — blue
    [0.7, 0.8, 1.0],    // B — blue-white
    [0.85, 0.9, 1.0],   // A — white
    [0.95, 0.95, 0.9],  // F — yellow-white
    [1.0, 0.95, 0.7],   // G — yellow
    [1.0, 0.75, 0.5],   // K — orange
    [1.0, 0.55, 0.4],   // M — red-orange
  ];
  const r = Math.random();
  let idx;
  if (r < 0.05) idx = 0;
  else if (r < 0.12) idx = 1;
  else if (r < 0.32) idx = 2;
  else if (r < 0.50) idx = 3;
  else if (r < 0.66) idx = 4;
  else if (r < 0.85) idx = 5;
  else idx = 6;

  const base = colors[idx];
  return [
    base[0] + (Math.random() - 0.5) * 0.1,
    base[1] + (Math.random() - 0.5) * 0.1,
    base[2] + (Math.random() - 0.5) * 0.1
  ];
}

export class StarField {
  constructor({ count = 8000, radius = 3000 } = {}) {
    this.count = count;
    this.outerRadius = radius;
    this.innerRadius = 5;   // start very close to Sun — stars fill the whole system
    this.layers = [];

    // Volume-filling stars — higher density inside the solar system.
    // Sizes & opacities boosted for better visibility.
    this._createVolumeStars(Math.floor(count * 0.50), this.innerRadius, radius, 0.6, 1.5, 0.92);
    this._createVolumeStars(Math.floor(count * 0.25), this.innerRadius, radius, 1.5, 3.2, 1.0);
    this._createVolumeStars(Math.floor(count * 0.10), this.innerRadius, radius, 3.2, 6.5, 1.0);

    // Milky Way band — brighter and denser
    this._createMilkyWayVolume(Math.floor(count * 0.8), this.innerRadius, radius);

    this.container = new THREE.Group();
    for (const layer of this.layers) {
      this.container.add(layer.points);
    }
  }

  /** Create a layer of stars distributed throughout the spherical volume */
  _createVolumeStars(count, innerR, outerR, minSize, maxSize, opacity = 0.85) {
    const avgSize = (minSize + maxSize) / 2;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const dir = randomDirection();
      const r = volumeRadius(innerR, outerR);
      positions[i * 3] = dir.x * r;
      positions[i * 3 + 1] = dir.y * r;
      positions[i * 3 + 2] = dir.z * r;

      const c = starColor();
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: avgSize,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    this.layers.push({
      points: new THREE.Points(geo, mat),
      count,
      originalPositions: new Float32Array(positions)  // cached for aberration
    });
  }

  /** Milky Way band — stars concentrated along Y≈0, distributed in volume */
  _createMilkyWayVolume(count, innerR, outerR) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // 65% from Milky Way distribution, 35% random (soft edges)
      const dir = Math.random() < 0.65 ? milkyWayDirection() : randomDirection();
      const r = volumeRadius(innerR * 0.6, outerR * 1.05);
      positions[i * 3] = dir.x * r;
      positions[i * 3 + 1] = dir.y * r;
      positions[i * 3 + 2] = dir.z * r;

      const c = starColor();
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    this.milkyWayPoints = new THREE.Points(geo, mat);
    this.layers.push({
      points: this.milkyWayPoints,
      count,
      originalPositions: new Float32Array(positions)
    });
  }

  // -- Relativistic stellar aberration ---------------------------------------

  /**
   * Apply relativistic aberration to all stars.
   * Ship motion is along -Z (forward). Stars ahead (-Z) crowd together;
   * stars behind (+Z) spread apart.
   *
   * @param {number} beta — current speed fraction v/c
   */
  applyAberration(beta) {
    for (const layer of this.layers) {
      const orig = layer.originalPositions;
      const geo = layer.points.geometry;
      const posArr = geo.attributes.position.array;
      const count = layer.count;

      for (let i = 0; i < count; i++) {
        const px = orig[i * 3];
        const py = orig[i * 3 + 1];
        const pz = orig[i * 3 + 2];

        const r = Math.sqrt(px * px + py * py + pz * pz);
        if (r < 0.001) continue;

        // cosθ = 1 for star directly ahead (-Z direction)
        const cosTheta = -pz / r;
        const cosThetaPrime = aberratedCosTheta(beta, cosTheta);
        const sinThetaPrime = Math.sqrt(Math.max(0, 1 - cosThetaPrime * cosThetaPrime));

        // Preserve azimuth φ around Z-axis; only remap polar angle θ
        const xyDist = Math.sqrt(px * px + py * py);
        if (xyDist > 0.0001) {
          const scale = (sinThetaPrime * r) / xyDist;
          posArr[i * 3]     = px * scale;
          posArr[i * 3 + 1] = py * scale;
        } else {
          posArr[i * 3]     = 0;
          posArr[i * 3 + 1] = 0;
        }
        posArr[i * 3 + 2] = -cosThetaPrime * r;
      }

      geo.attributes.position.needsUpdate = true;
    }
  }

  /**
   * Reset star positions to their original configuration (β=0).
   */
  resetAberration() {
    for (const layer of this.layers) {
      const orig = layer.originalPositions;
      const posArr = layer.points.geometry.attributes.position.array;
      posArr.set(orig);
      layer.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  // -- Scene attachment ------------------------------------------------------

  addTo(scene) {
    scene.add(this.container);
  }

  /** No-op — stars are static at origin, do not follow the ship */
  setCenter(x, y, z) {
    // Intentionally empty
  }

  /**
   * Update — subtle twinkling only, NO relativistic effects.
   * @param {number} _beta — ignored (kept for API compatibility)
   */
  update(_beta) {
    const t = performance.now() * 0.001;

    // Subtle twinkling on the brightest layer (last volume layer = largest stars)
    const brightIdx = 2; // third volume layer
    if (this.layers[brightIdx]) {
      const twinkle = 0.92 + 0.08 * Math.sin(t * 3.7 + 123.4);
      this.layers[brightIdx].points.material.opacity = twinkle;
    }

    // Very slow rotation of the entire star field for subtle parallax
    this.container.rotation.y += 0.00003;
  }
}
