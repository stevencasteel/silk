import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker, MultiEventListener } from "../../core/utils/EngineUtils";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { IEventBroker } from "../../contracts/ICore";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";

type ToneType = typeof import("tone");

export class AudioDirectorSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  readonly initPhase = InitPhase.Bootstrap;

  private initialized = false;
  private isBooting = false;
  private broker: IEventBroker;
  private _tracker = new SubscriptionTracker();
  private gestureListener = new MultiEventListener();

  private toneModule: ToneType | null = null;

  private tickSynth: import("tone").Synth | null = null;
  private confirmSynth: import("tone").Synth | null = null;
  private heartbeatSynth: import("tone").MembraneSynth | null = null;
  private heartbeatLoop: import("tone").Loop | null = null;

  private lastTickTime = 0;
  private lastConfirmTime = 0;

  constructor(private context: SystemContext) {
    this.broker = this.context.broker;

    this.gestureListener.add(window, "click", () => {
      this.bootAudioEngine();
      this.removeGestureListeners();
    });
    this.gestureListener.add(window, "keydown", () => {
      this.bootAudioEngine();
      this.removeGestureListeners();
    });
    this.gestureListener.add(window, "touchend", () => {
      this.bootAudioEngine();
      this.removeGestureListeners();
    });
    this.gestureListener.add(window, "mousedown", () => {
      this.bootAudioEngine();
      this.removeGestureListeners();
    });
  }

  public init(): void {
    this._tracker.add(
      this.broker.subscribe(GameEvent.UI_SFX_TICK, () => {
        if (this.initialized && this.tickSynth && this.toneModule) {
          const nowMs = performance.now();
          if (nowMs - this.lastTickTime > 30) {
            this.lastTickTime = nowMs;
            this.tickSynth.triggerAttackRelease("E6", "32n", this.toneModule.now());
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.UI_SFX_CONFIRM, () => {
        if (this.initialized && this.confirmSynth && this.toneModule) {
          const nowMs = performance.now();
          if (nowMs - this.lastConfirmTime > 50) {
            this.lastConfirmTime = nowMs;
            this.confirmSynth.triggerAttackRelease("C6", "16n", this.toneModule.now());
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, (payload) => {
        if (this.initialized && this.heartbeatLoop) {
          const isLowHp = payload.hp === 1;
          if (isLowHp) {
            this.heartbeatLoop.start();
          } else {
            this.heartbeatLoop.stop();
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.stopHeartbeat();
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        this.stopHeartbeat();
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.stopHeartbeat();
        this.lastTickTime = 0;
        this.lastConfirmTime = 0;
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_PAUSED, (payload) => {
        if (this.initialized && this.toneModule) {
          const rawCtx = this.toneModule.getContext().rawContext as unknown as AudioContext;
          if (payload.isPaused) {
            this.stopHeartbeat();
            if (rawCtx && typeof rawCtx.suspend === "function") {
              rawCtx.suspend();
            }
          } else {
            if (rawCtx && typeof rawCtx.resume === "function") {
              rawCtx.resume();
            }
          }
        }
      })
    );
  }

  private stopHeartbeat(): void {
    if (this.heartbeatLoop) {
      this.heartbeatLoop.stop();
    }
  }

  public update(): void {}

  private removeGestureListeners(): void {
    this.gestureListener.removeAll();
  }

  private bootAudioEngine(): void {
    if (this.initialized || this.isBooting) return;
    this.isBooting = true;

    import("tone").then((Tone) => {
      this.toneModule = Tone;
      Tone.start().then(() => {
        this.initialized = true;
        this.isBooting = false;
        Tone.getDestination().mute = false;

        Tone.getTransport().bpm.value = 130;
        Tone.getTransport().start();

        this.tickSynth = new Tone.Synth({
          oscillator: { type: "square" },
          envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 }
        }).toDestination();
        this.tickSynth.volume.value = -18;

        this.confirmSynth = new Tone.Synth({
          oscillator: { type: "square" },
          envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
        }).toDestination();
        this.confirmSynth.volume.value = -12;

        this.heartbeatSynth = new Tone.MembraneSynth({
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12 }
        }).toDestination();
        this.heartbeatSynth.volume.value = -8;

        this.heartbeatLoop = new Tone.Loop((time) => {
          if (this.heartbeatSynth) {
            this.heartbeatSynth.triggerAttackRelease("A1", "8n", time);
            this.heartbeatSynth.triggerAttackRelease("G1", "8n", time + 0.18);
          }
        }, "1.1s");

        this.broker.publish(GameEvent.USER_GESTURE_REGISTERED, undefined);
      });
    });
  }

  public dispose(): void {
    this.removeGestureListeners();
    this._tracker.clear();
    this.stopHeartbeat();
    this.tickSynth?.dispose();
    this.confirmSynth?.dispose();
    this.heartbeatSynth?.dispose();
    this.heartbeatLoop?.dispose();
  }
}
