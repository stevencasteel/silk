import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  HealthComponent,
  SilkComponent,
  WeaverAIComponent,
  KinematicVelocityComponent,
  InvulnerabilityComponent,
  KinematicTargetComponent,
  TraversalStateComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";

export class GameDirectorSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  public static timeScale = 1.0;

  private gameState: "PLAYING" | "GAME_OVER" | "VICTORY" = "PLAYING";
  private resetRequested = false;
  private HASH = String.fromCharCode(35);
  private unsubscribes: (() => void)[] = [];

  private activeCinematic: "NONE" | "PLAYER_DEATH" | "WEAVER_DEATH" = "NONE";
  private cinematicTimer = 0.0;
  private maxCinematicSimTime = 0.0;

  constructor(
    private broker: EventBroker,
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private healths: ComponentStore<HealthComponent>,
    private silks: ComponentStore<SilkComponent>,
    private weaverAIs: ComponentStore<WeaverAIComponent>,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private iframes: ComponentStore<InvulnerabilityComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private traversal: ComponentStore<TraversalStateComponent>
  ) {}

  public init(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_DIED, () => {
        if (this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
          this.activeCinematic = "PLAYER_DEATH";
          this.cinematicTimer = 0.0;
          this.maxCinematicSimTime = 0.60;
          GameDirectorSystem.timeScale = 0.20;

          const pSilk = this.silks.get(this.refs.player);
          if (pSilk) {
            pSilk.isAttached = false;
            pSilk.tension = 0.0;
          }

          this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 1.2 });
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        if (this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
          this.activeCinematic = "WEAVER_DEATH";
          this.cinematicTimer = 0.0;
          this.maxCinematicSimTime = 0.875;
          GameDirectorSystem.timeScale = 0.25;

          this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 2.2, duration: 0.7 });
        }
      })
    );

    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() === "r" && this.gameState !== "PLAYING") {
      this.resetRequested = true;
    }
  };

  public update(dt: number): void {
    if (this.resetRequested) {
      this.resetGame();
      this.resetRequested = false;
      return;
    }

    if (this.activeCinematic !== "NONE") {
      this.cinematicTimer += dt;
      if (this.cinematicTimer >= this.maxCinematicSimTime) {
        const finishedCinematic = this.activeCinematic;
        this.activeCinematic = "NONE";
        GameDirectorSystem.timeScale = 1.0;

        if (finishedCinematic === "PLAYER_DEATH") {
          this.gameState = "GAME_OVER";
          this.broker.publish(GameEvent.GAME_OVER, undefined);
        } else if (finishedCinematic === "WEAVER_DEATH") {
          this.gameState = "VICTORY";
          this.broker.publish(GameEvent.GAME_WIN, undefined);
        }
      }
    }
  }

  private resetGame(): void {
    this.gameState = "PLAYING";
    this.activeCinematic = "NONE";
    this.cinematicTimer = 0.0;
    GameDirectorSystem.timeScale = 1.0;

    const pTrans = this.transforms.get(this.refs.player);
    const pHealth = this.healths.get(this.refs.player);
    const pSilk = this.silks.get(this.refs.player);
    const pVel = this.velocities.get(this.refs.player);
    const pIframe = this.iframes.get(this.refs.player);
    const pTarget = this.targets.get(this.refs.player);
    const pTrav = this.traversal.get(this.refs.player);

    if (pTrans) {
      pTrans.x = 0;
      pTrans.y = ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y;
      pTrans.z = 0;
      pTrans.prevX = 0;
      pTrans.prevY = ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y;
      pTrans.prevZ = 0;
    }
    if (pTarget) {
      pTarget.x = 0;
      pTarget.y = ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y;
      pTarget.z = 0;
      pTarget.active = true;
    }
    if (pHealth) pHealth.current = pHealth.max;
    if (pSilk) {
      pSilk.isAttached = true;
      pSilk.maxLength = ARENA_CONFIG.SILK.INITIAL_LENGTH;
      pSilk.currentLength = ARENA_CONFIG.SILK.INITIAL_LENGTH;
      pSilk.dynamicVelX = 0;
      pSilk.dynamicVelY = 0;
      pSilk.tension = 0.0;
      pSilk.anchorX = 0;
      pSilk.anchorY = ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y;
    }
    if (pVel) {
      pVel.x = 0;
      pVel.y = 0;
      pVel.z = 0;
    }
    if (pIframe) pIframe.timeRemaining = 0;
    if (pTrav) {
      pTrav.state = "AIRBORNE";
      pTrav.wallNormalX = 0;
      pTrav.wallNormalY = 0;
      pTrav.wallDir = 0;
      pTrav.launchTimer = 0;
      pTrav.launchPower = 0;
    }

    const wTrans = this.transforms.get(this.refs.weaver);
    const wHealth = this.healths.get(this.refs.weaver);
    const wAI = this.weaverAIs.get(this.refs.weaver);
    const wVel = this.velocities.get(this.refs.weaver);
    const wTarget = this.targets.get(this.refs.weaver);

    if (wTrans) {
      wTrans.x = 0;
      wTrans.y = ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y;
      wTrans.z = 0;
      wTrans.prevX = 0;
      wTrans.prevY = ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y - 6.0;
      wTrans.prevZ = 0;
    }
    if (wTarget) {
      wTarget.x = 0;
      wTarget.y = ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y;
      wTarget.z = 0;
      wTarget.active = true;
    }
    if (wHealth) wHealth.current = wHealth.max;
    if (wAI) {
      wAI.state = "SWEEPING";
      wAI.timeInState = 0;
      wAI.hue = this.HASH + "ef4444";
      wAI.scrollSpeed = 12.0;
    }
    if (wVel) {
      wVel.x = 4.5;
      wVel.y = 0;
      wVel.z = 0;
    }

    this.broker.publish(GameEvent.GAME_RESET, undefined);
    this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
      hp: pHealth?.max || 5,
      maxHp: pHealth?.max || 5
    });
    this.broker.publish(GameEvent.WEAVER_STATE_CHANGE, {
      state: "SWEEPING",
      hue: this.HASH + "ef4444"
    });
    this.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
      hp: wHealth?.max || 100,
      maxHp: wHealth?.max || 100
    });
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }
}
