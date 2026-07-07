import * as THREE from 'three';

/**
 * CockpitInterior — spacecraft cockpit interior shown in first-person view.
 *
 * Designed to be a child of the camera, so all positions are in camera-local
 * space: forward = -Z, up = +Y, right = +X.
 *
 * Elements:
 *  - Canopy frame (structural struts forming the window frame)
 *  - Dashboard / console with sci-fi details
 *  - Side pillars
 *  - Overhead panel
 *  - Subtle ambient glow from instruments
 */

const FRAME_COLOR    = 0x3a4a5c;
const FRAME_DARK     = 0x1e2d3a;
const PANEL_COLOR    = 0x1a2a38;
const ACCENT_COLOR   = 0x55aadd;
const ACCENT_ORANGE  = 0xff8833;
const ACCENT_GREEN   = 0x44cc88;

export class CockpitInterior {
  constructor() {
    this.group = new THREE.Group();
    this._buildCanopyFrame();
    this._buildDashboard();
    this._buildSidePillars();
    this._buildOverheadPanel();
    this._buildInstrumentGlow();
    this._buildHudReticle();
  }

  // ── Canopy window frame ────────────────────────────────────────────────────

  _buildCanopyFrame() {
    const frameMat = new THREE.MeshStandardMaterial({
      color: FRAME_COLOR, roughness: 0.4, metalness: 0.6
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: FRAME_DARK, roughness: 0.5, metalness: 0.5
    });
    // Thinner, darker frame to reduce visual obstruction
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a35, roughness: 0.5, metalness: 0.5
    });

    // Top arch beam — pushed higher to periphery
    const topBeamGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8);
    const topBeam = new THREE.Mesh(topBeamGeo, edgeMat);
    topBeam.rotation.z = Math.PI / 2;
    topBeam.position.set(0, 0.38, -0.42);
    this.group.add(topBeam);

    // Bottom sill — pushed lower, thinner
    const sillGeo = new THREE.BoxGeometry(0.66, 0.03, 0.04);
    const sill = new THREE.Mesh(sillGeo, edgeMat);
    sill.position.set(0, -0.28, -0.38);
    this.group.add(sill);

    // Left A-pillar — wider stance, from sill edge to top beam edge
    this._addStrut(-0.32, -0.27, -0.38, -0.37, 0.36, -0.44, edgeMat);
    // Right A-pillar
    this._addStrut(0.32, -0.27, -0.38, 0.37, 0.36, -0.44, edgeMat);

    // REMOVED: center vertical divider — it sat directly in the pilot's line of sight

    // Nose cone hint — small forward structure visible through bottom of window
    const noseGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x667788, roughness: 0.4, metalness: 0.5
    });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.30, -0.55);
    this.group.add(nose);
  }

  /** Helper: add a cylindrical strut between two points */
  _addStrut(x1, y1, z1, x2, y2, z2, material) {
    const start = new THREE.Vector3(x1, y1, z1);
    const end = new THREE.Vector3(x2, y2, z2);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();

    const geo = new THREE.CylinderGeometry(0.018, 0.018, length, 6);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(mid);

    // Align cylinder (Y-axis) to direction vector
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.setRotationFromQuaternion(quat);

    this.group.add(mesh);
  }

  // ── Dashboard / console ────────────────────────────────────────────────────

  _buildDashboard() {
    const panelMat = new THREE.MeshStandardMaterial({
      color: PANEL_COLOR, roughness: 0.55, metalness: 0.4
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: ACCENT_COLOR, roughness: 0.2, metalness: 0.3, emissive: ACCENT_COLOR,
      emissiveIntensity: 0.25
    });

    // Main console panel — pushed lower, slimmer
    const consoleGeo = new THREE.BoxGeometry(0.50, 0.07, 0.14);
    const console = new THREE.Mesh(consoleGeo, panelMat);
    console.position.set(0, -0.30, -0.30);
    console.rotation.x = -0.40;
    this.group.add(console);

    // Left instrument cluster — pushed lower and further out
    const leftPanelGeo = new THREE.BoxGeometry(0.12, 0.05, 0.015);
    const leftPanel = new THREE.Mesh(leftPanelGeo, accentMat);
    leftPanel.position.set(-0.17, -0.28, -0.32);
    leftPanel.rotation.x = -0.40;
    this.group.add(leftPanel);

    // Center instrument cluster
    const centerPanelGeo = new THREE.BoxGeometry(0.15, 0.06, 0.015);
    const centerPanel = new THREE.Mesh(centerPanelGeo, accentMat);
    centerPanel.position.set(0, -0.275, -0.33);
    centerPanel.rotation.x = -0.40;
    this.group.add(centerPanel);

    // Right instrument cluster
    const rightPanelGeo = new THREE.BoxGeometry(0.12, 0.05, 0.015);
    const rightPanel = new THREE.Mesh(rightPanelGeo, accentMat);
    rightPanel.position.set(0.17, -0.28, -0.32);
    rightPanel.rotation.x = -0.40;
    this.group.add(rightPanel);

    // Bottom edge trim — thinner, lower
    const trimGeo = new THREE.BoxGeometry(0.54, 0.015, 0.03);
    const trimMat = new THREE.MeshStandardMaterial({
      color: FRAME_COLOR, roughness: 0.3, metalness: 0.7
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, -0.34, -0.28);
    this.group.add(trim);

    // Small indicator lights — lower to match new dashboard position
    this._addIndicatorLight(-0.17, -0.265, -0.325, ACCENT_GREEN);
    this._addIndicatorLight(-0.08, -0.265, -0.325, ACCENT_ORANGE);
    this._addIndicatorLight(0.0, -0.26, -0.335, ACCENT_COLOR);
    this._addIndicatorLight(0.08, -0.26, -0.335, ACCENT_GREEN);
    this._addIndicatorLight(0.17, -0.265, -0.325, ACCENT_ORANGE);
  }

  _addIndicatorLight(x, y, z, color) {
    const geo = new THREE.SphereGeometry(0.008, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    const light = new THREE.Mesh(geo, mat);
    light.position.set(x, y, z);
    light.userData.indicatorColor = color;
    this.group.add(light);
  }

  // ── Side pillars ───────────────────────────────────────────────────────────

  _buildSidePillars() {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: FRAME_DARK, roughness: 0.45, metalness: 0.55
    });

    // Left side pillar — thinner, pushed further to edge
    const leftGeo = new THREE.BoxGeometry(0.03, 0.40, 0.05);
    const leftPillar = new THREE.Mesh(leftGeo, pillarMat);
    leftPillar.position.set(-0.35, 0.04, -0.36);
    this.group.add(leftPillar);

    // Right side pillar — thinner, pushed further to edge
    const rightGeo = new THREE.BoxGeometry(0.03, 0.40, 0.05);
    const rightPillar = new THREE.Mesh(rightGeo, pillarMat);
    rightPillar.position.set(0.35, 0.04, -0.36);
    this.group.add(rightPillar);

    // Side window frame edges — thinner, further out
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a35, roughness: 0.4, metalness: 0.6
    });

    [-1, 1].forEach(side => {
      const sx = side * 0.36;
      const vGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.30, 6);
      const vEdge = new THREE.Mesh(vGeo, edgeMat);
      vEdge.position.set(sx, 0.06, -0.40);
      this.group.add(vEdge);
    });
  }

  // ── Overhead panel ─────────────────────────────────────────────────────────

  _buildOverheadPanel() {
    const panelMat = new THREE.MeshStandardMaterial({
      color: PANEL_COLOR, roughness: 0.6, metalness: 0.35
    });

    // Overhead console — pushed higher
    const overheadGeo = new THREE.BoxGeometry(0.44, 0.035, 0.10);
    const overhead = new THREE.Mesh(overheadGeo, panelMat);
    overhead.position.set(0, 0.42, -0.34);
    this.group.add(overhead);

    // Small accent strip — higher to match
    const accentGeo = new THREE.BoxGeometry(0.36, 0.006, 0.015);
    const accentMat = new THREE.MeshStandardMaterial({
      color: ACCENT_COLOR, roughness: 0.2, metalness: 0.3,
      emissive: ACCENT_COLOR, emissiveIntensity: 0.15
    });
    const accent = new THREE.Mesh(accentGeo, accentMat);
    accent.position.set(0, 0.395, -0.39);
    this.group.add(accent);
  }

  // ── Instrument ambient glow ────────────────────────────────────────────────

  _buildInstrumentGlow() {
    // Subtle glow plane on the dashboard — lower, less opaque
    const glowGeo = new THREE.PlaneGeometry(0.42, 0.06);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x225577,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, -0.29, -0.35);
    glow.rotation.x = -0.40;
    this.group.add(glow);
  }

  // ── HUD reticle ────────────────────────────────────────────────────────────

  _buildHudReticle() {
    // Very faint forward reticle — barely visible, like a subtle HUD projection
    const retMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.06,
      depthTest: false,
      depthWrite: false
    });

    // Horizontal dash
    const hGeo = new THREE.BoxGeometry(0.04, 0.0015, 0.0015);
    const hDash = new THREE.Mesh(hGeo, retMat);
    hDash.position.set(0, 0, -0.60);
    hDash.renderOrder = 999;
    hDash.material.depthTest = false;
    this.group.add(hDash);

    // Vertical dash
    const vGeo = new THREE.BoxGeometry(0.0015, 0.04, 0.0015);
    const vDash = new THREE.Mesh(vGeo, retMat);
    vDash.position.set(0, 0, -0.60);
    vDash.renderOrder = 999;
    vDash.material.depthTest = false;
    this.group.add(vDash);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Attach to the camera (adds as child so it follows the camera exactly) */
  attachTo(camera) {
    camera.add(this.group);
  }

  /** Detach from camera and optionally add to a scene */
  detachFrom(camera, scene) {
    camera.remove(this.group);
    if (scene) scene.add(this.group);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  /**
   * Per-frame update for animated elements (indicator light blinking, etc.)
   * @param {number} dt — delta time in seconds
   * @param {number} beta — current speed fraction (0–0.99)
   */
  update(dt, beta) {
    // Blink indicator lights at different rates
    this._blinkTime = (this._blinkTime || 0) + dt;

    for (const child of this.group.children) {
      if (child.userData.indicatorColor !== undefined) {
        const rate = child.userData.indicatorColor === ACCENT_GREEN  ? 2.1 :
                     child.userData.indicatorColor === ACCENT_ORANGE ? 1.4 : 1.0;
        const val = 0.5 + 0.5 * Math.sin(this._blinkTime * rate * Math.PI * 2);
        child.material.opacity = 0.5 + val * 0.5;
        child.visible = val > 0.25;
      }
    }
  }
}
