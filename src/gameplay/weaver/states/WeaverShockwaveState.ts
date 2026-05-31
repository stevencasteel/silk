import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  WeaverAIComponent,
  WeaverCosmeticComponent,
  InvulnerabilityComponent,
  ParticleRequestComponent,
  TetherComponent
} from "../../../core/ecs/Components";
import { HASH_PREFIX, getDistance2D } from "../../../core/utils/EngineUtils";
import { WEB_SPLAT_STRATEGY } from "../../juice/ParticleStrategies";
import { ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

interface ShockwaveRing {
  mesh: BABYLON.Mesh;
  currentScale: number;
  targetScale: number;
  speed: number;
  alpha: number;
}

export class WeaverShockwaveState implements IWeaverState {
  public readonly type: WeaverStateType = "SHOCKWAVE";
  public readonly name = "SHOCKWAVE COUNTER";
  public readonly hue = HASH_PREFIX + "eab308";
  public readonly audioParams = { baseFreq: 75, lfoHz: 8.0, harmonicity: 2.0 };

  private phase: "DELAY" | "TELEGRAPH" | "BLAST" | "RECOVER" = "DELAY";
  private timer = 0.0;
  private hasBlastTriggered = false;

  private readonly DELAY_DURATION = 0.42;
  private readonly TELEGRAPH_DURATION = 0.85;
  private readonly BLAST_DURATION = 0.15;
  private readonly RECOVER_DURATION = 0.55;
  private readonly SHOCKWAVE_RADIUS = 6.8;

  private activeRings: ShockwaveRing[] = [];
  private ringSpawnTimers: number[] = [];

  private _sharedRingMaterial: BABYLON.StandardMaterial | null = null;

  public enter(ctx: SystemContext): void {
    this.phase = "DELAY";
    this.timer = this.DELAY_DURATION;
    this.hasBlastTriggered = false;
    this.ringSpawnTimers = [];

    const scene = ctx.visualQuery.getScene();
    if (scene && !this._sharedRingMaterial) {
      this._sharedRingMaterial = new BABYLON.StandardMaterial("sharedShockwaveRingMat", scene);
      this._sharedRingMaterial.diffuseColor = new BABYLON.Color3(1.0, 0.0, 0.1);
      this._sharedRingMaterial.emissiveColor = new BABYLON.Color3(1.0, 0.0, 0.1);
      this._sharedRingMaterial.disableLighting = true;
    }

    const ai = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (ai) {
      ai.desiredVelocityX = 0;
      ai.desiredVelocityY = 0;
      ai.hue = HASH_PREFIX + "121212";
    }
  }

  public exit(): void {
    this.clearRings();
  }

  private clearRings(): void {
    for (let i = 0; i < this.activeRings.length; i++) {
      this.activeRings[i].mesh.dispose();
    }
    this.activeRings = [];
    this.ringSpawnTimers = [];
  }

  private spawnShockwaveRing(ctx: SystemContext): void {
    const scene = ctx.visualQuery.getScene();
    if (!scene || !this._sharedRingMaterial) return;

    const wTrans = ctx.stores.get<TransformComponent>("transform").get(ctx.refs.weaver);
    if (!wTrans) return;

    const ring = BABYLON.MeshBuilder.CreateTorus(
      `shockwave_ring_${performance.now()}`,
      {
        diameter: 1.0,
        thickness: 0.08,
        tessellation: 32
      },
      scene
    );

    ring.position.set(wTrans.x, wTrans.y, 0);
    ring.rotation.x = Math.PI / 2;
    ring.material = this._sharedRingMaterial;
    ring.visibility = 0.95;

    this.activeRings.push({
      mesh: ring,
      currentScale: 0.1,
      targetScale: this.SHOCKWAVE_RADIUS * 2.0,
      speed: 22.0,
      alpha: 0.95
    });
  }

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    this.timer -= dt;

    const ai = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    const cosmetic = ctx.stores.get<WeaverCosmeticComponent>("weaverCosmetic").get(ctx.refs.weaver);

    if (!ai || !cosmetic) return null;

    for (let i = 0; i < this.ringSpawnTimers.length; i++) {
      if (this.ringSpawnTimers[i] >= 0) {
        this.ringSpawnTimers[i] -= dt;
        if (this.ringSpawnTimers[i] < 0) {
          this.spawnShockwaveRing(ctx);
        }
      }
    }

    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const ring = this.activeRings[i];
      ring.currentScale += ring.speed * dt;
      ring.alpha = Math.max(0, ring.alpha - dt * 2.0);

      ring.mesh.scaling.set(ring.currentScale, 1.0, ring.currentScale);
      ring.mesh.visibility = ring.alpha;

      if (ring.alpha <= 0.01 || ring.currentScale >= ring.targetScale) {
        ring.mesh.dispose();
        this.activeRings.splice(i, 1);
      }
    }

    if (this.phase === "DELAY") {
      cosmetic.targetScaleX = 1.08;
      cosmetic.targetScaleY = 1.08;
      cosmetic.targetScaleZ = 1.08;
      cosmetic.wobbleAngle = Math.sin(this.timer * 15.0) * 0.06;
      cosmetic.rotationAngle = 0.0;
      cosmetic.gaitAmplitude = 0.05;

      if (this.timer <= 0) {
        this.phase = "TELEGRAPH";
        this.timer = this.TELEGRAPH_DURATION;
        ai.hue = HASH_PREFIX + "eab308";
      }
    } else if (this.phase === "TELEGRAPH") {
      const pulse = Math.sin(this.timer * 45.0) * 0.15;
      cosmetic.targetScaleX = 1.25 + pulse;
      cosmetic.targetScaleY = 0.75 - pulse;
      cosmetic.targetScaleZ = 1.25;
      cosmetic.emissiveHue = HASH_PREFIX + "eab308";
      cosmetic.wobbleAngle = Math.sin(this.timer * 40.0) * 0.14;
      cosmetic.rotationAngle = 0.0;
      cosmetic.gaitAmplitude = 0.25;
      cosmetic.gaitFrequency = 20.0;
      cosmetic.gaitTuck = 0.8;

      if (Math.random() < 0.5) {
        ai.shakeRequested = true;
        ai.shakeAmplitude = 0.12;
        ai.shakeDuration = 0.05;
      }

      if (this.timer <= 0) {
        this.phase = "BLAST";
        this.timer = this.BLAST_DURATION;
      }
    } else if (this.phase === "BLAST") {
      if (!this.hasBlastTriggered) {
        this.hasBlastTriggered = true;

        this.ringSpawnTimers = [0.0, 0.08, 0.16];

        const wTrans = ctx.stores.get<TransformComponent>("transform").get(ctx.refs.weaver);
        if (wTrans) {
          const reqStore = ctx.stores.get<ParticleRequestComponent>("particleRequest");
          if (reqStore) {
            for (let i = 0; i < 2; i++) {
              const reqId = ctx.world.create();
              reqStore.add(reqId, {
                strategy: WEB_SPLAT_STRATEGY,
                x: wTrans.x,
                y: wTrans.y,
                z: 0
              });
            }
          }

          const pTrans = ctx.stores.get<TransformComponent>("transform").get(ctx.refs.player);
          if (pTrans) {
            const dist = getDistance2D(wTrans.x, wTrans.y, pTrans.x, pTrans.y);
            if (dist <= this.SHOCKWAVE_RADIUS) {
              const pIframe = ctx.stores
                .get<InvulnerabilityComponent>("iframe")
                .get(ctx.refs.player);
              const hasIframe = pIframe && pIframe.timeRemaining > 0;

              if (!hasIframe) {
                const dx = pTrans.x - wTrans.x;
                const dy = pTrans.y - wTrans.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1.0;

                const kbForceX = (dx / len) * 24.0;
                const kbForceY = (dy / len) * 24.0 + 10.0;

                ctx.commands.dispatch({
                  type: "DAMAGE_REQUEST",
                  targetId: ctx.refs.player,
                  amount: 1,
                  source: "SHOCKWAVE",
                  knockbackX: kbForceX,
                  knockbackY: kbForceY
                });

                // BUMP REEL-IN: Force player back to starting thread limits
                const pTether = ctx.stores.get<TetherComponent>("tether").get(ctx.refs.player);
                if (pTether) {
                  const initialLength = ARENA_CONFIG.TETHER.INITIAL_LENGTH; // 5.4
                  pTether.desiredLength = initialLength;
                }
              }
            }
          }

          ctx.broker.publish(GameEvent.PROJECTILE_IMPACT, {
            x: wTrans.x,
            y: wTrans.y,
            isWall: false
          });
        }

        ai.shakeRequested = true;
        ai.shakeAmplitude = 1.35;
        ai.shakeDuration = 0.45;
        ai.hue = HASH_PREFIX + "ff0022";
      }

      cosmetic.targetScaleX = 1.45;
      cosmetic.targetScaleY = 0.55;
      cosmetic.targetScaleZ = 1.45;
      cosmetic.emissiveHue = HASH_PREFIX + "ff0022";

      if (this.timer <= 0) {
        this.phase = "RECOVER";
        this.timer = this.RECOVER_DURATION;
      }
    } else if (this.phase === "RECOVER") {
      cosmetic.targetScaleX = 0.94;
      cosmetic.targetScaleY = 0.94;
      cosmetic.targetScaleZ = 0.94;
      cosmetic.emissiveHue = HASH_PREFIX + "440011";
      cosmetic.gaitAmplitude = 0.04;
      cosmetic.gaitFrequency = 2.0;
      cosmetic.gaitTuck = 0.75;

      if (this.timer <= 0 && this.activeRings.length === 0) {
        return "ASCENDING";
      }
    }

    return null;
  }
}
