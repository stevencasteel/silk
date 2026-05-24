import { ARENA_CONFIG, CANONICAL_UNITS, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  TetherComponent,
  TraversalStateComponent,
  WeaverAIComponent,
  HealthComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class TransformSyncSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  
  public static currentScrollSpeed: number = ARENA_CONFIG.SCROLL_SPEED.BASE;

  private scratchPrevQuat = new BABYLON.Quaternion();
  private scratchCurrQuat = new BABYLON.Quaternion();
  private currentScrollOffset = 0.0;
  private prevScrollOffset = 0.0;
  private scrollSpeed: number = ARENA_CONFIG.SCROLL_SPEED.BASE;
  private currentEmissiveR = 0.05;
  private currentEmissiveG = 0.15;
  private currentEmissiveB = 0.05;

  private cachedTicks: BABYLON.AbstractMesh[] | null = null;
  private colorCache = new Map<string, BABYLON.Color3>();

  private hitStopTimer = 0.0;
  private unsubscribes: (() => void)[] = [];

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private tethers: ComponentStore<TetherComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private visualRegistry: IVisualRegistry,
    private weaverAIs: ComponentStore<WeaverAIComponent>,
    private healthStore: ComponentStore<HealthComponent>,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private broker: EventBroker
  ) {}

  public init(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        this.hitStopTimer = 0.08;
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        this.hitStopTimer = 0.15;
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.hitStopTimer = 0.0;
        this.currentScrollOffset = 0.0;
        this.prevScrollOffset = 0.0;
        this.scrollSpeed = ARENA_CONFIG.SCROLL_SPEED.BASE;
      })
    );
  }

  public update(dt: number): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
    }

    const wAI = this.weaverAIs.get(this.refs.weaver);
    const wHealth = this.healthStore.get(this.refs.weaver);
    const wVel = this.velocities.get(this.refs.weaver);

    const targetScrollSpeed = this.hitStopTimer > 0
      ? 0.0
      : TransformSyncSystem.getDesiredScrollSpeed(wAI, wHealth, wVel);

    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;
    this.scrollSpeed = BABYLON.Scalar.Lerp(this.scrollSpeed, targetScrollSpeed, emissive.SCROLL_LERP_FACTOR);
    TransformSyncSystem.currentScrollSpeed = this.scrollSpeed;
    
    if (wAI) {
      wAI.scrollSpeed = this.scrollSpeed;
    }

    this.prevScrollOffset = this.currentScrollOffset;
    this.currentScrollOffset += this.scrollSpeed * dt;
  }

  public static getDesiredScrollSpeed(
    wAI: WeaverAIComponent | undefined,
    wHealth: HealthComponent | undefined,
    wVel: KinematicVelocityComponent | undefined
  ): number {
    if (!wHealth || wHealth.current <= 0 || !wAI) {
      return 0.0;
    }

    if (wAI.state === "SWEEPING") {
      const isBerserk = wHealth.current < wHealth.max * 0.5;
      return isBerserk ? ARENA_CONFIG.SCROLL_SPEED.BERSERK : ARENA_CONFIG.SCROLL_SPEED.BASE;
    }

    if (wAI.state === "DASHING") {
      if (wVel) {
        if (wVel.y < -0.1) {
          return wVel.y * ARENA_CONFIG.SCROLL_SPEED.DASH_MULTIPLIER;
        } else if (wVel.y > 0.1) {
          return wVel.y * ARENA_CONFIG.SCROLL_SPEED.DASH_MULTIPLIER;
        }
      }
      return 0.0;
    }

    if (wAI.state === "RETURNING") {
      const isBerserk = wHealth.current < wHealth.max * 0.5;
      return isBerserk ? ARENA_CONFIG.SCROLL_SPEED.BERSERK : ARENA_CONFIG.SCROLL_SPEED.BASE;
    }

    return 0.0;
  }

  public render(alpha: number): void {
    this.scrollTicks(alpha);
    this.syncTransforms(alpha);
  }

  private scrollTicks(alpha: number): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    const totalRange = CANONICAL_UNITS.SCROLL_MAPPING.TOTAL_RANGE;
    const interpolatedOffset = this.prevScrollOffset + (this.currentScrollOffset - this.prevScrollOffset) * alpha;
    
    let wrappedOffset = interpolatedOffset % totalRange;
    if (wrappedOffset < 0) {
      wrappedOffset += totalRange;
    }

    if (!this.cachedTicks) {
      this.cachedTicks = scene.meshes.filter(
        (m) => m.metadata?.type === "scrolling_tick"
      ) as BABYLON.AbstractMesh[];
    }

    for (let i = 0; i < this.cachedTicks.length; i++) {
      const tick = this.cachedTicks[i];
      let y = tick.metadata.initialY - wrappedOffset;
      while (y < CANONICAL_UNITS.SCROLL_MAPPING.BOTTOM_BOUNDARY) y += totalRange;
      while (y > CANONICAL_UNITS.SCROLL_MAPPING.TOP_BOUNDARY) y -= totalRange;
      tick.position.y = y;
    }
  }

  private syncTransforms(alpha: number): void {
    const tether = this.tethers.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    const wAI = this.weaverAIs.get(this.refs.weaver);
    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    for (const [id, curr] of this.transforms.entries()) {
      const node = this.visualRegistry.getTransformNode(id);
      if (!node) continue;

      node.position.x = curr.prevX + (curr.x - curr.prevX) * alpha;
      node.position.y = curr.prevY + (curr.y - curr.prevY) * alpha;
      node.position.z = curr.prevZ + (curr.z - curr.prevZ) * alpha;

      const sx = curr.prevScaleX !== undefined && curr.scaleX !== undefined ? curr.prevScaleX + (curr.scaleX - curr.prevScaleX) * alpha : 1.0;
      const sy = curr.prevScaleY !== undefined && curr.scaleY !== undefined ? curr.prevScaleY + (curr.scaleY - curr.prevScaleY) * alpha : 1.0;
      const sz = curr.prevScaleZ !== undefined && curr.scaleZ !== undefined ? curr.prevScaleZ + (curr.scaleZ - curr.prevScaleZ) * alpha : 1.0;
      node.scaling.set(sx, sy, sz);

      this.scratchPrevQuat.set(curr.prevQx, curr.prevQy, curr.prevQz, curr.prevQw);
      this.scratchCurrQuat.set(curr.qx, curr.qy, curr.qz, curr.qw);

      if (!node.rotationQuaternion) {
        node.rotationQuaternion = new BABYLON.Quaternion();
      }
      BABYLON.Quaternion.SlerpToRef(
        this.scratchPrevQuat,
        this.scratchCurrQuat,
        alpha,
        node.rotationQuaternion
      );

      if (id === this.refs.player) {
        const mesh = node as BABYLON.AbstractMesh;
        const mat = mesh?.material as BABYLON.PBRMaterial | null;
        if (mat && tether && trav) {
          this.updatePlayerEmissive(mat, tether.tension, trav.state);
        }
      } else if (id === this.refs.weaver && wAI) {
        const mesh = node as BABYLON.AbstractMesh;
        const mat = mesh?.material as BABYLON.PBRMaterial | null;
        if (mat) {
          let cachedColor = this.colorCache.get(wAI.hue);
          if (!cachedColor) {
            const hex = wAI.hue.replace(String.fromCharCode(35), "");
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            cachedColor = new BABYLON.Color3(r, g, b);
            this.colorCache.set(wAI.hue, cachedColor);
          }
          const pulse = emissive.WEAVER_EMISSIVE_PULSE_BASE + Math.sin(Date.now() * emissive.WEAVER_EMISSIVE_PULSE_FREQ) * emissive.WEAVER_EMISSIVE_PULSE_AMP;
          mat.emissiveColor.set(
            cachedColor.r * emissive.WEAVER_EMISSIVE_SCALE + pulse,
            cachedColor.g * emissive.WEAVER_EMISSIVE_SCALE,
            cachedColor.b * emissive.WEAVER_EMISSIVE_SCALE
          );
        }
      }
    }
  }

  private updatePlayerEmissive(
    mat: BABYLON.PBRMaterial,
    tension: number,
    state: string
  ): void {
    let targetR: number;
    let targetG: number;
    let targetB: number;

    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    if (state === "WALL_SLIDING") {
      targetR = emissive.PLAYER_EMISSIVE_SLIDE.BASE_R + Math.min(1.0, tension) * emissive.PLAYER_EMISSIVE_SLIDE.RANGE_R;
      targetG = emissive.PLAYER_EMISSIVE_SLIDE.BASE_G + (1.0 - Math.min(1.0, tension)) * emissive.PLAYER_EMISSIVE_SLIDE.RANGE_G;
      targetB = (1.0 - Math.min(1.0, tension)) * emissive.PLAYER_EMISSIVE_SLIDE.MULT_B;
    } else if (state === "LAUNCHING") {
      targetR = emissive.PLAYER_EMISSIVE_LAUNCH.R;
      targetG = emissive.PLAYER_EMISSIVE_LAUNCH.G;
      targetB = emissive.PLAYER_EMISSIVE_LAUNCH.B;
    } else {
      targetR = emissive.PLAYER_EMISSIVE_DEFAULT.R;
      targetG = emissive.PLAYER_EMISSIVE_DEFAULT.G;
      targetB = emissive.PLAYER_EMISSIVE_DEFAULT.B;
    }

    const lerpRate = emissive.PLAYER_LERP_RATE;
    this.currentEmissiveR += (targetR - this.currentEmissiveR) * lerpRate;
    this.currentEmissiveG += (targetG - this.currentEmissiveG) * lerpRate;
    this.currentEmissiveB += (targetB - this.currentEmissiveB) * lerpRate;
    
    mat.emissiveColor.set(
      this.currentEmissiveR * emissive.PLAYER_EMISSIVE_SCALE,
      this.currentEmissiveG * emissive.PLAYER_EMISSIVE_SCALE,
      this.currentEmissiveB * emissive.PLAYER_EMISSIVE_SCALE
    );
  }

  public dispose(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    this.cachedTicks = null;
  }
}
