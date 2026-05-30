import {
  
  ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  HitStopComponent, HealthComponent,
  TetherComponent
} from "../../core/ecs/Components";
import { EntitySpawnerSystem } from "../EntitySpawnerSystem";
import { GAMEPLAY_TUNING, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { HASH_PREFIX, SubscriptionTracker } from "../../core/utils/EngineUtils";
import { EngineTime } from "../../core/engine/EngineTime";

export class GameDirectorSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private gameState: "PLAYING" | "GAME_OVER" | "VICTORY" = "PLAYING";
  private resetRequested = false;

  private _tracker = new SubscriptionTracker();

  private activeCinematic: "NONE" | "PLAYER_DEATH" | "WEAVER_DEATH" = "NONE";
  private cinematicTimer = 0.0;
  private maxCinematicSimTime = 0.6;

  private adrenalineTimer = 0.0;
  private readonly ADRENALINE_SURGE_DURATION = 1.2;

  constructor(
    private context: SystemContext,
    private spawner: EntitySpawnerSystem
  ) {}

  public init(): void {
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_DIED, () => {
        console.log("[GameDirectorSystem] PLAYER_DIED event received!");
        if (this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
          console.log("[GameDirectorSystem] Commencing PLAYER_DEATH cinematic...");
          this.activeCinematic = "PLAYER_DEATH";
          this.cinematicTimer = 0.0;
          this.maxCinematicSimTime = 0.6;
          EngineTime.timeScale = 0.2;

          const tethers = this.context.stores.get<TetherComponent>("tether");
          const pTether = tethers.get(this.context.refs.player);
          if (pTether) {
            pTether.isAttached = false;
            pTether.tension = 0.0;
          }

          this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 1.5,
            duration: 1.2
          });
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        console.log("[GameDirectorSystem] WEAVER_DIED event received!");
        if (this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
          console.log("[GameDirectorSystem] Commencing WEAVER_DEATH cinematic...");
          this.activeCinematic = "WEAVER_DEATH";
          this.cinematicTimer = 0.0;
          this.maxCinematicSimTime = 0.875;
          EngineTime.timeScale = 0.25;

          this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 0.8,
            duration: 0.4
          });
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, (payload) => {
        if (payload.hp === 1 && this.gameState === "PLAYING" && this.activeCinematic === "NONE") {
          console.log(
            "[GameDirectorSystem] Player dropped to 1 HP! Triggering Adrenaline Surge slomo..."
          );
          this.adrenalineTimer = this.ADRENALINE_SURGE_DURATION;
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        const hs = this.context.stores.get<HitStopComponent>("hitStop").get(this.context.refs.player);
        if (hs) hs.timeRemaining = GAMEPLAY_TUNING.COMBAT.HITSTOP_PLAYER;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        const hs = this.context.stores.get<HitStopComponent>("hitStop").get(this.context.refs.weaver);
        if (hs) hs.timeRemaining = GAMEPLAY_TUNING.COMBAT.HITSTOP_WEAVER;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PROJECTILE_IMPACT, (payload) => {
        if (!payload.isWall) {
          EngineTime.hitLagTimer = 0.15;
          EngineTime.hitLagScale = 0.15;
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_LANDED, () => {
        EngineTime.hitLagTimer = 0.18;
        EngineTime.hitLagScale = 0.20;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        const hsStore = this.context.stores.get<HitStopComponent>("hitStop");
        for (const [, hs] of hsStore.entries()) hs.timeRemaining = 0;
        EngineTime.hitLagTimer = 0;
        EngineTime.hitLagScale = 1.0;
      })
    );

    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() === "r" && this.gameState !== "PLAYING") {
      this.resetRequested = true;
    }

    if (
      e.key.toLowerCase() === "k" &&
      this.gameState === "PLAYING" &&
      this.activeCinematic === "NONE"
    ) {
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
    const hitStops = this.context.stores.get<HitStopComponent>("hitStop");
    for (const [, hs] of hitStops.entries()) {
      if (hs.timeRemaining > 0) hs.timeRemaining = Math.max(0, hs.timeRemaining - dt);
    }

    if (this.resetRequested) {
      this.resetGame();
      this.resetRequested = false;
      return;
    }

    if (this.activeCinematic !== "NONE") {
      this.cinematicTimer += dt;
      console.log(
        `[GameDirectorSystem] Cinematic progress: ${this.cinematicTimer.toFixed(3)} / ${this.maxCinematicSimTime}`
      );
      if (this.cinematicTimer >= this.maxCinematicSimTime) {
        const finishedCinematic = this.activeCinematic;
        this.activeCinematic = "NONE";
        EngineTime.timeScale = 1.0;

        if (finishedCinematic === "PLAYER_DEATH") {
          console.log(
            "[GameDirectorSystem] Player death cinematic complete! Publishing GAME_OVER event..."
          );
          this.gameState = "GAME_OVER";
          this.context.broker.publish(GameEvent.GAME_OVER, undefined);
        } else if (finishedCinematic === "WEAVER_DEATH") {
          console.log(
            "[GameDirectorSystem] Weaver death cinematic complete! Publishing GAME_WIN event..."
          );
          this.gameState = "VICTORY";
          this.context.broker.publish(GameEvent.GAME_WIN, undefined);
        }
      }
    } else {
      if (this.adrenalineTimer > 0) {
        this.adrenalineTimer -= dt;
        const progress = Math.max(0, this.adrenalineTimer / this.ADRENALINE_SURGE_DURATION);
        EngineTime.timeScale = 0.45 + (1.0 - progress) * 0.55;
      } else {
        EngineTime.timeScale = 1.0;
      }
    }
  }

  private resetGame(): void {
    console.log("[GameDirectorSystem] Resetting game state...");
    this.gameState = "PLAYING";
    this.activeCinematic = "NONE";
    this.cinematicTimer = 0.0;
    this.adrenalineTimer = 0.0;
    EngineTime.timeScale = 1.0;

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
      state: "PATROLLING",
      hue: HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING
    });
    this.context.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
      hp: wHealth?.current || 100,
      maxHp: wHealth?.max || 100
    });
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    this._tracker.clear();
  }
}
