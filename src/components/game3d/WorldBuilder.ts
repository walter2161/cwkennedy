import * as THREE from 'three';
import { Platform, PowerUp, BackgroundType } from '@/types/game';

export class WorldBuilder {
  private scene: THREE.Scene;
  private platformMeshes: Map<string, THREE.Mesh> = new Map();
  private powerUpMeshes: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public buildPlatforms(platforms: Platform[]): void {
    this.clearPlatforms();

    platforms.forEach((platform, index) => {
      const mesh = this.createPlatformMesh(platform);
      mesh.position.set(
        platform.x + platform.width / 2,
        -platform.y - platform.height / 2,
        0
      );
      this.scene.add(mesh);
      this.platformMeshes.set(`platform-${index}`, mesh);
    });
  }

  private createPlatformMesh(platform: Platform): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(
      platform.width,
      platform.height,
      20
    );

    let color: number;
    switch (platform.type) {
      case 'ground':
        color = 0x4a7c59;
        break;
      case 'platform':
        color = 0x8b6f47;
        break;
      case 'glass':
        color = 0x87ceeb;
        break;
      case 'desk':
        color = 0x8b4513;
        break;
      case 'rooftop':
        color = 0x555555;
        break;
      case 'building':
        color = 0x666666;
        break;
      case 'arena-wall':
        color = 0x222222;
        break;
      default:
        color = 0x8b6f47;
    }

    const material = platform.type === 'glass'
      ? new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.6 })
      : new THREE.MeshLambertMaterial({ color });

    const mesh = new THREE.Mesh(geometry, material);

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    mesh.add(line);

    return mesh;
  }

  public buildPowerUps(powerUps: PowerUp[]): void {
    this.clearPowerUps();

    powerUps.forEach(powerUp => {
      if (!powerUp.collected) {
        const mesh = this.createPowerUpMesh(powerUp);
        mesh.position.set(powerUp.x, -powerUp.y, 5);
        this.scene.add(mesh);
        this.powerUpMeshes.set(powerUp.id, mesh);
      }
    });
  }

  private createPowerUpMesh(powerUp: PowerUp): THREE.Group {
    const group = new THREE.Group();

    let color: number;
    let size = 0.5;

    switch (powerUp.type) {
      case 'coffee':
        color = 0x6F4E37;
        break;
      case 'wifi':
        color = 0x4169E1;
        break;
      case 'networking':
        color = 0x32CD32;
        break;
      case 'coin':
        color = 0xFFD700;
        size = 0.3;
        break;
      default:
        color = 0xFFFFFF;
    }

    const geometry = powerUp.type === 'coin'
      ? new THREE.CylinderGeometry(size, size, 0.1, 16)
      : new THREE.BoxGeometry(size, size, size);

    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);

    if (powerUp.type === 'coin') {
      mesh.rotation.x = Math.PI / 2;
    }

    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    mesh.add(line);

    group.add(mesh);
    group.userData.powerUp = powerUp;

    return group;
  }

  public animatePowerUps(delta: number): void {
    this.powerUpMeshes.forEach(mesh => {
      mesh.rotation.y += delta * 2;
      mesh.position.y += Math.sin(Date.now() * 0.003) * 0.02;
    });
  }

  public removePowerUp(id: string): void {
    const mesh = this.powerUpMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.powerUpMeshes.delete(id);
    }
  }

  public updateMovingPlatforms(platforms: Platform[], delta: number): void {
    platforms.forEach((platform, index) => {
      if (platform.type === 'moving' && platform.movingRange && platform.movingSpeed) {
        const mesh = this.platformMeshes.get(`platform-${index}`);
        if (mesh) {
          mesh.position.set(
            platform.x + platform.width / 2,
            -platform.y - platform.height / 2,
            0
          );
        }
      }
    });
  }

  public setBackground(type: BackgroundType): void {
    let color: number;
    switch (type) {
      case 'urban':
        color = 0x87CEEB;
        break;
      case 'sunset':
        color = 0xFF6B6B;
        break;
      case 'coworking':
        color = 0xF5F5DC;
        break;
      case 'meeting':
        color = 0xE0E0E0;
        break;
      case 'rooftop':
        color = 0x4A90E2;
        break;
      case 'happyhour':
        color = 0xFF9500;
        break;
      case 'datacenter':
        color = 0x1a1a2e;
        break;
      default:
        color = 0x87CEEB;
    }
    this.scene.background = new THREE.Color(color);
  }

  private clearPlatforms(): void {
    this.platformMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.platformMeshes.clear();
  }

  private clearPowerUps(): void {
    this.powerUpMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.powerUpMeshes.clear();
  }

  public dispose(): void {
    this.clearPlatforms();
    this.clearPowerUps();
  }
}
