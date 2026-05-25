import { ProjectileNoisePlugin } from "../../visual/lighting/ProjectileNoisePlugin";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  HealthComponent,
  InvulnerabilityComponent,
  WeaverAIComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

interface ActiveProjectile {
  mesh: BABYLON.Mesh;
  body: BABYLON.PhysicsBody | null;
  isStuck: boolean;
  isStuckOnWall: boolean;
  lifeTime: number;
  fallbackVelocity: BABYLON.Vector3;
}

export class ProjectileSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private projectilePool: ActiveProjectile[] = [];
  private readonly POOL_SIZE = 16;
  private nextPoolIndex = 0;
  private sharedShape: BABYLON.PhysicsShapeSphere | null = null;

  private projMatActive: BABYLON.PBRMaterial | null = null;
  private projMatStuck: BABYLON.PBRMaterial | null = null;
  private unsubShoot: (() => void) | null = null;
  private unsubReset: (() => void) | null = null;
  private noiseTime = 0.0;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    this.projMatActive = new BABYLON.PBRMaterial("projectileMatActive", scene);
    this.projMatActive.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.98);
    this.projMatActive.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.METALLIC;
    this.projMatActive.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.ROUGHNESS;
    this.projMatActive.sheen.isEnabled = true;
    this.projMatActive.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.SHEEN_INTENSITY;

    const noisePlugin = new ProjectileNoisePlugin(this.projMatActive);
    (this.projMatActive as BABYLON.PBRMaterial & { _noisePlugin?: ProjectileNoisePlugin })._noisePlugin =
      noisePlugin;

    this.projMatStuck = new BABYLON.PBRMaterial("projectileMatStuck", scene);
    this.projMatStuck.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.98);
    this.projMatStuck.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.METALLIC;
    this.projMatStuck.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.ROUGHNESS;
    this.projMatStuck.sheen.isEnabled = true;
    this.projMatStuck.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.SHEEN_INTENSITY;

    if (scene.isPhysicsEnabled()) {
      this.sharedShape = new BABYLON.PhysicsShapeSphere(
        BABYLON.Vector3.Zero(),
        WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER / 2,
        scene
      );
      this.sharedShape.material = { friction: 0.1, restitution: 0.6 };
    }

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `projectile_pooled_${i}`,
        { diameter: WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER },
        scene
      );
      sphere.position.set(0, -999, 0);
      sphere.material = this.projMatActive;
      sphere.isVisible = false;

      let body: BABYLON.PhysicsBody | null = null;
      if (scene.isPhysicsEnabled() && this.sharedShape) {
        body = new BABYLON.PhysicsBody(sphere, BABYLON.PhysicsMotionType.ANIMATED, false, scene);
        body.shape = this.sharedShape;
        body.setMassProperties({ mass: 1.0 });
        body.disablePreStep = false;
      }

      this.projectilePool.push({
        mesh: sphere,
        body: body,
        isStuck: false,
        isStuckOnWall: false,
        lifeTime: 0.0,
        fallbackVelocity: new BABYLON.Vector3(0, 0, 0)
      });
    }

    this.unsubShoot = this.context.broker.subscribe(GameEvent.WEAVER_SHOOT, (payload) => {
      this.spawnProjectile(payload.x, payload.y, payload.tx, payload.ty);
    });

    this.unsubReset = this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.clearAll();
      this.noiseTime = 0.0;
    });
  }

  private spawnProjectile(x: number, y: number, tx: number, ty: number): void {
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
    proj.mesh.scaling.set(1.0, 1.0, 1.0);
    proj.mesh.material = this.projMatActive;

    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = WEAVER_AI_TUNING.SHOOT.SPEED;
    proj.fallbackVelocity.set((dx / dist) * speed, (dy / dist) * speed, 0);
  }

  public update(dt: number): void {
    const healthStore = this.context.stores.get<HealthComponent>("health");
    const iframeStore = this.context.stores.get<InvulnerabilityComponent>("iframe");

    const pHealth = healthStore.get(this.context.refs.player);
    const wHealth = healthStore.get(this.context.refs.weaver);
    const pIframe = iframeStore.get(this.context.refs.player);

    if (!pHealth || !wHealth || !pIframe) return;
    if (pHealth.current <= 0 || wHealth.current <= 0) return;

    this.noiseTime += dt;
    if (this.projMatActive) {
      const noisePlugin = (
        this.projMatActive as BABYLON.PBRMaterial & { _noisePlugin?: ProjectileNoisePlugin }
      )._noisePlugin;
      if (noisePlugin) {
        noisePlugin.time = this.noiseTime;
      }
    }

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const currentScrollSpeed = wAI ? wAI.scrollSpeed : 12.0;
    const pMesh = this.context.visualRegistry.getTransformNode(
      this.context.refs.player
    ) as BABYLON.AbstractMesh;
    const wallLimit = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const p = this.projectilePool[i];
      if (!p.mesh.isVisible) continue;

      p.lifeTime += dt;

      if (!p.isStuck) {
        p.mesh.position.addInPlace(p.fallbackVelocity.scale(dt));

        if (Math.abs(p.mesh.position.x) >= wallLimit) {
          p.isStuck = true;
          p.isStuckOnWall = true;
          p.mesh.scaling.set(0.28, 1.45, 1.45);
          p.mesh.position.x = Math.sign(p.mesh.position.x) * wallLimit;
          p.mesh.material = this.projMatStuck;
          this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
            x: p.mesh.position.x,
            y: p.mesh.position.y,
            isWall: true
          });
        }

        if (!p.isStuck && pMesh && pIframe.timeRemaining <= 0) {
          if (p.mesh.intersectsMesh(pMesh, false)) {
            this.context.commands.dispatch({
              type: "DAMAGE_REQUEST",
              targetId: this.context.refs.player,
              amount: 1,
              source: "PROJECTILE"
            });

            this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
              x: p.mesh.position.x,
              y: p.mesh.position.y,
              isWall: false
            });
            this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
              amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP,
              duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR
            });
            this.recycleProjectile(p);
            continue;
          }
        }
      }

      if (p.isStuckOnWall) {
        p.mesh.position.y -= currentScrollSpeed * dt;
      }

      if (
        p.mesh.position.y < ARENA_CONFIG.PROJECTILE.OFFSCREEN_MIN_Y ||
        p.mesh.position.y > ARENA_CONFIG.PROJECTILE.OFFSCREEN_MAX_Y ||
        p.lifeTime > WEAVER_AI_TUNING.SHOOT.MAX_LIFE
      ) {
        this.recycleProjectile(p);
      }
    }
  }

  private recycleProjectile(p: ActiveProjectile): void {
    if (!p) return;
    p.mesh.isVisible = false;
    p.mesh.position.set(0, -999, 0);
    p.mesh.scaling.set(1.0, 1.0, 1.0);
    p.fallbackVelocity.set(0, 0, 0);
    p.isStuck = false;
    p.isStuckOnWall = false;
    p.lifeTime = 0.0;
    p.mesh.material = this.projMatActive;
  }

  private clearAll(): void {
    if (!this.projectilePool || this.projectilePool.length === 0) return;
    for (let i = 0; i < this.POOL_SIZE; i++) {
      if (this.projectilePool[i]) this.recycleProjectile(this.projectilePool[i]);
    }
  }

  public dispose(): void {
    if (this.unsubShoot) this.unsubShoot();
    if (this.unsubReset) this.unsubReset();
    this.clearAll();
    if (this.sharedShape) this.sharedShape.dispose();
    this.projectilePool.forEach((p) => {
      if (p) {
        if (p.body) p.body.dispose();
        p.mesh.dispose();
      }
    });
    this.projectilePool = [];
    if (this.projMatActive) this.projMatActive.dispose();
    if (this.projMatStuck) this.projMatStuck.dispose();
  }
}
