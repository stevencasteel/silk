import { ISystem, IUpdateable } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IEventBroker } from "../../contracts/ICore";
import { GameEvent, GameEventMap } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import { PlayerStateHints } from "../../gameplay/player/states/PlayerStateHints";
import { TraversalStateComponent, TetherStrainComponent } from "../../core/ecs/Components";
import {
  usePlayerStore,
  useWeaverStore,
  useOverlayStore,
  useInputStore,
  resetAllStores
} from "./hudStore";

export class HudSyncSystem implements ISystem, IUpdateable {
  readonly phase = SystemPhase.RenderSync;
  private subscriptions: (() => void)[] = [];
  private currentState: string = "AIRBORNE";
  private broker: IEventBroker;

  private statsUpdateListener: ((e: Event) => void) | null = null;

  constructor(private context: SystemContext) {
    this.broker = this.context.broker;
    this.registerSubscriptions();
    this.setupWindowListeners();
  }

  public init(): void {}

  public update(dt: number): void {
    void dt;
    const playerStore = usePlayerStore.getState();
    const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
    const pTrav = travStore.get(this.context.refs.player);
    if (pTrav) {
      playerStore.setWebTrapped(
        !!pTrav.isWebTrapped,
        pTrav.escapeProgress || 0,
        pTrav.escapeRequired || 5,
        pTrav.webMass || 1
      );
    }

    const strainStore = this.context.stores.get<TetherStrainComponent>("tetherStrain");
    const pStrain = strainStore.get(this.context.refs.player);
    if (pStrain) {
      playerStore.setTetherDamage(pStrain.damageCount || 0);
    }
  }

  private registerSubscriptions(): void {
    const playerStore = usePlayerStore.getState();
    const weaverStore = useWeaverStore.getState();
    const overlayStore = useOverlayStore.getState();
    const inputStore = useInputStore.getState();

    overlayStore.setPublishEvent((event, payload) => {
      this.broker.publish(event as GameEvent, payload as GameEventMap[GameEvent]);
    });

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_BOOT_PROGRESS, ({ status }) => {
        overlayStore.setBootStatus(status);
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, ({ tension }) => {
        const stateHints = PlayerStateHints.getHintForState(
          this.currentState as "AIRBORNE" | "WALL_SLIDING" | "LAUNCHING" | "GROUNDED",
          tension
        );
        overlayStore.setTraversalHint(stateHints.text, stateHints.color, stateHints.opacity);

        const evt = new CustomEvent("silk-tension-render-tick", { detail: { tension } });
        window.dispatchEvent(evt);
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, ({ state }) => {
        this.currentState = state;
        playerStore.setCurrentState(state);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        playerStore.setPlayerHp(hp, maxHp);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.WEAVER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        weaverStore.setWeaverHealth(hp, maxHp);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, ({ state, hue }) => {
        weaverStore.setWeaverState(state, hue);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_OVER, () => {
        overlayStore.showOverlay("DEFEATED", "rgb(239, 68, 68)", "The line was severed.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        overlayStore.showOverlay("VICTORY", "rgb(16, 185, 129)", "The shaft is clear.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        resetAllStores();
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        overlayStore.setPaused(isPaused);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        overlayStore.setAwaitingGesture(false);
        overlayStore.setBootStatus("READY");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_INPUT_KEY_STATE_CHANGED, ({ key, pressed }) => {
        inputStore.setKeyPressed(key, pressed);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.UI_CALIBRATION_STEP_CHANGED, ({ step }) => {
        overlayStore.setCalibrationStep(step);
      })
    );
  }

  private setupWindowListeners(): void {
    const overlayStore = useOverlayStore.getState();
    this.statsUpdateListener = (e: Event) => {
      const customEvent = e as CustomEvent;
      overlayStore.setStats(customEvent.detail.wins, customEvent.detail.losses);
    };
    window.addEventListener("silk-stats-updated", this.statsUpdateListener);
  }

  public dispose(): void {
    this.subscriptions.forEach((u) => u());
    this.subscriptions = [];
    if (this.statsUpdateListener) {
      window.removeEventListener("silk-stats-updated", this.statsUpdateListener);
    }
  }
}
