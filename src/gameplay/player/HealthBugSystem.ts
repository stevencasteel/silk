import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent,
  KinematicVelocityComponent,
  HealthBugComponent,
  StickySurfaceComponent,
  ProjectileComponent,
  TraversalStateComponent,
  HealthComponent,
  CollisionResponseComponent,
  ParticleRequestComponent,
  InputIntentComponent,
  WallBugComponent
} from "../../core/ecs/Components";
import { ParallaxScrollSystem } from "../../visual/systems/ParallaxScrollSystem";
import { POST_PROCESSING_PRESETS, ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { HealthBugVisualFactory } from "../../visual/mesh/HealthBugVisualFactory";
import { WEB_SPLAT_STRATEGY } from "../juice/ParticleStrategies";
import { PlayerStateUtils } from "./states/PlayerStateUtils";
import * as BABYLON from "@babylonjs/core";

interface PooledBug {
  entityId: number;
  rootNode: BABYLON.TransformNode;
  active: boolean;
}

export class HealthBugSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  readonly initPhase = InitPhase.Gameplay;

  private spawnTimer = 0.0;
  private readonly spawnInterval = 1.5;
  private bugPool: PooledBug[] = [];
  private readonly POOL_SIZE = 2;

  private laneBag: number[] = [];
  private readonly LANES = [-5.0, -3.0, -1.0, 0.0, 1.0, 3.0, 5.0];
  private lastSelectedLaneIndex = -1;
  private lastSpawnedX = -999.0;

  private _tracker = new SubscriptionTracker();
  private activeHealParticles: { mesh: BABYLON.Mesh; life: number }[] = [];

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const bugId = this.context.world.create();
      
      const rootNode = HealthBugVisualFactory.buildBugMeshHierarchy(bugId, scene, "NORMAL");
      rootNode.setEnabled(false);
      rootNode.position.set(0, -999, 0);

      this.context.visualRegistration.registerTransformNode(bugId, rootNode);

      this.bugPool.push({
        entityId: bugId,
        rootNode,
        active: false
      });
    }

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.clearAll();
        this.spawnTimer = 0.0;
        this.laneBag = [];
        this.lastSelectedLaneIndex = -1;
        this.lastSpawnedX = -999.0;
      })
    );
  }

  public update(dt: number): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    this.spawnTimer += dt;
    const activeCount = this.bugPool.filter((p) => p.active).length;

    if (this.spawnTimer >= this.spawnInterval && activeCount < this.POOL_SIZE) {
      this.spawnTimer = 0.0;
      this.spawnBugFromPool();
    }

    // 1. Check collisions between Health Bugs
    this.checkHealthBugCollisions();

    // 2. Update individual bugs and Wall Bug spike collisions
    this.updateBugs(dt);
    this.updateSeekingParticles(dt);
  }

  private checkHealthBugCollisions(): void {
    const bugStore = this.context.stores.get<HealthBugComponent>("healthBug");
    const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
    
    for (let i = 0; i < this.bugPool.length; i++) {
      const pBugA = this.bugPool[i];
      if (!pBugA.active) continue;
      const bugA = bugStore.get(pBugA.entityId);
      if (!bugA) continue;

      for (let j = i + 1; j < this.bugPool.length; j++) {
        const pBugB = this.bugPool[j];
        if (!pBugB.active) continue;
        const bugB = bugStore.get(pBugB.entityId);
        if (!bugB) continue;

        const dx = bugB.x - bugA.x;
        const dy = bugB.y - bugA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const combinedRadius = 4.0; // radius 2.0 each

        if (dist < combinedRadius) {
          const isSpikedA = bugA.variant !== "NORMAL" && !bugA.spikesDisarmed;
          const isSpikedB = bugB.variant !== "NORMAL" && !bugB.spikesDisarmed;

          if (isSpikedA || isSpikedB) {
            this.popBug(pBugA.entityId);
            this.popBug(pBugB.entityId);
          } else {
            const overlap = combinedRadius - dist;
            const nx = dx / (dist || 1.0);
            const ny = dy / (dist || 1.0);

            bugA.x -= nx * overlap * 0.5;
            bugA.y -= ny * overlap * 0.5;
            bugB.x += nx * overlap * 0.5;
            bugB.y += ny * overlap * 0.5;

            bugA.preInfluenceX = bugA.x;
            bugA.preInfluenceY = bugA.y;
            bugB.preInfluenceX = bugB.x;
            bugB.preInfluenceY = bugB.y;

            const velA = velStore.get(pBugA.entityId);
            const velB = velStore.get(pBugB.entityId);
            if (velA && velB) {
              const kx = velA.x - velB.x;
              const ky = velA.y - velB.y;
              const p = kx * nx + ky * ny;
              if (p > 0) {
                const bounceElasticity = 0.85;
                velA.x -= nx * p * bounceElasticity;
                velA.y -= ny * p * bounceElasticity;
                velB.x += nx * p * bounceElasticity;
                velB.y += ny * p * bounceElasticity;
              }
            }
          }
        }
      }
    }
  }

  private updateBugs(dt: number): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    const cameraY = scene.activeCamera
      ? scene.activeCamera.position.y
      : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;

    const currentScrollSpeed = ParallaxScrollSystem.currentScrollSpeed;
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const bugStore = this.context.stores.get<HealthBugComponent>("healthBug");
    const stickyStore = this.context.stores.get<StickySurfaceComponent>("stickySurface");
    const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");

    const playerTrav = this.context.stores.get<TraversalStateComponent>("traversal").get(this.context.refs.player);
    const playerInput = this.context.stores.get<InputIntentComponent>("input").get(this.context.refs.player);
    const isPlayerTrapped = !!(playerTrav && playerTrav.isWebTrapped);

    for (let i = 0; i < this.bugPool.length; i++) {
      const pBug = this.bugPool[i];
      if (!pBug.active) continue;

      const bug = bugStore.get(pBug.entityId);
      const trans = transforms.get(pBug.entityId);
      const vel = velStore.get(pBug.entityId);
      const sticky = stickyStore.get(pBug.entityId);

      if (!bug || !trans || !vel || !sticky) continue;

      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      bug.rotorAngle = (bug.rotorAngle + Math.max(2.0, speed * 2.0) * dt) % (Math.PI * 2.0);

      const rotorsNode = pBug.rootNode.getChildren().find((c) => c.name.startsWith("health_bug_rotors"));
      if (rotorsNode instanceof BABYLON.TransformNode) {
        rotorsNode.rotation.y = bug.rotorAngle;
      }

      if (bug.y < cameraY - 32.0 || bug.y > cameraY + 36.0) {
        this.recycleBug(pBug);
        continue;
      }

      if (bug.isWebTrapped && bug.stuckToProjectileId !== undefined) {
        const projStore = this.context.stores.get<ProjectileComponent>("projectile");
        const proj = projStore.get(bug.stuckToProjectileId);
        const projTrans = transforms.get(bug.stuckToProjectileId);

        if (proj && proj.isActive && projTrans) {
          bug.x = projTrans.x;
          bug.y = projTrans.y;
          vel.x = 0;
          vel.y = 0;

          if (proj.isStuckOnWall || proj.isStuckToBug) {
            bug.isStuckOnWall = proj.isStuckOnWall;
            bug.isStuckToBug = !!proj.isStuckToBug;
            bug.stickyEntityId = proj.stickyEntityId;
            bug.stickyOffsetX = proj.stickyOffsetX;
            bug.stickyOffsetY = proj.stickyOffsetY;
          }
        } else {
          bug.isWebTrapped = false;
          bug.stuckToProjectileId = undefined;
          bug.state = "RECOVERING";
        }
      }

      if (bug.isStuckToBug && bug.stickyEntityId !== undefined) {
        const parentTrans = transforms.get(bug.stickyEntityId);
        if (parentTrans) {
          bug.x = parentTrans.x + (bug.stickyOffsetX || 0);
          bug.y = parentTrans.y + (bug.stickyOffsetY || 0);
        } else {
          this.recycleBug(pBug);
          continue;
        }
      } else if (bug.isStuckOnWall) {
        bug.y -= currentScrollSpeed * dt;
      }

      // --- IN-BOUND PLAYER CLING / STEERING LOGIC ---
      const isPlayerStickingToThis = 
        playerTrav && 
        playerTrav.state === "WALL_STICKING" && 
        playerTrav.stickyEntityId === pBug.entityId;

      if (isPlayerStickingToThis && playerInput) {
        const pushSpeedX = 6.0;
        const pushSpeedY = 7.0;

        if (isPlayerTrapped) {
          // Web-trapped steering: press left/right (away/towards) to direct
          if (playerInput.x !== 0) {
            bug.x = Math.max(-12.0, Math.min(12.0, bug.x + playerInput.x * pushSpeedX * dt));
          }
          if (playerInput.y > 0) {
            bug.y += pushSpeedY * dt;
          }
        } else {
          // Un-trapped steering: press towards to steer horizontally
          const isPushingTowards = playerInput.x === playerTrav.wallDir;
          if (isPushingTowards) {
            bug.x = Math.max(-12.0, Math.min(12.0, bug.x + playerInput.x * pushSpeedX * dt));
          }
          if (playerInput.y > 0) {
            bug.y += pushSpeedY * dt;
          }
        }

        bug.preInfluenceX = bug.x;
        bug.preInfluenceY = bug.y;
      }
      // ----------------------------------------------

      if (!bug.isWebTrapped && !bug.isStuckOnWall && !bug.isStuckToBug) {
        switch (bug.state) {
          case "FLYING_UP":
            vel.x = 0;
            vel.y = 4.5;
            bug.y += vel.y * dt;

            if (bug.y >= bug.pauseThresholdY) {
              bug.state = "PAUSED";
              bug.timer = 0.0;
              bug.pauseDuration = 3.0 + Math.random() * 3.0;
            }
            break;

          case "PAUSED": {
            vel.x = 0;
            vel.y = 0;
            bug.timer += dt;

            if (bug.timer >= bug.pauseDuration) {
              bug.state = "CONTINUING";
            }
            break;
          }

          case "CONTINUING":
            vel.x = 0;
            vel.y = 6.2;
            bug.y += vel.y * dt;
            break;

          case "SHOVED":
            vel.x *= Math.pow(0.92, dt * 60.0);
            vel.y *= Math.pow(0.92, dt * 60.0);
            bug.x += vel.x * dt;
            bug.y += vel.y * dt;

            if (Math.abs(vel.x) + Math.abs(vel.y) < 1.5) {
              bug.state = "RECOVERING";
              bug.timer = 0.0;
            }
            break;

          case "PINBALL": {
            vel.x *= Math.pow(0.98, dt * 60.0);
            vel.y *= Math.pow(0.98, dt * 60.0);
            bug.x += vel.x * dt;
            bug.y += vel.y * dt;

            const limitX = ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - 2.0;
            if (bug.x < -limitX) {
              bug.x = -limitX;
              vel.x *= -0.85;
              this.triggerPinballShake(0.5);
            } else if (bug.x > limitX) {
              bug.x = limitX;
              vel.x *= -0.85;
              this.triggerPinballShake(0.5);
            }

            if (Math.abs(vel.x) + Math.abs(vel.y) < 2.0) {
              bug.state = "RECOVERING";
              bug.timer = 0.0;
            }
            break;
          }

          case "SPINNING": {
            bug.timer += dt;
            const currentAngle = (bug.timer * 25.0) % (Math.PI * 2.0);
            
            const spinQuat = BABYLON.Quaternion.RotationYawPitchRoll(currentAngle, 0, 0);
            trans.qx = spinQuat.x;
            trans.qy = spinQuat.y;
            trans.qz = spinQuat.z;
            trans.qw = spinQuat.w;

            vel.x = 0;
            vel.y = -currentScrollSpeed;
            bug.y += vel.y * dt;

            if (bug.timer >= 1.5) {
              trans.qx = 0;
              trans.qy = 0;
              trans.qz = 0;
              trans.qw = 1;
              bug.state = "RECOVERING";
            }
            break;
          }

          case "RECOVERING": {
            const speedScale = 4.0;
            const dx = bug.preInfluenceX - bug.x;
            const dy = bug.preInfluenceY - bug.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 0.25) {
              bug.x = bug.preInfluenceX;
              bug.y = bug.preInfluenceY;
              bug.state = bug.preInfluenceState;
            } else {
              vel.x = (dx / distance) * speedScale;
              vel.y = (dy / distance) * speedScale;
              bug.x += vel.x * dt;
              bug.y += vel.y * dt;
            }
            break;
          }
        }
      }

      // Check collision with Wall Bug spikes for any active state
      const wallBugStore = this.context.stores.get<WallBugComponent>("wallBug");
      if (wallBugStore) {
        let hitWallBugSpikes = false;
        for (const [wBugId, wBug] of wallBugStore.entries()) {
          const wBugTrans = transforms.get(wBugId);
          if (!wBugTrans) continue;

          const halfW = wBug.width / 2;
          const halfH = wBug.height / 2;
          const bugRadius = 2.0;

          const overlapX = Math.abs(bug.x - wBugTrans.x) <= halfW + bugRadius;
          const overlapY = Math.abs(bug.y - wBugTrans.y) <= halfH + bugRadius;

          if (overlapX && overlapY) {
            const isLeft = bug.x < wBugTrans.x;
            const isRight = bug.x > wBugTrans.x;

            const hitSpikedLeft = wBug.spikedSide === "LEFT" && isLeft && !wBug.spikesDisarmed;
            const hitSpikedRight = wBug.spikedSide === "RIGHT" && isRight && !wBug.spikesDisarmed;

            if (hitSpikedLeft || hitSpikedRight) {
              hitWallBugSpikes = true;
              break;
            }
          }
        }

        if (hitWallBugSpikes) {
          this.popBug(pBug.entityId);
          continue;
        }
      }

      // Check collision with Boss (Weaver)
      const weaverTrans = transforms.get(this.context.refs.weaver);
      if (weaverTrans && (bug.state === "SHOVED" || bug.state === "PINBALL")) {
        const dx = bug.x - weaverTrans.x;
        const dy = bug.y - weaverTrans.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const combinedRadius = 2.0 + 4.4;

        if (dist < combinedRadius) {
          if (bug.state === "SHOVED") {
            if (bug.variant !== "NORMAL") {
              this.context.commands.dispatch({
                type: "DAMAGE_REQUEST",
                targetId: this.context.refs.weaver,
                amount: 15,
                source: "HEALTH_BUG_SPIKES"
              });
              this.popBug(pBug.entityId);
              continue;
            } else {
              const nx = dx / (dist || 1.0);
              const ny = dy / (dist || 1.0);
              vel.x = nx * 10.0;
              vel.y = ny * 10.0;
              bug.state = "RECOVERING";
            }
          } else if (bug.state === "PINBALL") {
            const isSpiked = bug.variant !== "NORMAL";
            const damage = isSpiked ? 35 : 20;
            this.context.commands.dispatch({
              type: "DAMAGE_REQUEST",
              targetId: this.context.refs.weaver,
              amount: damage,
              source: isSpiked ? "HEALTH_BUG_PINBALL_SPIKES" : "HEALTH_BUG_PINBALL"
            });
            this.popBug(pBug.entityId);
            continue;
          }
        }
      }

      trans.x = bug.x;
      trans.y = bug.y;
      pBug.rootNode.position.set(bug.x, bug.y, 1.5);
    }
  }

  private spawnBugFromPool(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    const pBug = this.bugPool.find((p) => !p.active);
    if (!pBug) return;

    const cameraY = scene.activeCamera
      ? scene.activeCamera.position.y
      : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;

    const startY = cameraY - 26.0;
    const startX = this.getNextLane();

    const variants: ("NORMAL" | "SPIKED_TOP" | "SPIKED_RIGHT" | "SPIKED_BOTTOM" | "SPIKED_LEFT")[] = [
      "NORMAL", "SPIKED_TOP", "SPIKED_RIGHT", "SPIKED_BOTTOM", "SPIKED_LEFT"
    ];
    const chosenVariant = variants[Math.floor(Math.random() * variants.length)];

    this.context.visualRegistration.unregisterTransformNode(pBug.entityId);
    pBug.rootNode.dispose();
    
    pBug.rootNode = HealthBugVisualFactory.buildBugMeshHierarchy(pBug.entityId, scene, chosenVariant);
    this.context.visualRegistration.registerTransformNode(pBug.entityId, pBug.rootNode);

    pBug.rootNode.position.set(startX, startY, 1.5);
    pBug.rootNode.setEnabled(true);

    this.context.stores.get<TransformComponent>("transform").add(pBug.entityId, {
      x: startX,
      y: startY,
      z: 1.5,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      prevX: startX,
      prevY: startY,
      prevZ: 1.5,
      prevQx: 0,
      prevQy: 0,
      prevQz: 0,
      prevQw: 1,
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      prevScaleX: 1.0,
      prevScaleY: 1.0,
      prevScaleZ: 1.0
    });

    const calculatedPauseY = cameraY - 4.0 + Math.random() * 12.0;

    this.context.stores.get<HealthBugComponent>("healthBug").add(pBug.entityId, {
      state: "FLYING_UP",
      variant: chosenVariant,
      timer: 0.0,
      pauseDuration: 3.0 + Math.random() * 3.0,
      x: startX,
      y: startY,
      preInfluenceX: startX,
      preInfluenceY: calculatedPauseY + 14.0,
      preInfluenceState: "CONTINUING",
      isWebTrapped: false,
      isStuckOnWall: false,
      isStuckToBug: false,
      spikesDisarmed: false,
      rotorAngle: 0.0,
      pauseThresholdY: calculatedPauseY
    });
    this.lastSpawnedX = startX;

    this.context.stores.get<StickySurfaceComponent>("stickySurface").add(pBug.entityId, {
      isActive: true, // Always active so player can stick to it!
      width: 4.0,
      height: 4.0,
      speed: 0.0
    });

    this.context.stores.get<KinematicVelocityComponent>("velocity").add(pBug.entityId, {
      x: 0,
      y: 4.5,
      z: 0
    });

    this.context.stores.get<CollisionResponseComponent>("collisionResponse").add(pBug.entityId, {
      layer: "HAZARD",
      onOverlap: (otherId, ctx) => {
        const sysCtx = ctx as SystemContext;
        this.handlePlayerOverlap(pBug.entityId, otherId, sysCtx);
      }
    });

    pBug.active = true;
  }

  private handlePlayerOverlap(bugId: number, playerId: number, ctx: SystemContext): void {
    const bug = ctx.stores.get<HealthBugComponent>("healthBug").get(bugId);
    const pTrans = ctx.stores.get<TransformComponent>("transform").get(playerId);
    const pTrav = ctx.stores.get<TraversalStateComponent>("traversal").get(playerId);
    const pVel = ctx.stores.get<KinematicVelocityComponent>("velocity").get(playerId);

    if (!bug || !pTrans || !pTrav || !pVel) return;

    // Skip hazard overlap entirely if player is already sticking to it
    if (pTrav.state === "WALL_STICKING" && pTrav.stickyEntityId === bugId) {
      return;
    }

    const isLaunching = pTrav.state === "LAUNCHING";
    const launchPower = pTrav.launchPower || 0;

    const isPlayerTrapped = pTrav.isWebTrapped;
    const isWebShieldActive = bug.isWebTrapped || isPlayerTrapped;

    const hitSpikes = bug.variant !== "NORMAL" && !bug.spikesDisarmed && !isWebShieldActive;

    // STAGE 3 (Extreme / Overloaded): Tension / launchPower >= 0.80
    if (isLaunching && launchPower >= 0.80) {
      if (hitSpikes) {
        bug.state = "SPINNING";
        bug.timer = 0.0;

        const knockbackX = (pTrans.x > bug.x ? 1 : -1) * 20.0;
        pVel.x = knockbackX;
        pVel.y = 8.0;
        pTrav.state = "AIRBORNE";

        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.85, duration: 0.35 });
        ctx.broker.publish(GameEvent.UI_SFX_ALARM, undefined);
      } else {
        this.popBug(bugId);
      }
      return;
    }

    // STAGE 2 (Active Fling): 0.555 <= Tension / launchPower < 0.80
    if (isLaunching && launchPower >= 0.555) {
      if (hitSpikes) {
        this.popBug(bugId);
      } else {
        bug.state = "PINBALL";
        const shoveX = (bug.x > pTrans.x ? 1 : -1) * 25.0;
        const shoveY = 12.0;

        const bugVel = ctx.stores.get<KinematicVelocityComponent>("velocity").get(bugId);
        if (bugVel) {
          bugVel.x = shoveX;
          bugVel.y = shoveY;
        }
        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.65, duration: 0.3 });
        ctx.broker.publish(GameEvent.UI_SFX_CONFIRM, undefined);
      }
      return;
    }

    // STAGE 0 & 1 (Safe slide, slack release, or non-flinging overlaps): launchPower < 0.555
    if (hitSpikes) {
      ctx.commands.dispatch({
        type: "DAMAGE_REQUEST",
        targetId: playerId,
        amount: 1,
        source: "HEALTH_BUG_SPIKES",
        knockbackX: (pTrans.x > bug.x ? 1 : -1) * 16.0,
        knockbackY: 8.0
      });
    } else {
      const input = ctx.stores.get<InputIntentComponent>("input").get(playerId);
      const bugWallDir = pTrans.x > bug.x ? -1 : 1; // if player is to the right, wall/bug is to their left (-1)
      const pressingIn = input && input.x === bugWallDir;

      if (pressingIn) {
        // Player is pressing towards the safe side of the bug -> Stick to it!
        PlayerStateUtils.applyWallImpactSquash(ctx);

        pTrav.state = "WALL_STICKING";
        pTrav.wallDir = bugWallDir;
        pTrav.wallNormalX = -bugWallDir;
        pTrav.stickyEntityId = bugId;
        
        const halfW = 2.0; // Health Bug half width
        pTrav.stickyWallX = bug.x + bugWallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);
        pTrav.stickyWallYOffset = pTrans.y - bug.y;

        pTrans.x = pTrav.stickyWallX;
        pVel.x = 0;
        pVel.y = -ParallaxScrollSystem.currentScrollSpeed;

        ctx.broker.publish(GameEvent.PLAYER_WALL_HIT, {
          x: pTrans.x,
          y: pTrans.y,
          wallNormalX: -bugWallDir
        });
      } else {
        // Not pressing in -> Safe shove!
        bug.state = "SHOVED";
        const bugVel = ctx.stores.get<KinematicVelocityComponent>("velocity").get(bugId);
        if (bugVel) {
          bugVel.x = (bug.x > pTrans.x ? 1 : -1) * 6.5;
          bugVel.y = 2.0;
        }
      }
    }
  }

  public popBug(bugId: number): void {
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const bugTrans = transforms.get(bugId);
    if (!bugTrans) return;

    const scene = this.context.visualQuery.getScene();
    if (scene) {
      const pCount = 8;
      for (let i = 0; i < pCount; i++) {
        const pMesh = BABYLON.MeshBuilder.CreateSphere(
          `heal_particle_${performance.now()}_${i}`,
          { diameter: 0.16, segments: 4 },
          scene
        );
        pMesh.position.set(bugTrans.x + (Math.random() - 0.5) * 0.5, bugTrans.y + (Math.random() - 0.5) * 0.5, 0);
        
        const pMat = new BABYLON.StandardMaterial(`heal_particle_mat_${i}`, scene);
        pMat.emissiveColor = new BABYLON.Color3(0.1, 0.95, 0.15);
        pMat.disableLighting = true;
        pMesh.material = pMat;

        this.activeHealParticles.push({
          mesh: pMesh,
          life: 1.0
        });
      }
    }

    const reqId = this.context.world.create();
    const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
    if (reqStore) {
      reqStore.add(reqId, {
        strategy: WEB_SPLAT_STRATEGY,
        x: bugTrans.x,
        y: bugTrans.y,
        z: 0
      });
    }

    this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, { x: bugTrans.x, y: bugTrans.y, isWall: false });
    this.context.broker.publish(GameEvent.UI_SFX_CONFIRM, undefined);

    const poolBug = this.bugPool.find((p) => p.entityId === bugId);
    if (poolBug) {
      this.recycleBug(poolBug);
    }
  }

  private updateSeekingParticles(dt: number): void {
    const targetX = -12.5;
    const targetY = 25.5;

    for (let i = this.activeHealParticles.length - 1; i >= 0; i--) {
      const p = this.activeHealParticles[i];
      p.life -= dt;

      const dx = targetX - p.mesh.position.x;
      const dy = targetY - p.mesh.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.35 || p.life <= 0) {
        if (dist < 0.35) {
          const healthStore = this.context.stores.get<HealthComponent>("health");
          const pHealth = healthStore.get(this.context.refs.player);
          if (pHealth && pHealth.current < pHealth.max) {
            pHealth.current = Math.min(pHealth.max, pHealth.current + 1);
            this.context.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
              hp: pHealth.current,
              maxHp: pHealth.max
            });
            this.context.broker.publish(GameEvent.UI_SFX_CONFIRM, undefined);
          }
        }
        p.mesh.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
        this.activeHealParticles.splice(i, 1);
      } else {
        const speed = 24.0;
        p.mesh.position.x += (dx / dist) * speed * dt;
        p.mesh.position.y += (dy / dist) * speed * dt;
      }
    }
  }

  private triggerPinballShake(mult: number): void {
    this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: 0.4 * mult,
      duration: 0.25 * mult
    });
  }

  private getNextLane(): number {
    if (this.laneBag.length === 0) {
      this.refillLaneBag();
    }
    
    let attemptIndex = -1;
    for (let i = this.laneBag.length - 1; i >= 0; i--) {
      const tempX = this.LANES[this.laneBag[i]];
      if (this.lastSpawnedX === -999.0 || Math.abs(tempX - this.lastSpawnedX) >= 4.0) {
        attemptIndex = i;
        break;
      }
    }

    if (attemptIndex !== -1) {
      const laneIndex = this.laneBag.splice(attemptIndex, 1)[0];
      this.lastSelectedLaneIndex = laneIndex;
      return this.LANES[laneIndex];
    }

    const laneIndex = this.laneBag.pop()!;
    this.lastSelectedLaneIndex = laneIndex;
    return this.LANES[laneIndex];
  }

  private refillLaneBag(): void {
    const indices = [0, 1, 2, 3, 4, 5, 6];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j];
      indices[j] = temp;
    }
    if (indices[indices.length - 1] === this.lastSelectedLaneIndex && indices.length > 1) {
      const temp = indices[indices.length - 1];
      indices[indices.length - 1] = indices[0];
      indices[0] = temp;
    }
    this.laneBag = indices;
  }

  private recycleBug(pBug: PooledBug): void {
    pBug.active = false;
    pBug.rootNode.setEnabled(false);
    pBug.rootNode.position.set(0, -999, 0);

    this.context.stores.get<HealthBugComponent>("healthBug").remove(pBug.entityId);
    this.context.stores.get<StickySurfaceComponent>("stickySurface").remove(pBug.entityId);
    this.context.stores.get<KinematicVelocityComponent>("velocity").remove(pBug.entityId);
    this.context.stores.get<CollisionResponseComponent>("collisionResponse").remove(pBug.entityId);

    const trans = this.context.stores.get<TransformComponent>("transform").get(pBug.entityId);
    if (trans) {
      trans.x = 0;
      trans.y = -999;
      trans.prevX = 0;
      trans.prevY = -999;
    }
  }

  private clearAll(): void {
    for (let i = 0; i < this.bugPool.length; i++) {
      this.recycleBug(this.bugPool[i]);
    }
    this.spawnTimer = 0.0;

    this.activeHealParticles.forEach((p) => {
      p.mesh.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    });
    this.activeHealParticles = [];
  }

  public dispose(): void {
    this._tracker.clear();
    this.clearAll();
    for (let i = 0; i < this.bugPool.length; i++) {
      this.context.visualRegistration.unregisterTransformNode(this.bugPool[i].entityId);
    }
    this.bugPool = [];
  }
}
