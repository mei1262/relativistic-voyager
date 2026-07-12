import * as THREE from 'three';

/**
 * StarField — 稳定视觉增强版相对论星空（核心条带极限凝聚版）
 *
 * 优化点：
 * - 保持了原版所有 Shader、WebGL 显式传参和粒子像素大小优化。
 * - 引入“核心条带核”：在银心最中央的一小条带区域内，星星密集度进一步暴增。
 * - 纯数学对数与多层级指数复合衰减，在保证中心区有极窄、极高密度核心的同时，依然维持绝对顺滑无断层的视觉过渡。
 */

// 设定银河系中心的遥远天球方向向量（从太阳系望去，该方向将出现极为明显的群星聚集）
const GALACTIC_CENTER = new THREE.Vector3(0.7, 0.15, -0.7).normalize();
// 银盘的法线方向
const GALACTIC_POLE = new THREE.Vector3(0.1, 0.98, 0.1).normalize();

function generateRealisticStarDirection() {
  // 使用 while 循环进行高效率的迭代采样，零内存负担，绝对不会爆栈
  while (true) {
    // 1. 生成基础全天球随机方向
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(s * Math.cos(phi), s * Math.sin(phi), u).normalize();

    // 2. 计算到银盘平面的垂直距离
    const cosToPole = dir.dot(GALACTIC_POLE);
    const distToGalaxyPlane = Math.abs(cosToPole);

    // 3. 计算到银心的逼近程度（映射至 0.0 背向银心 ~ 1.0 正对银心）
    const cosToCenter = dir.dot(GALACTIC_CENTER); 
    const intensityToCenter = (cosToCenter + 1.0) * 0.5;

    // 4. 【核心修改】引入双层极端非对称密度对比
    // 通过超高幂次（14.0）与更陡峭的银盘约束（* 12.0），在原本就很密集的银心区域内，切出一条更窄、更璀璨的暴风眼核心带
    const densityWeight = 0.015 + // 极其微量的全天背景星
      // A. 【新增：核心极端高密条带】仅在非常靠近银盘平面且正对银心的一小条缝隙里爆发
      0.45 * Math.exp(-distToGalaxyPlane * 12.0) * Math.pow(intensityToCenter, 14.0) + 
      // B. 经典大尺度银心核
      0.40 * Math.exp(-distToGalaxyPlane * 5.5) * Math.pow(intensityToCenter, 8.0) + 
      // C. 较窄的顺沿银盘平滑弥散带
      0.13 * Math.exp(-distToGalaxyPlane * 1.8) * Math.pow(intensityToCenter, 2.0);

    // 5. 满足概率则返回
    if (Math.random() < densityWeight) {
      return dir;
    }
  }
}

function starColor() {
  const colors = [
    [0.65, 0.75, 1.0], // O/B 型蓝白星
    [0.78, 0.85, 1.0], 
    [0.90, 0.93, 1.0], // A/F 型白星
    [1.0, 0.98, 0.92], // G 型黄白星（类太阳）
    [1.0, 0.92, 0.75], 
    [1.0, 0.80, 0.58], // K 型橙星
    [1.0, 0.60, 0.45]  // M 型红矮星
  ];

  const r = Math.random();
  let idx = 0;
  if (r < 0.08) idx = 0;
  else if (r < 0.18) idx = 1;
  else if (r < 0.38) idx = 2;
  else if (r < 0.55) idx = 3;
  else if (r < 0.70) idx = 4;
  else if (r < 0.88) idx = 5;
  else idx = 6;

  const base = colors[idx];
  return [
    THREE.MathUtils.clamp(base[0] + (Math.random() - 0.5) * 0.04, 0, 1),
    THREE.MathUtils.clamp(base[1] + (Math.random() - 0.5) * 0.04, 0, 1),
    THREE.MathUtils.clamp(base[2] + (Math.random() - 0.5) * 0.04, 0, 1)
  ];
}

function starSize() {
  const r = Math.random();
  if (r < 0.75) return 1.5 + Math.random() * 1.5; 
  if (r < 0.95) return 3.0 + Math.random() * 2.0; 
  return 5.0 + Math.random() * 3.5;               
}

function starAlpha(size, centerFactor) {
  const sizeBoost = THREE.MathUtils.clamp((size - 1.5) / 7.0, 0, 1);
  const base = 0.35 + sizeBoost * 0.45 + centerFactor * 0.12;
  return THREE.MathUtils.clamp(base + Math.random() * 0.08, 0.25, 0.95);
}

