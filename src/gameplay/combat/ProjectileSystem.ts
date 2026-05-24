import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  HealthComponent,
  InvulnerabilityComponent,
  WeaverAIComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { ARENA_CONFIG, GAMEPLAY_TUNING, WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

interface ActiveProjectile {
  mesh: BABYLON.Mesh;
  body: BABYLON.PhysicsBody | null;
  isStuck: boolean;
  isStuckOnWall: boolean;
  lifeTime: number;
  fallbackVelocity?: BABYLON.Vector3;
}

export class ProjectileSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private projectilePool: ActiveProjectile[] = [];
  private readonly POOL_SIZE = 16;
  private nextPoolIndex = 0;
  private sharedShape: BABYLON.PhysicsShapeSphere | null = null;

  private projMat: BABYLON.PBRMaterial | null = null;
  private unsubShoot: (() => void) | null = null;
  private unsubReset: (() => void) | null = null;

  private scratchVec3 = new BABYLON.Vector3();
  private zeroVec3 = BABYLON.Vector3.Zero();

  constructor(
    private broker: EventBroker,
    private refs: EntityRefs,
    private healths: ComponentStore<HealthComponent>,
    private iframes: ComponentStore<InvulnerabilityComponent>,
    private visualRegistry: IVisualRegistry,
    private weaverAIs: ComponentStore<WeaverAIComponent>
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    this.projMat = new BABYLON.PBRMaterial("projectileMat", scene);
    this.projMat.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.98);
    this.projMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
    this.projMat.emissiveIntensity = 0.0;
    this.projMat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.METALLIC;
    this.projMat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.ROUGHNESS;
    this.projMat.sheen.isEnabled = true;
    this.projMat.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.SHEEN_INTENSITY;
    this.projMat.sheen.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.SHEEN_ROUGHNESS;
    this.projMat.sheen.color = new BABYLON.Color3(1.0, 1.0, 1.0);

    if (scene.isPhysicsEnabled()) {
      this.sharedShape = new BABYLON.PhysicsShapeSphere(BABYLON.Vector3.Zero(), WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER / 2, scene);
      this.sharedShape.material = { friction: 0.1, restitution: 0.6 };
    }

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `projectile_pooled_${i}`,
        { diameter: WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER },
        scene
      );
      sphere.position.set(0, -999, 0);
      sphere.material = this.projMat;
      sphere.isVisible = false;

      if (this.visualRegistry.registerShadowCaster) {
        this.visualRegistry.registerShadowCaster(sphere);
      }

      let body: BABYLON.PhysicsBody | null = null;
      if (scene.isPhysicsEnabled() && this.sharedShape) {
        body = new BABYLON.PhysicsBody(sphere, BABYLON.PhysicsMotionType.ANIMATED, false, scene);
        body.shape = this.sharedShape;
        body.setMassProperties({ mass: 1.0 });
        body.setLinearVelocity(this.zeroVec3);
      }

      this.projectilePool.push({
        mesh: sphere,
        body: body,
        isStuck: false,
        isStuckOnWall: false,
        lifeTime: 0.0,
        fallbackVelocity: undefined
      });
    }

    this.unsubShoot = this.broker.subscribe(GameEvent.WEAVER_SHOOT, (payload: { x: number; y: number; tx: number; ty: number }) => {
      this.spawnProjectile(payload.x, payload.y, payload.tx, payload.ty);
    });

    this.unsubReset = this.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.clearAll();
    });
  }

  private spawnProjectile(x: number, y: number, tx: number, ty: number): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    let proj: ActiveProjectile | null = null;
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const idx = (this.nextPoolIndex + i) % this.POOL_SIZE;
      const p = this.projectilePool[idx];
      if (!p.mesh.isVisible) {
        proj = p;
        this.nextPoolIndex = (idx + 1) % this.POOL_SIZE;
        break;
      }
    }

    if (!proj) {
      proj = this.projectilePool[this.nextPoolIndex];
      this.recycleProjectile(proj);
      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.POOL_SIZE;
    }

    proj.isStuck = false;
    proj.isStuckOnWall = false;
    proj.lifeTime = 0.0;
    proj.mesh.isVisible = true;
    proj.mesh.position.set(x, y, 0);

    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = WEAVER_AI_TUNING.SHOOT.SPEED;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    if (proj.body) {
      proj.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
      this.scratchVec3.set(vx, vy, 0);
      proj.body.setLinearVelocity(this.scratchVec3);
      proj.body.setAngularVelocity(this.zeroVec3);
      proj.fallbackVelocity = undefined;
    } else {
      proj.fallbackVelocity = new BABYLON.Vector3(vx, vy, 0);
    }
  }

  public update(dt: number): void {
    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.weaver);
    const pIframe = this.iframes.get(this.refs.player);

    if (!pHealth || !wHealth || !pIframe) return;

    if (pHealth.current <= 0 || wHealth.current <= 0) return;

    const pMesh = this.visualRegistry.getTransformNode(this.refs.player) as BABYLON.AbstractMesh;
    const wAI = this.weaverAIs.get(this.refs.weaver);
    const currentScrollSpeed = wAI ? wAI.scrollSpeed : 12.0;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const p = this.projectilePool[i];
      if (!p.mesh.isVisible) continue;

      p.lifeTime += dt;

      if (p.body && !p.isStuck) {
        const pos = p.mesh.position;
        if (Math.abs(pos.z) > 0.01) {
          p.mesh.position.z = 0;
        }
        const vel = p.body.getLinearVelocity();
        if (Math.abs(vel.z) > 0.01) {
          this.scratchVec3.set(vel.x, vel.y, 0);
          p.body.setLinearVelocity(this.scratchVec3);
        }
      }

      if (!p.isStuck && p.fallbackVelocity) {
        p.mesh.position.addInPlace(p.fallbackVelocity.scale(dt));
      }

      const pos = p.mesh.position;
      const wallLimit = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;

      if (!p.isStuck) {
        if (Math.abs(pos.x) >= wallLimit) {
          p.isStuck = true;
          p.isStuckOnWall = true;
          this.broker.publish(GameEvent.PROJECTILE_IMPACT, { x: pos.x, y: pos.y, isWall: true });

          if (p.body) {
            p.body.setLinearVelocity(this.zeroVec3);
            p.body.setAngularVelocity(this.zeroVec3);
            p.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
          } else {
            p.fallbackVelocity = new BABYLON.Vector3(0, 0, 0);
          }
        }
      }

      if (p.isStuckOnWall) {
        if (p.body && p.body.getMotionType() !== BABYLON.PhysicsMotionType.ANIMATED) {
          p.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
        }

        const deltaY = currentScrollSpeed * dt;
        p.mesh.position.y -= deltaY;
      }

      if (
        p.mesh.position.y < ARENA_CONFIG.PROJECTILE.OFFSCREEN_MIN_Y ||
        p.mesh.position.y > ARENA_CONFIG.PROJECTILE.OFFSCREEN_MAX_Y ||
        p.lifeTime > WEAVER_AI_TUNING.SHOOT.MAX_LIFE
      ) {
        this.recycleProjectile(p);
        continue;
      }

      if (!p.isStuck && pMesh && pIframe.timeRemaining <= 0) {
        const isHit = p.mesh.intersectsMesh(pMesh, false);

        if (isHit) {
          pHealth.current = Math.max(0, pHealth.current - 1);
          pIframe.timeRemaining = GAMEPLAY_TUNING.COMBAT.PLAYER_IFRAME_DURATION;
          this.broker.publish(GameEvent.PROJECTILE_IMPACT, { x: p.mesh.position.x, y: p.mesh.position.y, isWall: false });

          this.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: 1, source: "PROJECTILE" });
          this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
            hp: pHealth.current,
            maxHp: pHealth.max
          });
          this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP,
            duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR
          });

          if (pHealth.current <= 0) {
            this.broker.publish(GameEvent.PLAYER_DIED, undefined);
          }

          this.recycleProjectile(p);
        }
      }
    }
  }

  private recycleProjectile(p: ActiveProjectile): void {
    if (!p) return;
    p.mesh.isVisible = false;
    p.mesh.position.set(0, -999, 0);
    if (p.body) {
      p.body.setLinearVelocity(this.zeroVec3);
      p.body.setAngularVelocity(this.zeroVec3);
      p.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
    }
    p.fallbackVelocity = undefined;
    p.isStuck = false;
    p.isStuckOnWall = false;
    p.lifeTime = 0.0;
  }

  private clearAll(): void {
    if (!this.projectilePool || this.projectilePool.length === 0) return;
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const p = this.projectilePool[i];
      if (p) {
        this.recycleProjectile(p);
      }
    }
  }

  public dispose(): void {
    if (this.unsubShoot) this.unsubShoot();
    if (this.unsubReset) this.unsubReset();
    this.clearAll();
    if (this.sharedShape) this.sharedShape.dispose();
    this.projectilePool.forEach(p => {
      if (p) {
        if (p.body) p.body.dispose();
        p.mesh.dispose();
      }
    });
    this.projectilePool = [];
  }
}
