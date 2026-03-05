import * as THREE from 'three';
import { EnemyType } from '@/types/game';

export class EnemyModel {
  public group: THREE.Group;
  private animationTime: number = 0;
  private parts: THREE.Mesh[] = [];
  private type: EnemyType;

  constructor(type: EnemyType) {
    this.type = type;
    this.group = new THREE.Group();
    this.createModel();
  }

  private createModel(): void {
    let color: number;
    let scale = 1;

    switch (this.type) {
      case 'sloth':
        color = 0x8B7355;
        scale = 0.9;
        break;
      case 'deadline':
        color = 0xFF4444;
        scale = 1.1;
        break;
      case 'spam':
        color = 0xFFAA00;
        scale = 1.0;
        break;
      case 'boss':
        color = 0x8800FF;
        scale = 2.0;
        break;
      default:
        color = 0x888888;
    }

    const head = this.createBox(0.6 * scale, 0.6 * scale, 0.6 * scale, color);
    head.position.y = 1.5 * scale;
    this.parts.push(head);

    const body = this.createBox(0.8 * scale, 1.0 * scale, 0.4 * scale, color);
    body.position.y = 0.6 * scale;
    this.parts.push(body);

    const leftArm = this.createBox(0.3 * scale, 0.8 * scale, 0.3 * scale, color);
    leftArm.position.set(-0.55 * scale, 0.6 * scale, 0);
    this.parts.push(leftArm);

    const rightArm = this.createBox(0.3 * scale, 0.8 * scale, 0.3 * scale, color);
    rightArm.position.set(0.55 * scale, 0.6 * scale, 0);
    this.parts.push(rightArm);

    const leftLeg = this.createBox(0.3 * scale, 0.8 * scale, 0.3 * scale, color);
    leftLeg.position.set(-0.25 * scale, -0.3 * scale, 0);
    this.parts.push(leftLeg);

    const rightLeg = this.createBox(0.3 * scale, 0.8 * scale, 0.3 * scale, color);
    rightLeg.position.set(0.25 * scale, -0.3 * scale, 0);
    this.parts.push(rightLeg);

    this.parts.forEach(part => this.group.add(part));

    this.addEyes(head, color);
  }

  private createBox(width: number, height: number, depth: number, color: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color });
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.add(line);
    return mesh;
  }

  private addEyes(head: THREE.Mesh, baseColor: number): void {
    const eyeColor = this.type === 'boss' ? 0xFF0000 : 0x000000;
    const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: eyeColor });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 0.1, 0.31);
    head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 0.1, 0.31);
    head.add(rightEye);
  }

  public animate(delta: number, moving: boolean = true): void {
    if (moving) {
      this.animationTime += delta * 6;
      const swing = Math.sin(this.animationTime) * 0.4;

      if (this.parts.length >= 6) {
        this.parts[2].rotation.x = -swing;
        this.parts[3].rotation.x = swing;
        this.parts[4].rotation.x = swing;
        this.parts[5].rotation.x = -swing;
      }
    }
  }

  public dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
