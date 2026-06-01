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
  ParticleRequestComponent,
  InputIntentComponent,
  WallBugComponent,
  SpikeBugComponent
} from "../../core/ecs/Components";
import { POST_PROCESSING_PRESETS, ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { WEB_SPLAT_STRATEGY } from "../juice/ParticleStrategies";
import { PlayerStateUtils } from "./states/PlayerStateUtils";
import { HealthBugPool } from "./HealthBugPool";
import * as BABYLON from "@babylonjs/core";

export class HealthBugSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  readonly initPhase = InitPhase.Gameplay;

  private pool!: HealthBugPool;
  private spawnTimer = 0.0;
  private readonly spawnInterval = 1.5;
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

    this.pool = new HealthBugPool(this.context, scene, (bugId, otherId) => {
      this.handlePlayerOverlap(bugId, otherId);
    });

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.clearAll();
        this.spawnTimer = 0.0;
        this.laneBag = [];
        this.lastSelectedLaneIndex = -1;
        this.lastSpawnedX = -999.0;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.clearAll();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_WIN, () => {
        this.clearAll();
      })
    );
  }

  public update(dt: number): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    const healthStore = this.context.stores.get<HealthComponent>("health");
    const wHealth = healthStore.get(this.context.refs.weaver);

    const isSpawningEnabled = this.context.runtime.healthBugsSpawningAllowed &&
      this.context.runtime.weaverDamageCount >= 0 &&
      wHealth &&
      wHealth.current > 0;

    if (isSpawningEnabled) {
      this.spawnTimer += dt;
      const activeCount = this.pool.getActiveBugs().filter((p) => p.active).length;

      if (this.spawnTimer >= this.spawnInterval && activeCount < this.POOL_SIZE) {
        this.spawnTimer = 0.0;
        this.spawnBugFromPool();
      }
    }

    this.checkHealthBugCollisions();
    this.updateBugs(dt);
    this.updateSeekingParticles(dt);
  }

  private checkHealthBugCollisions(): void {
    const bugStore = this.context.stores.get<HealthBugComponent>("healthBug");
    const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
    const activeBugs = this.pool.getActiveBugs();

    for (let i = 0; i < activeBugs.length; i++) {
      const pBugA = activeBugs[i];
      if (!pBugA.active) continue;
      const bugA = bugStore.get(pBugA.entityId);
      if (!bugA) continue;

      for (let j = i + 1; j < activeBugs.length; j++) {
        const pBugB = activeBugs[j];
        if (!pBugB.active) continue;
        const bugB = bugStore.get(pBugB.entityId);
        if (!bugB) continue;

        const dx = bugB.x - bugA.x;
        const dy = bugB.y - bugA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const combinedRadius = 4.0;

        if (dist < combinedRadius) {
          const isSpikedA = bugA.variant !== "NORMAL" && !bugA.spikesDisarmed;
          const isSpikedB = bugB.variant !== "NORMAL" && !bugB.spikesDisarmed;

          if (isSpikedA || isSpikedB) {
            this.popBug(pBugA.entityId, true);
            this.popBug(pBugB.entityId, true);
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

    const currentScrollSpeed = this.context.runtime.currentScrollSpeed;
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const bugStore = this.context.stores.get<HealthBugComponent>("healthBug");
    const stickyStore = this.context.stores.get<StickySurfaceComponent>("stickySurface");
    const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");

    const playerTrav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const playerInput = this.context.stores
      .get<InputIntentComponent>("input")
      .get(this.context.refs.player);
    const isPlayerTrapped = !!(playerTrav && playerTrav.isWebTrapped);

    const activeBugs = this.pool.getActiveBugs();

    for (let i = 0; i < activeBugs.length; i++) {
      const pBug = activeBugs[i];
      if (!pBug.active) continue;

      const bug = bugStore.get(pBug.entityId);
      const trans = transforms.get(pBug.entityId);
      const vel = velStore.get(pBug.entityId);
      const sticky = stickyStore.get(pBug.entityId);

      if (!bug || !trans || !vel || !sticky) continue;

      if (bug.state === "DEAD") {
        this.popBug(pBug.entityId, false);
        continue;
      }

      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      bug.rotorAngle = (bug.rotorAngle + Math.max(2.0, speed * 2.0) * dt) % (Math.PI * 2.0);

      const rotorsNode = pBug.rootNode
        .getChildren()
        .find((c) => c.name.startsWith("health_bug_rotors"));
      if (rotorsNode instanceof BABYLON.TransformNode) {
        rotorsNode.rotation.y = bug.rotorAngle;
      }

      if (bug.y < cameraY - 32.0 || bug.y > cameraY + 36.0) {
        this.pool.release(pBug.entityId);
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
          this.pool.release(pBug.entityId);
          continue;
        }
      } else if (bug.isStuckOnWall) {
        bug.y -= currentScrollSpeed * dt;
      }

      const isPlayerStickingToThis =
        playerTrav &&
        playerTrav.state === "WALL_STICKING" &&
        playerTrav.stickyEntityId === pBug.entityId;

      if (isPlayerStickingToThis && playerInput) {
        const pushSpeedX = 6.0;
        const pushSpeedY = 7.0;

        if (isPlayerTrapped) {
          if (playerInput.x !== 0) {
            bug.x = Math.max(-12.0, Math.min(12.0, bug.x + playerInput.x * pushSpeedX * dt));
          }
          if (playerInput.y > 0) {
            bug.y += pushSpeedY * dt;
          }
        } else {
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

      if (!bug.isWebTrapped && !bug.isStuckOnWall && !bug.isStuckToBug) {
        switch (bug.state) {
          case "FLYING_UP": {
            const targetVelY = 4.5;
            vel.x += (0 - vel.x) * (1.0 - Math.exp(-dt * 8.0));
            vel.y += (targetVelY - vel.y) * (1.0 - Math.exp(-dt * 8.0));
            bug.x += vel.x * dt;
            bug.y += vel.y * dt;

            if (bug.y >= bug.pauseThresholdY) {
              bug.state = "PAUSED";
              bug.timer = 0.0;
              bug.pauseDuration = 3.0 + Math.random() * 3.0;
            }
            break;
          }

          case "PAUSED": {
            vel.x += (0 - vel.x) * (1.0 - Math.exp(-dt * 12.0));
            vel.y += (0 - vel.y) * (1.0 - Math.exp(-dt * 12.0));
            bug.x += vel.x * dt;
            bug.y += vel.y * dt;
            bug.timer += dt;

            if (bug.timer >= bug.pauseDuration) {
              bug.state = "CONTINUING";
            }
            break;
          }

          case "CONTINUING": {
            const targetVelY = 6.2;
            vel.x += (0 - vel.x) * (1.0 - Math.exp(-dt * 8.0));
            vel.y += (targetVelY - vel.y) * (1.0 - Math.exp(-dt * 8.0));
            bug.x += vel.x * dt;
            bug.y += vel.y * dt;
            break;
          }

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
            const distance = Math.sqrt(dx * dx + dy * dy) || 1.0;

            if (distance < 0.25) {
              bug.x = bug.preInfluenceX;
              bug.y = bug.preInfluenceY;
              bug.state = bug.preInfluenceState;
            } else {
              const targetVelX = (dx / distance) * speedScale;
              const targetVelY = (dy / distance) * speedScale;
              vel.x += (targetVelX - vel.x) * (1.0 - Math.exp(-dt * 6.0));
              vel.y += (targetVelY - vel.y) * (1.0 - Math.exp(-dt * 6.0));
              bug.x += vel.x * dt;
              bug.y += vel.y * dt;
            }
            break;
          }
        }
      }

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
          this.popBug(pBug.entityId, true);
          continue;
        }
      }

      const spikeBugStore = this.context.stores.get<SpikeBugComponent>("spikeBug");
      if (spikeBugStore) {
        let hitSpikeBugSpikes = false;
        for (const [sbId, sb] of spikeBugStore.entries()) {
          const sbTrans = transforms.get(sbId);
          if (!sbTrans) continue;

          const halfW = sb.width / 2;
          const halfH = sb.height / 2;
          const bugRadius = 2.0;

          const overlapX = Math.abs(bug.x - sbTrans.x) <= halfW + bugRadius;
          const overlapY = Math.abs(bug.y - sbTrans.y) <= halfH + bugRadius;

          if (overlapX && overlapY) {
            if (!sb.spikesDisarmed) {
              hitSpikeBugSpikes = true;
              break;
            }
          }
        }

        if (hitSpikeBugSpikes) {
          this.popBug(pBug.entityId, true);
          continue;
        }
      }

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
              this.popBug(pBug.entityId, true);
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
            this.popBug(pBug.entityId, isSpiked);
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

    const cameraY = scene.activeCamera
      ? scene.activeCamera.position.y
      : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;

    const startY = cameraY - 28.0;

    const activeUpMinions = [];
    const transforms = this.context.stores.get<TransformComponent>("transform");
    
    const hBugStore = this.context.stores.get<HealthBugComponent>("healthBug");
    if (hBugStore) {
      for (const [id, hBug] of hBugStore.entries()) {
        const trans = transforms.get(id);
        if (trans && hBug.state !== "DEAD" && trans.y < cameraY - 10.0) {
          activeUpMinions.push({ x: trans.x, y: trans.y });
        }
      }
    }

    const spikeBugStore = this.context.stores.get<SpikeBugComponent>("spikeBug");
    if (spikeBugStore) {
      for (const [id] of spikeBugStore.entries()) {
        const trans = transforms.get(id);
        if (trans && trans.y < cameraY - 10.0) {
          activeUpMinions.push({ x: trans.x, y: trans.y });
        }
      }
    }

    let startX = this.getNextLane();
    if (activeUpMinions.length > 0) {
      let maxMinDist = -1;
      let safestX = startX;

      for (let i = 0; i < this.LANES.length; i++) {
        const laneX = this.LANES[i];
        let minDist = Infinity;
        for (let j = 0; j < activeUpMinions.length; j++) {
          const dist = Math.abs(laneX - activeUpMinions[j].x);
          if (dist < minDist) {
            minDist = dist;
          }
        }
        if (minDist > maxMinDist) {
          maxMinDist = minDist;
          safestX = laneX;
        }
      }

      if (maxMinDist >= 1.5) {
        startX = safestX;
        const laneIndex = this.LANES.indexOf(startX);
        if (laneIndex !== -1) {
          const bagIdx = this.laneBag.indexOf(laneIndex);
          if (bagIdx !== -1) {
            this.laneBag.splice(bagIdx, 1);
          }
        }
        this.lastSelectedLaneIndex = laneIndex;
      }
    }

    const isSpikedAllowed = this.context.runtime.weaverDamageCount >= 2;
    const variants: ("NORMAL" | "SPIKED_TOP" | "SPIKED_RIGHT" | "SPIKED_BOTTOM" | "SPIKED_LEFT")[] = isSpikedAllowed
      ? ["NORMAL", "SPIKED_TOP", "SPIKED_RIGHT", "SPIKED_BOTTOM", "SPIKED_LEFT"]
      : ["NORMAL"];

    const chosenVariant = variants[Math.floor(Math.random() * variants.length)];
    const calculatedPauseY = cameraY - 4.0 + Math.random() * 12.0;

    const bugId = this.pool.acquire(startX, startY, calculatedPauseY, chosenVariant);
    if (bugId !== -1) {
      this.lastSpawnedX = startX;
    }
  }

  private handlePlayerOverlap(bugId: number, playerId: number): void {
    const bug = this.context.stores.get<HealthBugComponent>("healthBug").get(bugId);
    const pTrans = this.context.stores.get<TransformComponent>("transform").get(playerId);
    const pTrav = this.context.stores.get<TraversalStateComponent>("traversal").get(playerId);
    const pVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(playerId);

    if (!bug || !pTrans || !pTrav || !pVel) return;

    if (pTrav.state === "WALL_STICKING" && pTrav.stickyEntityId === bugId) {
      return;
    }

    const isLaunching = pTrav.state === "LAUNCHING";
    const launchPower = pTrav.launchPower || 0;

    const isPlayerTrapped = pTrav.isWebTrapped;
    const isWebShieldActive = bug.isWebTrapped || isPlayerTrapped;

    const hitSpikes = bug.variant !== "NORMAL" && !bug.spikesDisarmed && !isWebShieldActive;

    if (hitSpikes) {
      this.context.commands.dispatch({
        type: "DAMAGE_REQUEST",
        targetId: playerId,
        amount: 1,
        source: "HEALTH_BUG_SPIKES",
        knockbackX: (pTrans.x > bug.x ? 1 : -1) * 16.0,
        knockbackY: 8.0
      });
    }

    if (isLaunching && launchPower >= 0.8) {
      this.popBug(bugId, hitSpikes);
      return;
    }

    if (isLaunching && launchPower >= 0.555) {
      bug.state = "PINBALL";
      const shoveX = (bug.x > pTrans.x ? 1 : -1) * 25.0;
      const shoveY = 12.0;

      const bugVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(bugId);
      if (bugVel) {
        bugVel.x = shoveX;
        bugVel.y = shoveY;
      }
      this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
        amplitude: 0.65,
        duration: 0.3
      });
      return;
    }

    if (hitSpikes) {
      return;
    }

    const input = this.context.stores.get<InputIntentComponent>("input").get(playerId);
    const bugWallDir = pTrans.x > bug.x ? -1 : 1;
    const pressingIn = input && input.x === bugWallDir;

    if (pressingIn) {
      PlayerStateUtils.applyWallImpactSquash(this.context);

      pTrav.state = "WALL_STICKING";
      pTrav.wallDir = bugWallDir;
      pTrav.wallNormalX = -bugWallDir;
      pTrav.stickyEntityId = bugId;

      const halfW = 2.0;
      pTrav.stickyWallX = bug.x + bugWallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);
      pTrav.stickyWallYOffset = pTrans.y - bug.y;

      pTrans.x = pTrav.stickyWallX;
      pVel.x = 0;
      pVel.y = -this.context.runtime.currentScrollSpeed;

      this.context.broker.publish(GameEvent.PLAYER_WALL_HIT, {
        x: pTrans.x,
        y: pTrans.y,
        wallNormalX: -bugWallDir
      });
    } else {
      bug.state = "SHOVED";
      const bugVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(bugId);
      if (bugVel) {
        bugVel.x = (bug.x > pTrans.x ? 1 : -1) * 6.5;
        bugVel.y = 2.0;
      }
    }
  }

  public popBug(bugId: number, bySpikes: boolean = false): void {
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
        pMesh.position.set(
          bugTrans.x + (Math.random() - 0.5) * 0.5,
          bugTrans.y + (Math.random() - 0.5) * 0.5,
          0
        );

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

    this.context.broker.publish(GameEvent.HEALTH_BUG_RUPTURED, { bySpikes });

    this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
      x: bugTrans.x,
      y: bugTrans.y,
      isWall: false
    });

    this.pool.release(bugId);
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

  private clearAll(): void {
    if (this.pool) this.pool.reset();
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
    if (this.pool) this.pool.dispose();
  }
}
