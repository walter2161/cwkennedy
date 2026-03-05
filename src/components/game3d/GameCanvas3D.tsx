import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Level, Player, Enemy, PowerUp, CharacterId, BossArena } from '@/types/game';
import { characters } from '@/data/characters';
import { updateEnemyAI, EnemyProjectile } from '../game/EnemyAI';
import GameHUD from '../game/GameHUD';
import { CharacterModel } from './CharacterModel';
import { EnemyModel } from './EnemyModel';
import { WorldBuilder } from './WorldBuilder';

interface GameCanvas3DProps {
  level: Level;
  characterId: CharacterId;
  onLevelComplete: (networkingCollected: number, coinsCollected: number) => void;
  onGameOver: () => void;
  onPause: () => void;
  onBossDefeated?: () => void;
}

const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const MOVE_SPEED = 5;
const COFFEE_SPEED_BOOST = 2;
const COFFEE_JUMP_BOOST = -3;
const COFFEE_DURATION = 300;
const PROJECTILE_SPEED = 12;
const PROGRAMMER_SHOOT_COOLDOWN = 180;
const NORMAL_SHOOT_COOLDOWN = 60;

const CHARACTER_COLORS: { [key: string]: number } = {
  entrepreneur: 0x4488ff,
  designer: 0xE91E63,
  programmer: 0x9C27B0,
  socialmedia: 0xFF4081,
  gestor: 0xFFC107,
};

const getCharacterModifiers = (characterId: CharacterId) => {
  switch (characterId) {
    case 'entrepreneur':
      return { canDoubleJump: true, gravityMod: 1, speedMod: 1, collectRadius: 1, startsWithWifi: false, isProgrammer: false, jumpBoost: 1 };
    case 'designer':
      return { canDoubleJump: false, gravityMod: 0.5, speedMod: 1, collectRadius: 1, startsWithWifi: false, isProgrammer: false, jumpBoost: 1.15 };
    case 'programmer':
      return { canDoubleJump: false, gravityMod: 1, speedMod: 1, collectRadius: 1, startsWithWifi: true, isProgrammer: true, jumpBoost: 1 };
    case 'socialmedia':
      return { canDoubleJump: false, gravityMod: 1, speedMod: 1, collectRadius: 3, startsWithWifi: false, isProgrammer: false, jumpBoost: 1 };
    case 'gestor':
      return { canDoubleJump: false, gravityMod: 1, speedMod: 1.4, collectRadius: 1, startsWithWifi: false, isProgrammer: false, jumpBoost: 1 };
    default:
      return { canDoubleJump: false, gravityMod: 1, speedMod: 1, collectRadius: 1, startsWithWifi: false, isProgrammer: false, jumpBoost: 1 };
  }
};

