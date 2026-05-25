import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import {
  WeaverAIComponent,
  HealthComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class ParallaxScrollSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  
  public static currentScrollSpeed: number = ARENA_CONFIG.SCROLL_SPEED.BASE;

  private currentScrollOffset = 0.0;
  private prevScrollOffset = 0.0;
  private scrollSpeed: number = ARENA_CONFIG.SCROLL_SPEED.BASE;

  private cachedTicks: BABYLON.AbstractMesh[] | null = null;
  private hitStopTimer = 0.0;
  private unsubscribes: (() => void)[] = [];

  constructor(private context: SystemContext) {}

  public init(): void {
    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        this.hitStopTimer = 0.08;
      })
    );
    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        this.hitStopTimer = 0.15;
      })
    );
    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.hitStopTimer = 0.0;
        this.currentScrollOffset = 0.0;
        this.prevScrollOffset = 0.0;
        this.scrollSpeed = ARENA_CONFIG.SCROLL_SPEED.BASE;
        ParallaxScrollSystem.currentScrollSpeed = ARENA_CONFIG.SCROLL_SPEED.BASE;
      })
    );
  }

  public update(dt: number): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
    }

    const wAI = this.context.stores.get<WeaverAIComponent>("weaverAI").get(this.context.refs.weaver);
    const wHealth = this.context.stores.get<HealthComponent>("health").get(this.context.refs.weaver);
    const wVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(this.context.refs.weaver);

    const targetScrollSpeed = this.hitStopTimer > 0
      ? 0.0
      : ParallaxScrollSystem.getDesiredScrollSpeed(wAI, wHealth, wVel);

    this.scrollSpeed = BABYLON.Scalar.Lerp(this.scrollSpeed, targetScrollSpeed, 0.15);
    ParallaxScrollSystem.currentScrollSpeed = this.scrollSpeed;
    
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
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    const totalRange = 140.0;
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
      while (y < -56.0) y += totalRange;
      while (y > 84.0) y -= totalRange;
      tick.position.y = y;
    }
  }

  public dispose(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    this.cachedTicks = null;
  }
}