const STARFIELD_VERTEX_SHADER = `
attribute float aBaseSize;
attribute float aBaseAlpha;
attribute float aTwinklePhase;
attribute float aTwinkleSpeed;
attribute float aTwinkleAmp;
attribute vec3 aColor; 

uniform float uBeta;
uniform vec3 uVelocityDir;
uniform float uTime;
uniform float uPixelRatio;
uniform float uPointScale;

varying vec3 vBaseColor;
varying float vDoppler;
varying float vAlpha;
varying float vBrightness;

void main() {
  vec3 dir = normalize(position);
  float radius = length(position);

  vec3 velocityDir = normalize(uVelocityDir);
  float beta = clamp(uBeta, 0.0, 0.999);
  float gamma = inversesqrt(max(0.000001, 1.0 - beta * beta));

  float cosTheta = dot(dir, velocityDir);
  vec3 dirParallel = velocityDir * cosTheta;
  vec3 dirPerpendicular = dir - dirParallel;

  // 1. 光行差变换
  float denom = max(0.0001, 1.0 + beta * cosTheta);
  float cosThetaPrime = (cosTheta + beta) / denom;
  vec3 dirPrime = normalize(dirPerpendicular / (gamma * denom) + velocityDir * cosThetaPrime);

  vec3 warpedPosition = dirPrime * radius;
  vec4 mvPosition = modelViewMatrix * vec4(warpedPosition, 1.0);

  // 2. 多普勒因子 D
  float doppler = gamma * (1.0 + beta * cosTheta);
  float twinkle = 1.0 + sin(uTime * aTwinkleSpeed + aTwinklePhase) * aTwinkleAmp;

  // 3. 相对论光效视觉映射
  float sizeBoost = pow(clamp(doppler, 0.3, 2.5), 0.85);
  float brightness = mix(0.5, pow(clamp(doppler, 0.2, 3.0), 1.1), 0.75);

  float forwardVisible = 1.0 - smoothstep(2.6, 3.4, doppler);
  float rearVisible = smoothstep(0.18, 0.28, doppler);
  float visibility = forwardVisible * rearVisible;

  float pointSize = aBaseSize * sizeBoost * twinkle * uPointScale * uPixelRatio;
  pointSize *= (600.0 / max(1.0, -mvPosition.z));

  gl_PointSize = clamp(pointSize, 2.0, 48.0);
  gl_Position = projectionMatrix * mvPosition;

  vBaseColor = aColor; 
  vDoppler = doppler;
  vBrightness = brightness;
  vAlpha = aBaseAlpha * twinkle * visibility;
}
`;

const STARFIELD_FRAGMENT_SHADER = `
varying vec3 vBaseColor;
varying float vDoppler;
varying float vAlpha;
varying float vBrightness;

vec3 spectralTint(float doppler) {
  float mapped = clamp(0.5 + 0.32 * log2(max(doppler, 0.001)), 0.0, 1.0);

  vec3 redShift = vec3(0.95, 0.32, 0.15);  
  vec3 neutral = vec3(0.98, 0.96, 0.92);   
  vec3 blueShift = vec3(0.42, 0.72, 1.0);  

  if (mapped < 0.5) {
    return mix(redShift, neutral, mapped / 0.5);
  }
  return mix(neutral, blueShift, (mapped - 0.5) / 0.5);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;

  float core = exp(-5.0 * r2);
  float halo = exp(-1.5 * r2) * 0.30;
  float sprite = core + halo;

  float shiftAmount = smoothstep(0.0, 0.9, abs(log2(max(vDoppler, 0.001))));
  vec3 tint = spectralTint(vDoppler);
  vec3 shiftedColor = mix(vBaseColor, tint, 0.80 * shiftAmount);

  float alpha = clamp(vAlpha * sprite, 0.0, 1.0);
  vec3 color = shiftedColor * mix(0.65, vBrightness, 0.80);
  color *= (0.7 + core * 0.3);

  gl_FragColor = vec4(color, alpha);
}
`;

export class StarField {
  constructor({ count = 28000, radius = 5000 } = {}) {
    this.count = count;
    this.fixedRadius = radius; 
    this.container = new THREE.Group();
    this._velocityDir = new THREE.Vector3(0, 0, -1);
    this._buildPointCloud();
  }

  _buildPointCloud() {
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);
    const baseSizes = new Float32Array(this.count);
    const baseAlphas = new Float32Array(this.count);
    const twinklePhase = new Float32Array(this.count);
    const twinkleSpeed = new Float32Array(this.count);
    const twinkleAmp = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      const dir = generateRealisticStarDirection();
      
      positions[i * 3] = dir.x * this.fixedRadius;
      positions[i * 3 + 1] = dir.y * this.fixedRadius;
      positions[i * 3 + 2] = dir.z * this.fixedRadius;

      const size = starSize();
      const color = starColor();

      colors[i * 3] = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];

      const centerFactor = Math.max(0, dir.dot(GALACTIC_CENTER));

      baseSizes[i] = size;
      baseAlphas[i] = starAlpha(size, centerFactor);
      twinklePhase[i] = Math.random() * Math.PI * 2;
      twinkleSpeed[i] = 0.3 + Math.random() * 1.5;
      twinkleAmp[i] = 0.02 + Math.random() * 0.04; 
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aBaseSize', new THREE.BufferAttribute(baseSizes, 1));
    geometry.setAttribute('aBaseAlpha', new THREE.BufferAttribute(baseAlphas, 1));
    geometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(twinklePhase, 1));
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeed, 1));
    geometry.setAttribute('aTwinkleAmp', new THREE.BufferAttribute(twinkleAmp, 1));
    geometry.computeBoundingSphere();

    this.material = new THREE.ShaderMaterial({
      vertexShader: STARFIELD_VERTEX_SHADER,
      fragmentShader: STARFIELD_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false, 
      depthTest: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBeta: { value: 0.0001 }, 
        uVelocityDir: { value: this._velocityDir.clone() },
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uPointScale: { value: 1.5 } 
      }
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false; 
    this.container.add(this.points);
  }

  setRelativisticState(beta, velocityDir) {
    this.material.uniforms.uBeta.value = THREE.MathUtils.clamp(beta, 0.0001, 0.999);
    if (velocityDir && velocityDir.lengthSq() > 0.000001) {
      this._velocityDir.copy(velocityDir).normalize();
      this.material.uniforms.uVelocityDir.value.copy(this._velocityDir);
    }
  }

  applyAberration(beta) {
    this.setRelativisticState(beta, this._velocityDir);
  }

  resetAberration() {
    this.setRelativisticState(0.0001, this._velocityDir);
  }

  addTo(scene) {
    scene.add(this.container);
  }

  setCenter(x, y, z) {
    this.container.position.set(x, y, z);
  }

  update(_dt) {
    this.material.uniforms.uTime.value = performance.now() * 0.001;
    this.material.uniforms.uPixelRatio.value = Math.min(2, window.devicePixelRatio || 1);
    this.container.rotation.y += 0.00001; 
  }
}