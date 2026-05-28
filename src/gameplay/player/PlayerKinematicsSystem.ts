import { getWeaverStingerTip, getDistance2D } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TetherComponent,
  KinematicTargetComponent,
  TraversalStateComponent,
  TransformComponent,
  InputIntentComponent,
  HealthComponent,
  KinematicVelocityComponent,
  WallBugComponent
} from "../../core/ecs/Components";
import { ParallaxScrollSystem } from "../../visual/systems/ParallaxScrollSystem";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";
import { ARENA_CONFIG, CANONICAL_UNITS, GAMEPLAY_TUNING, POST_PROCESSING_PRESETS } from "../../core/engine/ArenaConfig";

export class PlayerKinematicsSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private readonly GRAVITY = CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC;
  private readonly WALL_LIMIT_X = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;

  private lastTraversalState: string = "";
  private tensionPayload = { tension: 0.0 };
  private lengthPayload = { length: 0.0, maxLength: 0.0 };

  private lastCameraYOffset = 0.0;
  private wasWallSliding = false;

  constructor(private context: SystemContext) {}

  public init(): void {
    this.context.commands.register<ApplyImpulseCommand>(
      "APPLY_IMPULSE",
      (cmd: ApplyImpulseCommand) => {
        if (cmd.entityId === this.context.refs.player) {
          const vel = this.context.stores
            .get<KinematicVelocityComponent>("velocity")
            .get(this.context.refs.player);
          if (vel) {
            vel.x += cmd.x;
            vel.y += cmd.y;
          }
        }
      }
    );

    this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.lastCameraYOffset = 0.0;
      this.wasWallSliding = false;
    });
  }

  public update(dt: number): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const target = this.context.stores
      .get<KinematicTargetComponent>("target")
      .get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const wTrans = this.context.stores
      .get<TransformComponent>("transform")
      .get(this.context.refs.weaver);
    const input = this.context.stores
      .get<InputIntentComponent>("input")
      .get(this.context.refs.player);
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);

    if (!tether || !target || !trav || !wTrans || !input || !vel) return;

    const pHealth = this.context.stores
      .get<HealthComponent>("health")
      .get(this.context.refs.player);
    const wHealth = this.context.stores
      .get<HealthComponent>("health")
      .get(this.context.refs.weaver);

    if ((pHealth && pHealth.current <= 0) || (wHealth && wHealth.current <= 0)) {
      vel.x = 0;
      vel.y = 0;
      return;
    }

    const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
    const tipWorld = getWeaverStingerTip(
      wTrans.x,
      wTrans.y,
      wTrans.z,
      wTrans.qx,
      wTrans.qy,
      wTrans.qz,
      wTrans.qw,
      radius,
      1.18
    );
    tether.anchorX = tipWorld.x;
    tether.anchorY = tipWorld.y;
    tether.anchorZ = tipWorld.z;

    tether.currentLength = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    const reelConfig = GAMEPLAY_TUNING.REEL;
    const isWallSliding = trav.state === "WALL_SLIDING";

    if (input.y > 0 && !isWallSliding) {
      tether.desiredLength -= reelConfig.IN_SPEED * dt;
      tether.reelHeat = Math.min(1.0, tether.reelHeat + dt * 1.2);
    } else if (input.y < 0 && !isWallSliding) {
      tether.desiredLength += reelConfig.OUT_SPEED * dt;
      tether.reelHeat = Math.max(0.0, tether.reelHeat - dt * 1.5);
    } else {
      tether.reelHeat = Math.max(0.0, tether.reelHeat - dt * 0.8);
      const AUTO_SLACK_MARGIN = 2.0;
      tether.desiredLength = Math.min(
        tether.desiredLength,
        tether.currentLength + AUTO_SLACK_MARGIN
      );
    }
    tether.desiredLength = Math.max(
      reelConfig.MIN_LENGTH,
      Math.min(reelConfig.MAX_LENGTH, tether.desiredLength)
    );

    let easeSpeed = 0;
    if (tether.maxLength > tether.desiredLength) {
      const resistance = Math.max(0.1, 1.0 - tether.tension);
      easeSpeed = reelConfig.IN_SPEED * resistance;
      tether.reelVelocity = -easeSpeed;
    } else if (tether.maxLength < tether.desiredLength) {
      easeSpeed = reelConfig.OUT_SPEED;
      tether.reelVelocity = easeSpeed;
    } else {
      tether.reelVelocity = 0;
    }

    const maxDelta = easeSpeed * dt;
    if (Math.abs(tether.maxLength - tether.desiredLength) <= maxDelta) {
      tether.maxLength = tether.desiredLength;
    } else {
      tether.maxLength += Math.sign(tether.desiredLength - tether.maxLength) * maxDelta;
    }

    let nextX = target.x;
    let nextY = target.y;

    const tuning = GAMEPLAY_TUNING.PLAYER;

    if (trav.state === "LAUNCHING") {
      trav.launchTimer -= dt;
      vel.x += input.x * tuning.LAUNCH_STEER_FORCE * dt;
      vel.y += this.GRAVITY * tuning.LAUNCH_GRAVITY_MULT * dt;

      const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      vel.x *= damp;
      vel.y *= damp;

      nextX += vel.x * dt;
      nextY += vel.y * dt;

      if (trav.launchTimer <= 0) {
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
      }
    } else {
      vel.y += this.GRAVITY * dt;

      if (trav.state === "AIRBORNE") {
        vel.x += input.x * tuning.SWING_STEER_FORCE * dt;
        if (input.y > 0 && tether.isAttached) {
          const dxVal = tether.anchorX - target.x;
          const dyVal = tether.anchorY - target.y;
          const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);
          const pullForce = 15.0;
          vel.x += (dxVal / dist) * pullForce * dt;
          vel.y += (dyVal / dist) * pullForce * dt;
        }
      }

      const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      vel.x *= damp;
      vel.y *= damp;

      nextX += vel.x * dt;
      nextY += vel.y * dt;
    }

    this.resolveWallContact(nextX, nextY, dt, target, vel, tether, trav, input);

    if (trav.state === "AIRBORNE" || trav.state === "LAUNCHING") {
      this.enforcePendulumConstraint(target, vel, tether);
    }

    tether.currentLength = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    this.updateTensionMeter(dt, tether, trav, input);

    this.tensionPayload.tension = tether.tension;
    this.context.broker.publish(GameEvent.TETHER_TENSION_CHANGE, this.tensionPayload);

    this.lengthPayload.length = tether.currentLength;
    this.lengthPayload.maxLength = tether.maxLength;
    this.context.broker.publish(GameEvent.TETHER_LENGTH_CHANGE, this.lengthPayload);

    if (trav.state !== this.lastTraversalState) {
      this.lastTraversalState = trav.state;
      this.context.broker.publish(GameEvent.PLAYER_STATE_CHANGE, { 
        state: trav.state,
        launchPower: trav.launchPower
      });
    }
  }

  private applyWallImpactSquash(pTrans: TransformComponent): void {
    pTrans.scaleX = 0.72;
    pTrans.scaleY = 1.22;
    pTrans.scaleZ = 1.0;
    pTrans.scaleVelX = 0;
    pTrans.scaleVelY = 0;
    pTrans.scaleVelZ = 0;
  }

  private resolveWallContact(
    nextX: number,
    nextY: number,
    dt: number,
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    tether: TetherComponent,
    trav: TraversalStateComponent,
    input: InputIntentComponent
  ): void {
    const hitRight = nextX > this.WALL_LIMIT_X;
    const hitLeft = nextX < -this.WALL_LIMIT_X;
    const wallDir = hitRight ? 1 : hitLeft ? -1 : 0;
    const currentScrollSpeed = ParallaxScrollSystem.currentScrollSpeed;
    const reelConfig = GAMEPLAY_TUNING.REEL;

    const scene = this.context.visualRegistry.getScene();
    const defaultCameraY = POST_PROCESSING_PRESETS.CAMERA.DEFAULT_POS.y;
    const cameraY = scene && scene.activeCamera ? scene.activeCamera.position.y : defaultCameraY;
    const cameraYOffset = cameraY - defaultCameraY;

    if (trav.state === "WALL_SLIDING" && trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1) {
      const bugStore = this.context.stores.get<WallBugComponent>("wallBug");
      const bug = bugStore.get(trav.stickyEntityId);
      const bugTransStore = this.context.stores.get<TransformComponent>("transform");
      const bugTrans = bugTransStore.get(trav.stickyEntityId);

      if (!bug || bug.state === "INACTIVE" || !bugTrans || trav.stickyWallYOffset === undefined) {
        trav.state = "AIRBORNE";
        trav.stickyEntityId = -1;
        trav.wallDir = 0;
        this.wasWallSliding = false;
      } else {
        const stillPressingIn = input.x === trav.wallDir;
        if (!stillPressingIn) {
          this.triggerFling(vel, tether, target, trav);
          this.wasWallSliding = false;
          this.lastCameraYOffset = cameraYOffset;
          return;
        }

        const halfW = bug.width / 2;
        const halfH = bug.height / 2;

        target.x = bugTrans.x - trav.wallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);

        let slideSpeed = 0.0;
        if (input.y > 0) {
          slideSpeed = 5.0;
        } else if (input.y < 0) {
          slideSpeed = -5.0;
        }
        trav.stickyWallYOffset += slideSpeed * dt;
        trav.stickyWallYOffset = Math.max(-halfH, Math.min(halfH, trav.stickyWallYOffset));

        const finalY = bugTrans.y + trav.stickyWallYOffset;
        const requiredLength = getDistance2D(target.x, finalY, tether.anchorX, tether.anchorY);

        if (input.y <= 0 && requiredLength > tether.maxLength) {
          const maxAllowed = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
          if (tether.maxLength < maxAllowed) {
            tether.maxLength = Math.min(maxAllowed, requiredLength);
            tether.desiredLength = Math.max(tether.desiredLength, tether.maxLength);
          }
        }
        target.y = finalY;

        vel.x = 0;
        vel.y = -(currentScrollSpeed + bug.speed - slideSpeed);

        const speedScale = 1.0 + (bug.speed / Math.max(1.0, currentScrollSpeed));
        const tensionDelta = reelConfig.WALL_SLIDE_PASSIVE_TENSION_RATE * speedScale;
        tether.tension += tensionDelta * dt;

        const TENSION_STRETCH_RANGE = 2.0;
        const stretch = Math.max(0, requiredLength - tether.maxLength);
        const stretchRatio = stretch / TENSION_STRETCH_RANGE;
        tether.tension += stretchRatio * dt;

        this.wasWallSliding = true;
      }
      this.lastCameraYOffset = cameraYOffset;
      return;
    }

    if (trav.state === "WALL_SLIDING" && (trav.stickyEntityId === undefined || trav.stickyEntityId === -1)) {
      const stillPressingIn = input.x === trav.wallDir;

      if (stillPressingIn === false) {
        this.triggerFling(vel, tether, target, trav);
        this.wasWallSliding = false;
        this.lastCameraYOffset = cameraYOffset;
        return;
      }

      target.x = trav.wallDir * this.WALL_LIMIT_X;
      vel.x = 0;
      vel.y = -currentScrollSpeed;

      let cameraDeltaY = 0;
      if (this.wasWallSliding) {
        cameraDeltaY = cameraYOffset - this.lastCameraYOffset;
      }

      const finalY = target.y + vel.y * dt + cameraDeltaY;
      const requiredLength = getDistance2D(target.x, finalY, tether.anchorX, tether.anchorY);

      if (input.y <= 0 && requiredLength > tether.maxLength) {
        const maxAllowed = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
        if (tether.maxLength < maxAllowed) {
          tether.maxLength = Math.min(maxAllowed, requiredLength);
          tether.desiredLength = Math.max(tether.desiredLength, tether.maxLength);
        }
      }
      target.y = finalY;
      this.wasWallSliding = true;
      this.lastCameraYOffset = cameraYOffset;
      return;
    }

    const bugStore = this.context.stores.get<WallBugComponent>("wallBug");
    const bugTransStore = this.context.stores.get<TransformComponent>("transform");
    if (bugStore) {
      for (const [bugId, bug] of bugStore.entries()) {
        if (bug.state === "INACTIVE") continue;
        const bugTrans = bugTransStore.get(bugId);
        if (!bugTrans) continue;

        const halfW = bug.width / 2;
        const halfH = bug.height / 2;

        const distToBugX = nextX - bugTrans.x;
        const contactDist = halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS + 0.15;

        if (Math.abs(distToBugX) <= contactDist) {
          if (nextY >= bugTrans.y - halfH && nextY <= bugTrans.y + halfH) {
            const bugWallDir = distToBugX > 0 ? -1 : 1;
            const pressingIn = input.x === bugWallDir;

            if (pressingIn) {
              const transforms = this.context.stores.get<TransformComponent>("transform");
              const pTrans = transforms.get(this.context.refs.player);

              if (pTrans) {
                this.applyWallImpactSquash(pTrans);
              }

              trav.state = "WALL_SLIDING";
              trav.wallDir = bugWallDir;
              trav.wallNormalX = -bugWallDir;
              trav.wallNormalY = 0;
              trav.stickyEntityId = bugId;
              trav.stickyWallX = bugTrans.x + bugWallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);
              trav.stickyWallYOffset = nextY - bugTrans.y;

              target.x = trav.stickyWallX;
              target.y = nextY;
              vel.x = 0;
              vel.y = -(currentScrollSpeed + bug.speed);
              this.wasWallSliding = true;

              this.context.broker.publish(GameEvent.PLAYER_WALL_HIT, {
                x: target.x,
                y: target.y,
                wallNormalX: -bugWallDir
              });
              this.lastCameraYOffset = cameraYOffset;
              return;
            }
          }
        }
      }
    }

    if (wallDir !== 0) {
      const pressingIn = input.x === wallDir;

      if (pressingIn) {
        const transforms = this.context.stores.get<TransformComponent>("transform");
        const pTrans = transforms.get(this.context.refs.player);
        this.context.broker.publish(GameEvent.PLAYER_WALL_HIT, {
          x: target.x,
          y: target.y,
          wallNormalX: -wallDir
        });

        if (pTrans) {
          this.applyWallImpactSquash(pTrans);
        }
        trav.state = "WALL_SLIDING";
        trav.wallDir = wallDir;
        trav.wallNormalX = -wallDir;
        trav.wallNormalY = 0;
        trav.stickyEntityId = -1;

        target.x = wallDir * this.WALL_LIMIT_X;
        vel.x = 0;
        vel.y = -currentScrollSpeed;

        let cameraDeltaY = 0;
        if (this.wasWallSliding) {
          cameraDeltaY = cameraYOffset - this.lastCameraYOffset;
        }

        const finalY = target.y + vel.y * dt + cameraDeltaY;
        const requiredLength = getDistance2D(target.x, finalY, tether.anchorX, tether.anchorY);

        if (input.y <= 0 && requiredLength > tether.maxLength) {
          const maxAllowed = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
          if (tether.maxLength < maxAllowed) {
            tether.maxLength = Math.min(maxAllowed, requiredLength);
            tether.desiredLength = Math.max(tether.desiredLength, tether.maxLength);
          }
        }
        target.y = finalY;
        this.wasWallSliding = true;
      } else {
        target.x = wallDir * this.WALL_LIMIT_X;
        target.y = nextY;
        if (Math.sign(vel.x) === wallDir) {
          vel.x *= -0.2;
        }
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
        this.wasWallSliding = false;
      }
      this.lastCameraYOffset = cameraYOffset;
      return;
    }

    if (trav.state !== "LAUNCHING") {
      trav.state = "AIRBORNE";
    }
    trav.wallDir = 0;
    target.x = nextX;
    target.y = nextY;
    this.wasWallSliding = false;
    this.lastCameraYOffset = cameraYOffset;
  }

  private triggerFling(
    vel: KinematicVelocityComponent,
    tether: TetherComponent,
    target: KinematicTargetComponent,
    trav: TraversalStateComponent
  ): void {
    const storedTension = tether.tension;
    tether.tension = 0.0;
    const tuning = GAMEPLAY_TUNING.PLAYER;
    const reelConfig = GAMEPLAY_TUNING.REEL;

    trav.stickyEntityId = -1;

    if (storedTension < tuning.MIN_FLING_TENSION) {
      trav.state = "AIRBORNE";
      trav.wallDir = 0;
      trav.launchPower = 0;
      return;
    }

    const dx = tether.anchorX - target.x;
    const dy = tether.anchorY - target.y;
    const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    const tensionPower = Math.min(1.0, storedTension);
    const reelBonus = tether.reelVelocity < 0 ? Math.min(0.25, Math.abs(tether.reelVelocity) / 20.0) : 0;
    const isSweetSpot = storedTension >= reelConfig.SWEET_SPOT_MIN && storedTension <= reelConfig.SWEET_SPOT_MAX;
    const sweetSpotBonus = isSweetSpot ? 0.15 : 0.0;

    const powerScale = Math.min(1.0, tensionPower + reelBonus + sweetSpotBonus);
    const power = powerScale * tuning.FLING_IMPULSE;

    vel.x = (dx / dist) * power;
    vel.y = (dy / dist) * power;

    trav.state = "LAUNCHING";
    trav.launchTimer = tuning.LAUNCH_DURATION;
    trav.launchPower = powerScale;
    trav.wallDir = 0;

    const transforms = this.context.stores.get<TransformComponent>("transform");
    const pTrans = transforms.get(this.context.refs.player);
    if (pTrans) {
      pTrans.scaleVelY = powerScale * 15.0;
      pTrans.scaleVelX = -powerScale * 7.5;
      pTrans.scaleVelZ = -powerScale * 7.5;
    }

    let shakeAmp = 0.25 + powerScale * 0.35;
    let shakeDur = 0.2;

    if (storedTension >= CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) {
      shakeAmp = 0.85;
      shakeDur = 0.45;
    } else if (isSweetSpot) {
      shakeAmp = 0.5;
      shakeDur = 0.28;
    }

    this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: shakeAmp,
      duration: shakeDur,
      dirX: dx / dist,
      dirY: dy / dist
    });
  }

  private enforcePendulumConstraint(
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    tether: TetherComponent
  ) {
    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    const activeMaxLength = tether.maxLength;

    if (dist > activeMaxLength) {
      const nx = dx / dist;
      const ny = dy / dist;

      target.x = tether.anchorX + nx * activeMaxLength;
      target.y = tether.anchorY + ny * activeMaxLength;

      const dot = vel.x * nx + vel.y * ny;
      if (dot > 0) {
        vel.x -= dot * nx;
        vel.y -= dot * ny;
      }
    }
  }

  private updateTensionMeter(
    dt: number,
    tether: TetherComponent,
    trav: TraversalStateComponent,
    input: InputIntentComponent
  ): void {
    void input;
    const reelConfig = GAMEPLAY_TUNING.REEL;

    if (trav.state === "WALL_SLIDING") {
      if (trav.stickyEntityId === undefined || trav.stickyEntityId === -1) {
        const tensionDelta = reelConfig.WALL_SLIDE_PASSIVE_TENSION_RATE;
        tether.tension += tensionDelta * dt;

        const TENSION_STRETCH_RANGE = 2.0;
        const stretch = Math.max(0, tether.currentLength - tether.maxLength);
        const stretchRatio = stretch / TENSION_STRETCH_RANGE;
        tether.tension += stretchRatio * dt;
      }
    } else {
      tether.tension -= GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * dt;
    }

    tether.tension = Math.max(
      0.0,
      Math.min(CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT, tether.tension)
    );
  }
}
