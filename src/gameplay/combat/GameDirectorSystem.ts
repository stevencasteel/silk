import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  HealthComponent,
  TetherComponent
} from "../../core/ecs/Components";
import { EntitySpawnerSystem } from "../EntitySpawnerSystem";
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
    private context: SystemContext,
    private spawner: EntitySpawnerSystem
  ) {}

  public init(): void {
    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.PLAYER_DIED, () => {
        if (this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
          this.activeCinematic = "PLAYER_DEATH";
          this.cinematicTimer = 0.0;
          this.maxCinematicSimTime = 0.60;
          GameDirectorSystem.timeScale = 0.20;

          const tethers = this.context.stores.get<TetherComponent>("tether");
          const pTether = tethers.get(this.context.refs.player);
          if (pTether) {
            pTether.isAttached = false;
            pTether.tension = 0.0;
          }

          this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 1.2 });
        }
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        if (this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
          this.activeCinematic = "WEAVER_DEATH";
          this.cinematicTimer = 0.0;
          this.maxCinematicSimTime = 0.875;
          GameDirectorSystem.timeScale = 0.25;

          this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.4 });
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
      const healths = this.context.stores.get<HealthComponent>("health");
      const wHealth = healths.get(this.context.refs.weaver);
      if (wHealth && wHealth.current > 0) {
        wHealth.current = 0;
        this.context.broker.publish(GameEvent.WEAVER_DAMAGED, {
          amount: wHealth.max,
          source: "CHEAT_CODE"
        });
        this.context.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
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
          this.context.broker.publish(GameEvent.GAME_OVER, undefined);
        } else if (finishedCinematic === "WEAVER_DEATH") {
          this.gameState = "VICTORY";
          this.context.broker.publish(GameEvent.GAME_WIN, undefined);
        }
      }
    }
  }

  private resetGame(): void {
    this.gameState = "PLAYING";
    this.activeCinematic = "NONE";
    this.cinematicTimer = 0.0;
    GameDirectorSystem.timeScale = 1.0;

    this.spawner.spawnWeaver(this.context.refs.weaver);
    this.spawner.spawnPlayer(this.context.refs.player);

    this.context.broker.publish(GameEvent.GAME_RESET, undefined);

    const healths = this.context.stores.get<HealthComponent>("health");
    const pHealth = healths.get(this.context.refs.player);
    const wHealth = healths.get(this.context.refs.weaver);

    this.context.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
      hp: pHealth?.current || GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY,
      maxHp: pHealth?.max || GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY
    });
    this.context.broker.publish(GameEvent.WEAVER_STATE_CHANGE, {
      state: "SWEEPING",
      hue: this.HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING
    });
    this.context.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
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
