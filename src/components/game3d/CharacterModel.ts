import * as THREE from 'three';
import { CharacterId } from '@/types/game';

export class CharacterModel {
  public group: THREE.Group;
  private head: THREE.Mesh;
  private body: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private animationTime: number = 0;
  private isMoving: boolean = false;
  private facingRight: boolean = true;

  constructor(characterId: CharacterId, colors: { [key: string]: number }) {
    this.group = new THREE.Group();

    const color = colors[characterId] || 0x4488ff;

    this.head = this.createBox(0.6, 0.6, 0.6, color);
    this.head.position.y = 1.5;

    this.body = this.createBox(0.8, 1.0, 0.4, color);
    this.body.position.y = 0.6;

    this.leftArm = this.createBox(0.3, 0.8, 0.3, color);
    this.leftArm.position.set(-0.55, 0.6, 0);

    this.rightArm = this.createBox(0.3, 0.8, 0.3, color);
    this.rightArm.position.set(0.55, 0.6, 0);

    this.leftLeg = this.createBox(0.3, 0.8, 0.3, color);
    this.leftLeg.position.set(-0.25, -0.3, 0);

    this.rightLeg = this.createBox(0.3, 0.8, 0.3, color);
    this.rightLeg.position.set(0.25, -0.3, 0);

    this.group.add(this.head);
    this.group.add(this.body);
    this.group.add(this.leftArm);
    this.group.add(this.rightArm);
    this.group.add(this.leftLeg);
    this.group.add(this.rightLeg);

    this.addFace();
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

  private addFace(): void {
    const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 0.1, 0.31);
    this.head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 0.1, 0.31);
    this.head.add(rightEye);

    const mouthGeometry = new THREE.BoxGeometry(0.25, 0.05, 0.05);
    const mouth = new THREE.Mesh(mouthGeometry, eyeMaterial);
    mouth.position.set(0, -0.1, 0.31);
    this.head.add(mouth);
  }

  public setMoving(moving: boolean): void {
    this.isMoving = moving;
  }

  public setFacing(right: boolean): void {
    if (this.facingRight !== right) {
      this.facingRight = right;
      this.group.rotation.y = right ? 0 : Math.PI;
    }
  }

  public animate(delta: number): void {
    if (this.isMoving) {
      this.animationTime += delta * 8;

      const swing = Math.sin(this.animationTime) * 0.5;

      this.leftArm.rotation.x = -swing;
      this.rightArm.rotation.x = swing;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
    } else {
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
    }
  }

  public jump(): void {
    this.leftArm.rotation.x = -0.8;
    this.rightArm.rotation.x = -0.8;
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
