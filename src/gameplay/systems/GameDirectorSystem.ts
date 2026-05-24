import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  HealthComponent,
  SilkComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EntitySpawnerSystem } from "./EntitySpawnerSystem";
import { GAMEPLAY_TUNING, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";

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
    private healths: ComponentStore<HealthComponent>,
    private silks: ComponentStore<SilkComponent>,
    private spawner: EntitySpawnerSystem
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

    if (e.key.toLowerCase() === "k" && this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
      const wHealth = this.healths.get(this.refs.weaver);
      if (wHealth && wHealth.current > 0) {
        wHealth.current = 0;
        this.broker.publish(GameEvent.WEAVER_DAMAGED, {
          amount: wHealth.max,
          source: "CHEAT_CODE"
        });
        this.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
          hp: 0,
          maxHp: wHealth.max
        });
      }
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

    // Delegate creation & initialization details entirely to the Entity Spawner
    this.spawner.spawnWeaver(this.refs.weaver);
    this.spawner.spawnPlayer(this.refs.player);

    this.broker.publish(GameEvent.GAME_RESET, undefined);

    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.weaver);

    this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
      hp: pHealth?.current || GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY,
      maxHp: pHealth?.max || GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY
    });
    this.broker.publish(GameEvent.WEAVER_STATE_CHANGE, {
      state: "SWEEPING",
      hue: this.HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING
    });
    this.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
      hp: wHealth?.current || 100,
      maxHp: wHealth?.max || 100
    });
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }
}
