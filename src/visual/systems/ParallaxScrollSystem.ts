import {
  ARENA_CONFIG,
  CANONICAL_UNITS,
  POST_PROCESSING_PRESETS
} from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { SystemPhase } from "../../contracts/SystemPhase";
import {
  WeaverAIComponent,
  HealthComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { ArenaProfileService } from "../../core/engine/ArenaProfileService";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class ParallaxScrollSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  public static currentScrollSpeed: number = ARENA_CONFIG.SCROLL_SPEED.BASE;

  private currentScrollOffset = 0.0;
  private prevScrollOffset = 0.0;
  private scrollSpeed: number = ARENA_CONFIG.SCROLL_SPEED.BASE;

  private cachedScrollables: BABYLON.AbstractMesh[] | null = null;
  private hitStopTimer = 0.0;
  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  public init(): void {
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        this.hitStopTimer = 0.08;
      })
    );
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        this.hitStopTimer = 0.15;
      })
    );
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.hitStopTimer = 0.0;
        this.currentScrollOffset = 0.0;
        this.prevScrollOffset = 0.0;
        this.scrollSpeed = ARENA_CONFIG.SCROLL_SPEED.BASE;
        ParallaxScrollSystem.currentScrollSpeed = ARENA_CONFIG.SCROLL_SPEED.BASE;
        ArenaProfileService.setAltitude(0);
      })
    );
  }

  public update(dt: number): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
    }

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const wHealth = this.context.stores
      .get<HealthComponent>("health")
      .get(this.context.refs.weaver);
    const wVel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.weaver);

    const targetScrollSpeed =
      this.hitStopTimer > 0 ? 0.0 : ParallaxScrollSystem.getDesiredScrollSpeed(wAI, wHealth, wVel);

    this.scrollSpeed = BABYLON.Scalar.Lerp(this.scrollSpeed, targetScrollSpeed, 0.15);
    ParallaxScrollSystem.currentScrollSpeed = this.scrollSpeed;

    if (wAI) {
      wAI.scrollSpeed = this.scrollSpeed;
    }

    this.prevScrollOffset = this.currentScrollOffset;
    this.currentScrollOffset += this.scrollSpeed * dt;

    // Track traveled altitude scaling within our global profile service
    if (this.scrollSpeed > 0) {
      ArenaProfileService.setAltitude(ArenaProfileService.getAltitude() + this.scrollSpeed * dt);
    }
  }

  public static getDesiredScrollSpeed(
    wAI: WeaverAIComponent | undefined,
    wHealth: HealthComponent | undefined,
    wVel: KinematicVelocityComponent | undefined
  ): number {
    if (!wHealth || wHealth.current <= 0 || !wAI) {
      return 0.0;
    }

    const profile = ArenaProfileService.getActiveProfile();

    if (wAI.state === "PATROLLING") {
      const isBerserk = wHealth.current < wHealth.max * 0.5;
      return isBerserk ? profile.scrollSpeed * 1.5 : profile.scrollSpeed;
    }

    if (wAI.state === "STRIKING") {
      if (wVel) {
        if (wVel.y < -0.1) {
          return wVel.y * ARENA_CONFIG.SCROLL_SPEED.DASH_MULTIPLIER;
        } else if (wVel.y > 0.1) {
          return wVel.y * ARENA_CONFIG.SCROLL_SPEED.DASH_MULTIPLIER;
        }
      }
      return 0.0;
    }

    if (wAI.state === "ASCENDING") {
      const isBerserk = wHealth.current < wHealth.max * 0.5;
      return isBerserk ? profile.scrollSpeed * 1.5 : profile.scrollSpeed;
    }

    return 0.0;
  }

  public render(alpha: number): void {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    const mapping = CANONICAL_UNITS.SCROLL_MAPPING;
    const totalRange = mapping.TOTAL_RANGE;
    const interpolatedOffset =
      this.prevScrollOffset + (this.currentScrollOffset - this.prevScrollOffset) * alpha;

    let wrappedOffset = interpolatedOffset % totalRange;
    if (wrappedOffset < 0) {
      wrappedOffset += totalRange;
    }

    const defaultCameraY = POST_PROCESSING_PRESETS.CAMERA.DEFAULT_POS.y;
    const cameraYOffset = scene.activeCamera ? scene.activeCamera.position.y - defaultCameraY : 0.0;

    const leftWall = scene.getMeshByName("leftWall");
    const rightWall = scene.getMeshByName("rightWall");
    const backdropWall = scene.getMeshByName("shaftBackdropWall");
    if (leftWall && rightWall) {
      const defaultWallY = ARENA_CONFIG.VERTICAL.WALL_GEOMETRY_HEIGHT * 0.1;
      leftWall.position.y = defaultWallY + cameraYOffset;
      rightWall.position.y = defaultWallY + cameraYOffset;
      if (backdropWall) {
        backdropWall.position.y = defaultWallY + cameraYOffset;
      }
    }

    if (!this.cachedScrollables) {
      this.cachedScrollables = scene.meshes.filter(
        (m) => typeof m.metadata?.type === "string" && m.metadata.type.startsWith("scrolling_")
      ) as BABYLON.AbstractMesh[];
    }

    for (let i = 0; i < this.cachedScrollables.length; i++) {
      const element = this.cachedScrollables[i];
      let y = element.metadata.initialY - wrappedOffset + cameraYOffset;
      while (y < mapping.BOTTOM_BOUNDARY) y += totalRange;
      while (y > mapping.TOP_BOUNDARY) y -= totalRange;
      element.position.y = y;
    }
  }

  public dispose(): void {
    this._tracker.clear();
    this.cachedScrollables = null;
  }
}