const GameCanvas3D: React.FC<GameCanvas3DProps> = ({
  level,
  characterId,
  onLevelComplete,
  onGameOver,
  onPause,
  onBossDefeated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const characterModelRef = useRef<CharacterModel | null>(null);
  const enemyModelsRef = useRef<Map<string, EnemyModel>>(new Map());
  const worldBuilderRef = useRef<WorldBuilder | null>(null);
  const animationFrameRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  const character = characters.find(c => c.id === characterId)!;
  const modifiers = getCharacterModifiers(characterId);

  const [bossArena, setBossArena] = useState<BossArena | null>(level.bossArena || null);
  const [player, setPlayer] = useState<Player>({
    x: 100,
    y: 400,
    width: 48,
    height: 64,
    velocityX: 0,
    velocityY: 0,
    isJumping: false,
    isGrounded: false,
    facingRight: true,
    hasCoffee: false,
    hasWifi: modifiers.startsWithWifi,
    coffeeTimer: 0,
    networkingCollected: 0,
    canDoubleJump: modifiers.canDoubleJump,
    hasDoubleJumped: false,
    health: 3,
    maxHealth: 3,
    invincible: false,
    invincibleTimer: 0,
    coins: 0,
    shootCooldown: 0,
    isProgrammer: modifiers.isProgrammer,
  });

  const [enemies, setEnemies] = useState<Enemy[]>(() =>
    level.enemies.map(e => ({ ...e }))
  );

  const [powerUps, setPowerUps] = useState<PowerUp[]>(() =>
    level.powerUps.map(p => ({ ...p }))
  );

  const [projectiles, setProjectiles] = useState<any[]>([]);
  const [bossProjectiles, setBossProjectiles] = useState<any[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [bossDefeated, setBossDefeated] = useState(false);

  const checkCollision = useCallback((
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number
  ) => {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      800 / 600,
      0.1,
      2000
    );
    camera.position.set(0, 10, 40);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(800, 600);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    const worldBuilder = new WorldBuilder(scene);
    worldBuilderRef.current = worldBuilder;
    worldBuilder.buildPlatforms(level.platforms);
    worldBuilder.buildPowerUps(level.powerUps);
    worldBuilder.setBackground(level.background);

    const characterModel = new CharacterModel(characterId, CHARACTER_COLORS);
    characterModel.group.position.set(1, 0, 0);
    characterModel.group.castShadow = true;
    scene.add(characterModel.group);
    characterModelRef.current = characterModel;

    enemies.forEach(enemy => {
      const enemyModel = new EnemyModel(enemy.type);
      enemyModel.group.position.set(enemy.x / 10, -enemy.y / 10, 0);
      enemyModel.group.castShadow = true;
      scene.add(enemyModel.group);
      enemyModelsRef.current.set(enemy.id, enemyModel);
    });

    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      characterModel.dispose();
      enemyModelsRef.current.forEach(model => model.dispose());
      worldBuilder.dispose();
    };
  }, [level, characterId, enemies]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (keysRef.current.has(e.code)) return;
      keysRef.current.add(e.code);

      if (e.code === 'Escape') {
        onPause();
      }

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        setPlayer(prev => {
          if (prev.isGrounded) {
            let jumpForce = prev.hasCoffee ? JUMP_FORCE + COFFEE_JUMP_BOOST : JUMP_FORCE;
            jumpForce *= modifiers.jumpBoost;
            characterModelRef.current?.jump();
            return {
              ...prev,
              velocityY: jumpForce,
              isJumping: true,
              isGrounded: false,
              hasDoubleJumped: false,
            };
          } else if (prev.canDoubleJump && !prev.hasDoubleJumped) {
            let jumpForce = prev.hasCoffee ? JUMP_FORCE + COFFEE_JUMP_BOOST : JUMP_FORCE;
            jumpForce *= modifiers.jumpBoost;
            characterModelRef.current?.jump();
            return {
              ...prev,
              velocityY: jumpForce * 0.85,
              hasDoubleJumped: true,
            };
          }
          return prev;
        });
      }

      if (e.code === 'KeyJ') {
        setPlayer(prev => {
          if (prev.hasWifi && (prev.shootCooldown || 0) <= 0) {
            const newProjectile = {
              id: `proj-${Date.now()}`,
              x: prev.x + (prev.facingRight ? prev.width : 0),
              y: prev.y + prev.height / 2,
              velocityX: prev.facingRight ? PROJECTILE_SPEED : -PROJECTILE_SPEED,
              active: true,
              type: 'wifi',
            };
            setProjectiles(projs => [...projs, newProjectile]);

            const cooldown = prev.isProgrammer ? PROGRAMMER_SHOOT_COOLDOWN : NORMAL_SHOOT_COOLDOWN;
            return { ...prev, shootCooldown: cooldown };
          }
          return prev;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onPause, modifiers]);

  useEffect(() => {
    const gameLoop = () => {
      const delta = clockRef.current.getDelta();
      setGameTime(prev => prev + 1);

      setPlayer(prev => ({
        ...prev,
        shootCooldown: Math.max(0, (prev.shootCooldown || 0) - 1),
        invincibleTimer: prev.invincible ? Math.max(0, (prev.invincibleTimer || 0) - 1) : 0,
        invincible: prev.invincible && (prev.invincibleTimer || 0) > 0,
      }));

      if (bossArena && !bossArena.active && player.x > bossArena.triggerX) {
        setBossArena({ ...bossArena, active: true });
      }

      setPlayer(prevPlayer => {
        let newPlayer = { ...prevPlayer };
        const keys = keysRef.current;

        const baseSpeed = newPlayer.hasCoffee ? MOVE_SPEED + COFFEE_SPEED_BOOST : MOVE_SPEED;
        const speed = baseSpeed * modifiers.speedMod;

        const isMoving = keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('ArrowRight') || keys.has('KeyD');

        if (keys.has('ArrowLeft') || keys.has('KeyA')) {
          newPlayer.velocityX = -speed;
          newPlayer.facingRight = false;
        } else if (keys.has('ArrowRight') || keys.has('KeyD')) {
          newPlayer.velocityX = speed;
          newPlayer.facingRight = true;
        } else {
          newPlayer.velocityX = 0;
        }

        characterModelRef.current?.setMoving(isMoving);
        characterModelRef.current?.setFacing(newPlayer.facingRight);

        newPlayer.velocityY += GRAVITY * modifiers.gravityMod;
        newPlayer.x += newPlayer.velocityX;
        newPlayer.y += newPlayer.velocityY;

        if (bossArena && bossArena.active) {
          if (newPlayer.x < bossArena.startX) {
            newPlayer.x = bossArena.startX;
            newPlayer.velocityX = 0;
          }
          if (newPlayer.x + newPlayer.width > bossArena.endX) {
            newPlayer.x = bossArena.endX - newPlayer.width;
            newPlayer.velocityX = 0;
          }
        }

        if (newPlayer.x < 0) newPlayer.x = 0;
        if (newPlayer.x > level.width - newPlayer.width) {
          newPlayer.x = level.width - newPlayer.width;
        }

        newPlayer.isGrounded = false;
        level.platforms.forEach(platform => {
          if (platform.type === 'arena-wall') {
            if (!bossArena || !bossArena.active || bossDefeated) return;
          }

          let platX = platform.x;

          if (platform.type === 'moving' && platform.movingRange && platform.movingSpeed) {
            const range = platform.movingRange.max - platform.movingRange.min;
            const offset = Math.sin(gameTime * 0.02 * platform.movingSpeed) * range / 2;
            platX = platform.movingRange.min + range / 2 + offset;
          }

          if (checkCollision(
            newPlayer.x, newPlayer.y, newPlayer.width, newPlayer.height,
            platX, platform.y, platform.width, platform.height
          )) {
            if (newPlayer.velocityY > 0 &&
                prevPlayer.y + prevPlayer.height <= platform.y + 10) {
              newPlayer.y = platform.y - newPlayer.height;
              newPlayer.velocityY = 0;
              newPlayer.isGrounded = true;
              newPlayer.isJumping = false;
              newPlayer.hasDoubleJumped = false;
            }
          }
        });

        if (newPlayer.y > 650) {
          onGameOver();
          return prevPlayer;
        }

        if (newPlayer.hasCoffee) {
          newPlayer.coffeeTimer--;
          if (newPlayer.coffeeTimer <= 0) {
            newPlayer.hasCoffee = false;
          }
        }

        const boss = enemies.find(e => e.type === 'boss' && e.alive);
        if (!boss || bossDefeated) {
          if (checkCollision(
            newPlayer.x, newPlayer.y, newPlayer.width, newPlayer.height,
            level.goal.x, level.goal.y, 60, 100
          )) {
            onLevelComplete(newPlayer.networkingCollected, newPlayer.coins);
          }
        }

        if (characterModelRef.current) {
          characterModelRef.current.group.position.set(
            newPlayer.x / 10,
            -newPlayer.y / 10,
            0
          );
        }

        return newPlayer;
      });

      setEnemies(prevEnemies => {
        return prevEnemies.map(enemy => {
          if (!enemy.alive) return enemy;

          const updated = updateEnemyAI(
            enemy,
            player,
            level.platforms,
            gameTime,
            (proj: EnemyProjectile) => {
              setBossProjectiles(prev => [...prev, proj]);
            }
          );

          const enemyModel = enemyModelsRef.current.get(enemy.id);
          if (enemyModel) {
            enemyModel.group.position.set(updated.x / 10, -updated.y / 10, 0);
            enemyModel.animate(delta, Math.abs(updated.velocityX) > 0.1);
          }

          return updated;
        });
      });

      setPlayer(prevPlayer => {
        if (prevPlayer.invincible) return prevPlayer;

        let newPlayer = { ...prevPlayer };

        enemies.forEach((enemy, index) => {
          if (!enemy.alive) return;

          if (checkCollision(
            newPlayer.x, newPlayer.y, newPlayer.width, newPlayer.height,
            enemy.x, enemy.y, enemy.width, enemy.height
          )) {
            if (newPlayer.velocityY > 0 && newPlayer.y + newPlayer.height < enemy.y + enemy.height / 2) {
              if (enemy.type === 'boss') {
                setEnemies(prev => prev.map((e, i) => {
                  if (i === index && e.health !== undefined) {
                    const newHealth = e.health - 1;
                    if (newHealth <= 0) {
                      setBossDefeated(true);
                      if (onBossDefeated) onBossDefeated();
                      const enemyModel = enemyModelsRef.current.get(e.id);
                      if (enemyModel && sceneRef.current) {
                        sceneRef.current.remove(enemyModel.group);
                      }
                      return { ...e, alive: false, health: 0 };
                    }
                    return { ...e, health: newHealth, retreatTimer: 30 };
                  }
                  return e;
                }));
              } else {
                setEnemies(prev => prev.map((e, i) => {
                  if (i === index) {
                    const enemyModel = enemyModelsRef.current.get(e.id);
                    if (enemyModel && sceneRef.current) {
                      sceneRef.current.remove(enemyModel.group);
                    }
                    return { ...e, alive: false };
                  }
                  return e;
                }));
              }
              newPlayer.velocityY = JUMP_FORCE / 2;
            } else {
              if (newPlayer.health !== undefined && newPlayer.health > 0) {
                newPlayer.health--;
                newPlayer.invincible = true;
                newPlayer.invincibleTimer = 90;
                newPlayer.velocityX = enemy.x > newPlayer.x ? -8 : 8;
                newPlayer.velocityY = -8;

                if (newPlayer.health <= 0) {
                  onGameOver();
                }
              }
            }
          }
        });

        return newPlayer;
      });

      const collectRadius = 32 * modifiers.collectRadius;
      setPowerUps(prevPowerUps => {
        return prevPowerUps.map(powerUp => {
          if (powerUp.collected) return powerUp;

          const playerCenterX = player.x + player.width / 2;
          const playerCenterY = player.y + player.height / 2;
          const powerUpCenterX = powerUp.x + 16;
          const powerUpCenterY = powerUp.y + 16;

          const distance = Math.sqrt(
            Math.pow(playerCenterX - powerUpCenterX, 2) +
            Math.pow(playerCenterY - powerUpCenterY, 2)
          );

          if (distance < collectRadius + 20) {
            worldBuilderRef.current?.removePowerUp(powerUp.id);

            setPlayer(prev => {
              switch (powerUp.type) {
                case 'coffee':
                  return { ...prev, hasCoffee: true, coffeeTimer: COFFEE_DURATION };
                case 'wifi':
                  return { ...prev, hasWifi: true };
                case 'networking':
                  return { ...prev, networkingCollected: prev.networkingCollected + 1 };
                case 'coin':
                  return { ...prev, coins: prev.coins + 1 };
                default:
                  return prev;
              }
            });
            return { ...powerUp, collected: true };
          }

          return powerUp;
        });
      });

      if (characterModelRef.current) {
        characterModelRef.current.animate(delta);
      }

      if (worldBuilderRef.current) {
        worldBuilderRef.current.animatePowerUps(delta);
        worldBuilderRef.current.updateMovingPlatforms(level.platforms, delta);
      }

      if (cameraRef.current && characterModelRef.current) {
        const targetX = characterModelRef.current.group.position.x;
        cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.1;
        cameraRef.current.position.y = 10;
        cameraRef.current.position.z = 40;
        cameraRef.current.lookAt(targetX, 0, 0);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [level, enemies, player, gameTime, checkCollision, onGameOver, onLevelComplete, onBossDefeated, modifiers, bossDefeated, bossArena]);

  const networkingTotal = level.powerUps.filter(p => p.type === 'networking').length;

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center">
      <GameHUD
        levelName={level.name}
        characterName={character.name}
        characterSprite={character.sprite}
        passiveName={character.passive.name}
        passiveIcon={character.passive.icon}
        networkingCollected={player.networkingCollected}
        networkingTotal={networkingTotal}
        hasCoffee={player.hasCoffee}
        coffeeTimer={player.coffeeTimer}
        hasWifi={player.hasWifi}
        canDoubleJump={player.canDoubleJump}
        hasDoubleJumped={player.hasDoubleJumped}
        isGrounded={player.isGrounded}
        onPause={onPause}
      />
      <div
        ref={containerRef}
        className="border-4 border-primary rounded-lg shadow-2xl"
        style={{ width: 800, height: 600 }}
      />
    </div>
  );
};

export default GameCanvas3D;
