import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  HealthComponent,
  InvulnerabilityComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { TransformSyncSystem } from "../../physics/sync/TransformSyncSystem";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

interface ActiveProjectile {
  mesh: BABYLON.Mesh;
  aggregate: BABYLON.PhysicsAggregate | null;
  isStuck: boolean;
  isStuckOnWall: boolean;
  lifeTime: number;
  fallbackVelocity?: BABYLON.Vector3;
}

export class ProjectileSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private projectiles: ActiveProjectile[] = [];
  private projMat: BABYLON.PBRMaterial | null = null;
  private unsubShoot: (() => void) | null = null;
  private unsubReset: (() => void) | null = null;

  constructor(
    private broker: EventBroker,
    private refs: EntityRefs,
    private healths: ComponentStore<HealthComponent>,
    private iframes: ComponentStore<InvulnerabilityComponent>,
    private visualRegistry: IVisualRegistry
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    this.projMat = new BABYLON.PBRMaterial("projectileMat", scene);
    this.projMat.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.98);
    this.projMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
    this.projMat.emissiveIntensity = 0.0;
    this.projMat.metallic = 0.0;
    this.projMat.roughness = 0.8;
    this.projMat.sheen.isEnabled = true;
    this.projMat.sheen.intensity = 0.6;
    this.projMat.sheen.roughness = 0.4;
    this.projMat.sheen.color = new BABYLON.Color3(1.0, 1.0, 1.0);

    this.unsubShoot = this.broker.subscribe(GameEvent.WEAVER_SHOOT, (payload) => {
      this.spawnProjectile(payload.x, payload.y, payload.tx, payload.ty);
    });

    this.unsubReset = this.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.clearAll();
    });
  }

  private spawnProjectile(x: number, y: number, tx: number, ty: number): void {
    const scene = this.visualRegistry.getScene();
    if (!scene || !this.projMat) return;

    const sphere = BABYLON.MeshBuilder.CreateSphere(
      "proj_" + Date.now(),
      { diameter: 0.65 },
      scene
    );
    sphere.position.set(x, y, 0);
    sphere.material = this.projMat;

    if (this.visualRegistry.registerShadowCaster) {
      this.visualRegistry.registerShadowCaster(sphere);
    }

    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 15.0;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    let agg: BABYLON.PhysicsAggregate | null = null;
    let fallbackVel: BABYLON.Vector3 | undefined;

    if (scene.isPhysicsEnabled()) {
      agg = new BABYLON.PhysicsAggregate(
        sphere,
        BABYLON.PhysicsShapeType.SPHERE,
        { mass: 1.0, friction: 0.2, restitution: 0.1 },
        scene
      );
      agg.body.setLinearVelocity(new BABYLON.Vector3(vx, vy, 0));
    } else {
      fallbackVel = new BABYLON.Vector3(vx, vy, 0);
    }

    this.projectiles.push({
      mesh: sphere,
      aggregate: agg,
      isStuck: false,
      isStuckOnWall: false,
      lifeTime: 0.0,
      fallbackVelocity: fallbackVel
    });
  }

  public update(dt: number): void {
    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.weaver);
    const pIframe = this.iframes.get(this.refs.player);

    if (!pHealth || !wHealth || !pIframe) return;

    if (pHealth.current <= 0 || wHealth.current <= 0) return;

    const pMesh = this.visualRegistry.getTransformNode(this.refs.player) as BABYLON.AbstractMesh;
    const currentScrollSpeed = TransformSyncSystem.currentScrollSpeed;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.lifeTime += dt;

      if (!p.isStuck && p.fallbackVelocity) {
        p.mesh.position.addInPlace(p.fallbackVelocity.scale(dt));
      }

      const pos = p.mesh.position;
      const wallLimit = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;

      if (!p.isStuck) {
        if (Math.abs(pos.x) >= wallLimit) {
          p.isStuck = true;
          p.isStuckOnWall = true;

          if (p.aggregate) {
            p.aggregate.body.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
            p.aggregate.body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
            p.aggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
          } else {
            p.fallbackVelocity = new BABYLON.Vector3(0, 0, 0);
          }
        }
      }

      if (p.isStuckOnWall) {
        if (p.aggregate && p.aggregate.body.getMotionType() !== BABYLON.PhysicsMotionType.ANIMATED) {
          p.aggregate.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
        }

        const deltaY = currentScrollSpeed * dt;
        p.mesh.position.y -= deltaY;
      }

      if (p.mesh.position.y < ARENA_CONFIG.PROJECTILE.OFFSCREEN_MIN_Y || p.mesh.position.y > ARENA_CONFIG.PROJECTILE.OFFSCREEN_MAX_Y) {
        this.removeProjectile(i);
        continue;
      }

      if (!p.isStuck && pMesh && pIframe.timeRemaining <= 0) {
        const isHit = p.mesh.intersectsMesh(pMesh, true);

        if (isHit) {
          pHealth.current = Math.max(0, pHealth.current - 1);
          pIframe.timeRemaining = 1.2;

          this.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: 1, source: "PROJECTILE" });
          this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
            hp: pHealth.current,
            maxHp: pHealth.max
          });
          this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.6, duration: 0.35 });

          if (pHealth.current <= 0) {
            this.broker.publish(GameEvent.PLAYER_DIED, undefined);
          }

          this.removeProjectile(i);
          continue;
        }
      }

      if (p.lifeTime > 8.0) {
        this.removeProjectile(i);
      }
    }
  }

  private removeProjectile(index: number): void {
    const p = this.projectiles[index];
    if (p.aggregate) p.aggregate.dispose();
    p.mesh.dispose();
    this.projectiles.splice(index, 1);
  }

  private clearAll(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.removeProjectile(i);
    }
  }

  public dispose(): void {
    if (this.unsubShoot) this.unsubShoot();
    if (this.unsubReset) this.unsubReset();
    this.clearAll();
  }
}
