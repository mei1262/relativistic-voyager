import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { PanelManager } from '../ui/PanelManager.js';
import { DataLogger } from '../ui/DataLogger.js';
import { Hud } from '../ui/Hud.js';
import { ControlPanel } from '../ui/ControlPanel.js';
import { MissionSystem } from '../ui/MissionSystem.js';
import { ConceptPanel } from '../ui/ConceptPanel.js';
import { QuizSystem } from '../ui/QuizSystem.js';
import { StarField } from '../visual/StarField.js';
import { Spacecraft } from '../visual/Spacecraft.js';
import { CockpitInterior } from '../visual/CockpitInterior.js';
import { DualClockPanel } from '../ui/DualClockPanel.js';
import { SpacetimeDiagram } from '../visual/SpacetimeDiagram.js';
import { SolarSystem, PLANET_INFO } from '../visual/SolarSystem.js';
import { addReferenceScene } from '../visual/SceneObjects.js';
import { EngineAudio } from '../audio/EngineAudio.js';
import { computeRelativityState, DEFAULT_TARGET_DISTANCE_LY, lengthContractionRatio } from '../physics/relativity.js';

/**
 * RelativisticVoyagerApp — main application controller.
 *
 * Flight model:
 * - W / ArrowUp   : move forward  (nose direction) + ignite thrust flame
 * - S / ArrowDown : move backward
 * - A / ArrowLeft : turn left
 * - D / ArrowRight: turn right
 * - Q             : move up
 * - E             : move down
 * - Shift         : increase speed (beta)
 * - Ctrl          : decrease speed (beta)
 * - V             : toggle first-person / third-person view
 * - Speed = beta (0–0.99) × maxSpeed
 *
 * Camera: supports first-person (cockpit) and third-person chase cam.
 * Star field: rich, static, centered at origin.
 * Planet info: click any planet to see details.
 */
export class RelativisticVoyagerApp {
  constructor() {
    this.state = {
      beta: 0,
      frame: 'earth',
      viewMode: 'measured',
      viewPerspective: 'thirdPerson',
      paused: false,
      earthTime: 0,
      earthDistance: DEFAULT_TARGET_DISTANCE_LY,
      timeScale: 0.025
    };

    // Ship state — starts near Mercury's orbit
    this.shipPosition = new THREE.Vector3(0, 0.5, 200);
    this.shipHeading = 0;  // Y-rotation (0 = facing -Z)

    // Camera offset in ship-local space (small — ship is scaled down 10×)
    this.cameraLocalOffset = new THREE.Vector3(0, 0.4, 1.2);

    // First-person cockpit camera offset (ship-local space, ship scale 0.12)
    this.firstPersonOffset = new THREE.Vector3(0, 0.06, -0.05);

    // Keyboard state
    this.keys = {
      forward: false, backward: false,
      left: false, right: false,
      up: false, down: false,
      shift: false, ctrl: false
    };

    // Tuning — scaled for the large (100×) solar system
    this.maxSpeed = 30;       // scene units / sec at beta=1
    this.turnRate = 1.8;      // radians / sec
    this.cameraLerp = 0.15;   // camera follow smoothness
    this.betaRampRate = 0.25; // beta units / sec when Shift/Ctrl held
    this.verticalSpeed = 8;   // scene units / sec for Q/E

    // Smooth acceleration / deceleration
    this.currentSpeed = 0;
    this.accelRate = 12;      // scene units / sec²
    this.decelRate = 16;      // scene units / sec²

    // Engine audio — initialised on first user interaction
    this.engineAudio = new EngineAudio();

    // Relativistic visual effects
    this.baseFov = 65;        // camera FOV at rest

    // Raycaster for planet click detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this._smoothCamPos = new THREE.Vector3();
    this.clock = new THREE.Clock();
  }

  // ============================================================================

  init() {
    this.logger = new DataLogger();
    this.setupThree();
    this.setupScene();
    this.setupUi();
    this.setupKeyboard();
    this.setupMouse();
    this.setupResize();
    this.logger.log('app_init');
    this.renderer.setAnimationLoop(() => this.update());
  }

  // ---- Three.js / renderer / camera ------------------------------------------

  setupThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020613);

    this.camera = new THREE.PerspectiveCamera(
      this.baseFov, window.innerWidth / window.innerHeight, 0.1, 8000
    );

    this._smoothCamPos.copy(this.shipPosition).add(this.cameraLocalOffset);
    this.camera.position.copy(this._smoothCamPos);
    this.camera.lookAt(this.shipPosition);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    document.getElementById('app-root').appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));
  }

  // ---- Scene objects ---------------------------------------------------------

  setupScene() {
    // Solar system — Sun + 8 planets at 100× scale, static at origin
    this.solarSystem = new SolarSystem();
    this.solarSystem.addTo(this.scene);

    // Reference scene: target star + lighting (no grid, no standalone Earth)
    this.refs = addReferenceScene(this.scene);

    // Star field — 单次生成点云，Shader 内完成光行差/头灯效应/多普勒频移
    this.starField = new StarField({ count: 24000, radius: 3000 });
    this.starField.addTo(this.scene);

    // Spacecraft — scaled down 10× (0.12 vs original 1.2)
    this.spacecraft = new Spacecraft();
    this.spacecraft.group.scale.setScalar(0.12);
    this.spacecraft.addTo(this.scene);
    this.spacecraft.setWorldPosition(
      this.shipPosition.x, this.shipPosition.y, this.shipPosition.z
    );

    // Cockpit interior — attached to camera, shown only in first-person
    this.cockpit = new CockpitInterior();
    this.cockpit.attachTo(this.camera);
    this.cockpit.hide();
  }

  // ---- UI --------------------------------------------------------------------

  setupUi() {
    this.hud = new Hud(this.state);
    this.dualClock = new DualClockPanel(this.state);
    this.dualClock.init();
    this.controlPanel = new ControlPanel(this.state, this.logger);
    this.controlPanel.onChange = () => this.onStateChanged();
    this.controlPanel.init();

    this.missionSystem = new MissionSystem(this.state, this.logger);
    this.missionSystem.init();

    this.conceptPanel = new ConceptPanel(this.logger);
    this.conceptPanel.init();

    this.quizSystem = new QuizSystem(this.state, this.logger);
    this.quizSystem.init();

    this.spacetimeDiagram = new SpacetimeDiagram(this.state);

    // Draggable / minimizable / closable panels
    this.panelManager = new PanelManager();
    this.panelManager.init([
      '#control-panel', '#hud-panel', '#mission-panel',
      '#concept-panel', '#quiz-panel', '#spacetime-panel', '#log-panel'
    ]);

    // Orbit speed slider
    const orbitSlider = document.getElementById('orbit-speed-slider');
    const orbitVal = document.getElementById('orbit-speed-val');
    if (orbitSlider && orbitVal) {
      orbitSlider.addEventListener('input', () => {
        const v = parseFloat(orbitSlider.value);
        this.solarSystem.orbitSpeedMultiplier = v;
        orbitVal.textContent = v.toFixed(2) + '×';
      });
    }

    this.onStateChanged();
  }

  // ---- Keyboard ---------------------------------------------------------------

  setupKeyboard() {
    const down = (e) => this._setKey(e.key, true);
    const up   = (e) => this._setKey(e.key, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
  }

  _setKey(key, pressed) {
    // Init audio on first keypress (browser autoplay policy)
    if (pressed && !this.engineAudio.initialised) {
      this.engineAudio.init();
    }

    // V key — toggle perspective (only on press, not release)
    if (key === 'v' || key === 'V') {
      if (pressed) this._togglePerspective();
      return;
    }

    if (key === 'ArrowUp'    || key === 'w' || key === 'W') this.keys.forward  = pressed;
    if (key === 'ArrowDown'  || key === 's' || key === 'S') this.keys.backward = pressed;
    if (key === 'ArrowLeft'  || key === 'a' || key === 'A') this.keys.left     = pressed;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this.keys.right    = pressed;
    if (key === 'q' || key === 'Q') this.keys.up   = pressed;
    if (key === 'e' || key === 'E') this.keys.down = pressed;
    if (key === 'Shift')   this.keys.shift = pressed;
    if (key === 'Control') this.keys.ctrl  = pressed;
  }

  /** Toggle between third-person and first-person perspective */
  _togglePerspective() {
    const next = this.state.viewPerspective === 'thirdPerson'
      ? 'firstPerson' : 'thirdPerson';
    this._setPerspective(next);
  }

  /**
   * Set perspective to a specific mode. Called by V-key toggle and UI dropdown.
   * @param {'firstPerson' | 'thirdPerson'} mode
   */
  _setPerspective(mode) {
    if (this.state.viewPerspective === mode) return;
    this.state.viewPerspective = mode;

    // Sync the dropdown in the control panel
    const sel = document.getElementById('perspective-select');
    if (sel) sel.value = mode;

    // Adjust FOV: wider for first-person immersion
    if (mode === 'firstPerson') {
      this.camera.fov = 90;
      this.spacecraft.group.visible = false;
      this.cockpit.show();
    } else {
      this.camera.fov = this.baseFov;
      this.spacecraft.group.visible = true;
      this.cockpit.hide();
    }
    this.camera.updateProjectionMatrix();

    this.logger.log('perspective_change', {
      viewPerspective: mode,
      fov: this.camera.fov
    });
  }

  // ---- Mouse / Planet click detection ----------------------------------------

  setupMouse() {
    this.renderer.domElement.addEventListener('click', (e) => {
      // Ignore clicks on UI panels
      if (e.target.closest('.panel') || e.target.closest('.panel-dock')) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Collect all planet meshes for intersection
      const planetMeshes = this.solarSystem.planets.map(p => p.mesh);
      const intersects = this.raycaster.intersectObjects(planetMeshes);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const planet = this.solarSystem.planets.find(p => p.mesh === mesh);
        if (planet) {
          this._showPlanetInfo(planet.name, e.clientX, e.clientY);
        }
      } else {
        this._hidePlanetInfo();
      }
    });

    // Hide info when pressing Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._hidePlanetInfo();
    });
  }

  _showPlanetInfo(name, x, y) {
    const info = PLANET_INFO[name];
    if (!info) return;

    const card = document.getElementById('planet-info-card');
    card.innerHTML = `
      <div class="planet-info-header">
        <span class="planet-info-name">${info.nameCN} ${info.nameEN}</span>
        <span class="planet-info-type">${info.type}</span>
      </div>
      <div class="planet-info-body">
        <div class="planet-info-row"><span>直径 Diameter</span><span>${info.diameter}</span></div>
        <div class="planet-info-row"><span>与太阳距离</span><span>${info.distSun}</span></div>
        <div class="planet-info-row"><span>公转周期</span><span>${info.orbitalPeriod}</span></div>
        <div class="planet-info-row"><span>温度</span><span>${info.temperature}</span></div>
        <div class="planet-info-row"><span>卫星 Moons</span><span>${info.moons}</span></div>
        <div class="planet-info-fact">💡 ${info.fact}</div>
      </div>
    `;

    // Position card near click, clamping to viewport
    const cardW = 300;
    const cardH = 260;
    let left = x + 16;
    let top = y - cardH / 2;
    if (left + cardW > window.innerWidth - 16) left = x - cardW - 16;
    if (top < 16) top = 16;
    if (top + cardH > window.innerHeight - 16) top = window.innerHeight - cardH - 16;

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.classList.remove('hidden');
  }

  _hidePlanetInfo() {
    const card = document.getElementById('planet-info-card');
    if (card) card.classList.add('hidden');
  }

  // ---- Resize ----------------------------------------------------------------

  setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.dualClock.resize();
    });
  }

  // ---- State change ----------------------------------------------------------

  /** Keep the beta slider in sync when keyboard changes the value */
  _syncBetaSlider() {
    const slider = document.getElementById('speed-slider');
    if (slider) {
      slider.value = String(Math.round(this.state.beta * 1000) / 1000);
    }
  }

  onStateChanged() {
    const computed = computeRelativityState(this.state);
    this.logger.log('state_snapshot', {
      beta: computed.beta, gamma: computed.gamma,
      frame: this.state.frame, viewMode: this.state.viewMode
    });
    this.hud.update();
    this.spacetimeDiagram.update();
  }

  // ---- Main update loop ------------------------------------------------------

  // ---- Main update loop ------------------------------------------------------

  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const r = computeRelativityState(this.state);

    // ---- Keyboard flight — smooth acceleration / deceleration ----------------
    if (!this.state.paused) {
      // ---- Beta ramp via Shift / Ctrl -----------------------------------------
      if (this.keys.shift) {
        this.state.beta = Math.min(0.99, this.state.beta + this.betaRampRate * dt);
        this._syncBetaSlider();
      }
      if (this.keys.ctrl) {
        this.state.beta = Math.max(0, this.state.beta - this.betaRampRate * 1.4 * dt);
        this._syncBetaSlider();
      }

      // Target speed: full when forward pressed, zero otherwise
      const targetSpeed = this.keys.forward ? this.state.beta * this.maxSpeed : 0;

      // Smooth ramp
      if (this.currentSpeed < targetSpeed) {
        this.currentSpeed += this.accelRate * dt;
        if (this.currentSpeed > targetSpeed) this.currentSpeed = targetSpeed;
      } else if (this.currentSpeed > targetSpeed) {
        this.currentSpeed -= this.decelRate * dt;
        if (this.currentSpeed < targetSpeed) this.currentSpeed = targetSpeed;
      }
      if (this.currentSpeed < 0.0005) this.currentSpeed = 0; // dead zone

      if (this.keys.left)  this.shipHeading += this.turnRate * dt;
      if (this.keys.right) this.shipHeading -= this.turnRate * dt;

      const forward = new THREE.Vector3(
        -Math.sin(this.shipHeading), 0, -Math.cos(this.shipHeading)
      );

      // Forward movement
      if (this.currentSpeed > 0.0001) {
        this.shipPosition.add(forward.clone().multiplyScalar(this.currentSpeed * dt));
      }
      // Reverse — also bleeds speed faster
      if (this.keys.backward) {
        this.shipPosition.add(forward.clone().multiplyScalar(-this.currentSpeed * 0.6 * dt));
        this.currentSpeed = Math.max(0, this.currentSpeed - this.decelRate * 1.5 * dt);
      }

      // ---- Vertical movement (Q / E) -------------------------------------------
      if (this.keys.up)   this.shipPosition.y += this.verticalSpeed * dt;
      if (this.keys.down) this.shipPosition.y -= this.verticalSpeed * dt;
      // Clamp Y so ship doesn't sink through the Sun
      this.shipPosition.y = Math.max(-115, Math.min(2000, this.shipPosition.y));

      // ---- Collision detection (solid planets + Sun) ---------------------------
      const shipR = 2.5; 

      // Sun collision 
      const sunR = 120 + shipR;
      const sunDist = this.shipPosition.length();
      if (sunDist < sunR && sunDist > 0.001) {
        this.shipPosition.normalize().multiplyScalar(sunR);
        this.currentSpeed *= 0.2;
      }

      // Planet collisions
      for (const p of this.solarSystem.planets) {
        const px = p.group.position.x, pz = p.group.position.z;
        const pR = p.def.radius * 100 + shipR; 
        const dx = this.shipPosition.x - px;
        const dz = this.shipPosition.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < pR && dist > 0.001) {
          const nx = dx / dist, nz = dz / dist;
          this.shipPosition.x = px + nx * pR;
          this.shipPosition.z = pz + nz * pR;
          this.currentSpeed *= 0.3;
        }
      }
    }

    // Apply ship transform
    this.spacecraft.setWorldPosition(
      this.shipPosition.x, this.shipPosition.y, this.shipPosition.z
    );
    this.spacecraft.setHeading(this.shipHeading);

    // ---- Simulation time -----------------------------------------------------
    if (!this.state.paused && this.currentSpeed > 0.001) {
      this.state.earthTime +=
        dt * this.state.timeScale * Math.max(0.2, this.state.beta * 12);
      if (this.state.earthTime > r.etaEarth && Number.isFinite(r.etaEarth)) {
        this.state.earthTime = 0;
        this.logger.log('arrival_loop_reset', { beta: this.state.beta, gamma: r.gamma });
      }
    }

    // ---- Camera (first-person cockpit or third-person chase cam) --------------
    if (this.state.viewPerspective === 'firstPerson') {
      const fpOffset = this.firstPersonOffset.clone();
      fpOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipHeading);
      const fpCamPos = this.shipPosition.clone().add(fpOffset);

      this._smoothCamPos.lerp(fpCamPos, this.cameraLerp * 2.0);
      this.camera.position.copy(this._smoothCamPos);

      const forward = new THREE.Vector3(
        -Math.sin(this.shipHeading), 0, -Math.cos(this.shipHeading)
      );
      const lookTarget = this.shipPosition.clone().add(
        forward.multiplyScalar(100)
      );
      this.camera.lookAt(lookTarget);
    } else {
      const rotatedOffset = this.cameraLocalOffset.clone();
      rotatedOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipHeading);
      const desiredCamPos = this.shipPosition.clone().add(rotatedOffset);

      this._smoothCamPos.lerp(desiredCamPos, this.cameraLerp);
      this.camera.position.copy(this._smoothCamPos);
      this.camera.lookAt(this.shipPosition);
    }

    // ==========================================
    // 💡 核心视觉耦合修改：动态解耦与实际速度绑定
    // ==========================================
    
    // 1. 计算当前飞船真正的物理 Beta（即：实际速度占光速上限的百分比）
    // 通过 currentSpeed / maxSpeed 映射，当不按 W 静止或未加速时，它为 0；按住 W 满速时达到设定上限 this.state.beta
    let actualBeta = 0;
    if (this.maxSpeed > 0) {
      actualBeta = (this.currentSpeed / this.maxSpeed);
    }
    // 确保值平滑处于合法区间
    actualBeta = THREE.MathUtils.clamp(actualBeta, 0.0, 0.999);

    // 2. 暗角（Vignette Overlay）特效现在跟随实际物理运动速度
    const vignette = document.getElementById('tunnel-vignette');
    if (vignette) {
      vignette.style.opacity = Math.min(0.92, actualBeta * 1.1);
    }

    // 3. 星空星field变换（头灯效应、光行差、多普勒）
    // 移除旧版必须是 firstPerson 的严苛限制，让第三人称也能正确观测到速度带来的相对论星空变化
    let visualBeta = Math.max(0.0001, actualBeta); 

    const starfieldVelocityDir = new THREE.Vector3(
      -Math.sin(this.shipHeading), 0, -Math.cos(this.shipHeading)
    ).normalize();
    
    // 传入根据当前实际加速进度计算出的 visualBeta
    this.starField.setRelativisticState(visualBeta, starfieldVelocityDir);
    // ==========================================

    // ---- Animate solar system -------------------------------------------------
    if (this.solarSystem) {
      this.solarSystem.update(dt);
    }

    // ---- Visual modules -------------------------------------------------------
    this.starField.update(dt);
    
    let verticalInput = 0;
    if (this.keys.up)   verticalInput += 1;
    if (this.keys.down) verticalInput -= 1;
    this.spacecraft.update(this.state.beta, this.keys.forward, verticalInput);

    // ---- Spacecraft length contraction (Earth frame) ----------------------------
    const baseScale = 0.12;
    const ratio = lengthContractionRatio(this.state.beta);
    if (this.state.frame === 'earth' && this.state.beta > 0.01) {
      if (this.state.viewMode === 'measured') {
        this.spacecraft.group.scale.set(baseScale, baseScale, baseScale * ratio);
        this.spacecraft.group.rotation.x = 0;
      } else {
        this.spacecraft.group.scale.set(baseScale, baseScale, baseScale * (ratio * 0.92 + 0.08));
        this.spacecraft.group.rotation.x = this.state.beta * 0.3;
      }
    } else {
      this.spacecraft.group.scale.setScalar(baseScale);
      this.spacecraft.group.rotation.x = 0;
    }

    // Cockpit interior — animate indicator lights
    this.cockpit.update(dt, this.state.beta);
    
    // Engine audio — pitch & volume track current speed (mute when paused)
    if (this.state.paused) {
      this.engineAudio.mute();
    } else {
      this.engineAudio.update(this.currentSpeed / this.maxSpeed, this.keys.forward);
    }
    
    this.hud.update();
    this.dualClock.update(r);
    this.missionSystem.update();
    this.spacetimeDiagram.update();

    this.renderer.render(this.scene, this.camera);
  }
}
