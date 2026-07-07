import * as THREE from 'three';
import { lengthContractionRatio } from '../physics/relativity.js';

export class MeasurementRod {
  constructor() {
    this.group = new THREE.Group();
    const rodMaterial = new THREE.MeshStandardMaterial({ color: 0xffd36b, roughness: 0.45, metalness: 0.05 });
    this.rod = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 5.2), rodMaterial);
    this.rod.position.set(0, 0, 0);

    const tickMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -5; i <= 5; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.025), tickMaterial);
      tick.position.z = i * 0.5;
      tick.position.y = 0.22;
      this.group.add(tick);
    }

    this.labelSprite = this.makeLabel('Measurement Rod');
    this.labelSprite.position.set(0, 0.65, 0);

    this.group.add(this.rod, this.labelSprite);
    this.group.position.set(-2.8, -1.4, -6);
    this.group.rotation.y = -0.25;
  }

  makeLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 20, 70);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.8, 0.7, 1);
    return sprite;
  }

  addTo(scene) {
    scene.add(this.group);
  }

  /**
   * Position the measurement rod relative to a reference point (e.g., the spacecraft).
   */
  setReferencePosition(refX, refY, refZ) {
    this.group.position.set(refX - 2.8, refY - 1.4, refZ - 6);
  }

  update(beta, viewMode) {
    const ratio = lengthContractionRatio(beta);
    if (viewMode === 'measured') {
      this.rod.scale.z = ratio;
      this.rod.material.color.set(0xffd36b);
      this.group.rotation.y = -0.25;
    } else {
      this.rod.scale.z = Math.max(0.25, ratio * 0.92 + 0.08);
      this.rod.material.color.set(0x88c7ff);
      this.group.rotation.y = -0.25 + beta * 0.65;
    }
  }
}
