import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker, MultiEventListener } from "../../core/utils/EngineUtils";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IEventBroker } from "../../contracts/ICore";
import { GameEvent } from "../../core/events/GameEvents";
import { IAudioRegistry } from "../../contracts/IAudio";
import { AUDIO_PRESETS } from "../tone/AudioPresets";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { AudioSynthesizerRegistry } from "../tone/AudioSynthesizerRegistry";

export class AudioDirectorSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private audioRegistry: IAudioRegistry | null = null;

  private initialized: boolean = false;
  private isBooting: boolean = false;

  private broker: IEventBroker;
  private _tracker = new SubscriptionTracker();
  private gestureListener = new MultiEventListener();

  private hitComboCount = 0;
  private lastHitTime = 0;
  private toneModule: typeof import("tone") | null = null;
  private lastConfirmTime = 0;
  private lastTickTime = 0;
  private lastAlarmTime = 0;

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
        if (this.initialized && this.audioRegistry && this.toneModule) {
          const nowMs = performance.now();
          if (nowMs - this.lastTickTime > 30) {
            this.lastTickTime = nowMs;
            this.audioRegistry.triggerTick("E6", "32n", this.toneModule.now());
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.UI_SFX_CONFIRM, () => {
        if (this.initialized && this.audioRegistry && this.toneModule) {
          const nowMs = performance.now();
          if (nowMs - this.lastConfirmTime > 50) {
            this.lastConfirmTime = nowMs;
            this.audioRegistry.triggerConfirm("C6", "16n", this.toneModule.now());
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.UI_SFX_ALARM, () => {
        if (this.initialized && this.audioRegistry && this.toneModule && Math.random() < 0.1) {
          const nowMs = performance.now();
          if (nowMs - this.lastAlarmTime > 80) {
            this.lastAlarmTime = nowMs;
            this.audioRegistry.triggerAlarm("F6", "32n", this.toneModule.now());
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, (payload) => {
        if (this.initialized && this.audioRegistry) {
          this.audioRegistry.updateDronePitch(payload.tension);
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, (payload) => {
        if (payload.state === "LAUNCHING" && this.initialized && this.audioRegistry) {
          const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
          const pTrav = travStore.get(this.context.refs.player);
          if (pTrav) {
            const reelConfig = GAMEPLAY_TUNING.REEL;
            const power = pTrav.launchPower;

            if (power >= 1.0) {
              this.audioRegistry.triggerImpact("A1", "4n");
              this.audioRegistry.triggerNoise("4n");
            } else if (power >= reelConfig.SWEET_SPOT_MIN && power <= reelConfig.SWEET_SPOT_MAX) {
              this.audioRegistry.triggerTick("G6", "16n");
              this.audioRegistry.triggerImpact("D4", "16n");
            } else {
              this.audioRegistry.triggerImpact("C3", "16n");
            }
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, (payload) => {
        if (this.initialized && this.audioRegistry) {
          this.audioRegistry.setLowHPStatus(payload.hp === 1);
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        const presets = AUDIO_PRESETS.PLAYER;
        if (this.initialized && this.audioRegistry) {
          this.audioRegistry.triggerImpact(presets.DAMAGED_NOTE, presets.DAMAGED_DURATION);
          this.audioRegistry.triggerNoise(presets.DAMAGED_DURATION);
        }
        this.hitComboCount = 0;
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_LANDED, () => {
        this.hitComboCount = 0;
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        if (this.initialized && this.audioRegistry) {
          const nowMs = performance.now();
          if (nowMs - this.lastHitTime < 1500) {
            this.hitComboCount++;
          } else {
            this.hitComboCount = 0;
          }
          this.lastHitTime = nowMs;

          const DORIAN_RATIOS = [1.0, 1.1225, 1.1892, 1.3348, 1.4983, 1.6818, 1.7818, 2.0];
          const scaleIndex = this.hitComboCount % DORIAN_RATIOS.length;
          const octave = Math.pow(2, Math.floor(this.hitComboCount / DORIAN_RATIOS.length));
          const baseFreq = 164.81;
          const freq = baseFreq * DORIAN_RATIOS[scaleIndex] * octave;

          this.audioRegistry.triggerImpact(freq, "16n");
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, (payload) => {
        if (this.initialized && this.audioRegistry) {
          this.audioRegistry.handleStateChange(payload.state, payload.audioParams);
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_OVER, () => {
        if (this.initialized && this.audioRegistry) {
          this.audioRegistry.fadeOutAndMute();
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        if (this.initialized && this.audioRegistry) {
          this.audioRegistry.fadeOutAndMute();
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        if (this.initialized && this.audioRegistry) {
          this.audioRegistry.resetToBaseline();
        }
        this.hitComboCount = 0;
        this.lastHitTime = 0;
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_PAUSED, (payload) => {
        if (this.initialized && this.audioRegistry && this.toneModule) {
          const rawCtx = this.toneModule.getContext().rawContext as unknown as AudioContext;
          if (payload.isPaused) {
            this.audioRegistry.fadeOutAndMute();
            if (rawCtx && typeof rawCtx.suspend === "function") {
              rawCtx.suspend();
            }
          } else {
            if (rawCtx && typeof rawCtx.resume === "function") {
              rawCtx.resume().then(() => {
                if (this.initialized && this.audioRegistry) {
                  this.audioRegistry.resumeFromPause();
                }
              });
            } else {
              this.audioRegistry.resumeFromPause();
            }
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        if (this.initialized) {
          this.triggerDeathSequence(AUDIO_PRESETS.WEAVER);
          if (this.audioRegistry) this.audioRegistry.fadeOutAndMute();
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_DIED, () => {
        if (this.initialized) {
          this.triggerDeathSequence(AUDIO_PRESETS.PLAYER);
          if (this.audioRegistry) this.audioRegistry.fadeOutAndMute();
        }
      })
    );
  }

  private triggerDeathSequence(
    presets: typeof AUDIO_PRESETS.PLAYER | typeof AUDIO_PRESETS.WEAVER
  ): void {
    if (!this.audioRegistry) return;

    this.audioRegistry.triggerImpact(presets.DEATH_NOTE_1, presets.DEATH_NOTE_1_DURATION);
    this.audioRegistry.triggerImpact(
      presets.DEATH_NOTE_2,
      presets.DEATH_NOTE_2_DURATION,
      presets.DEATH_NOTE_2_DELAY
    );
    this.audioRegistry.setNoiseDecay(presets.DEATH_NOISE_DECAY);
    this.audioRegistry.triggerNoise(presets.DEATH_NOTE_1_DURATION);

    setTimeout(() => {
      if (this.audioRegistry) {
        this.audioRegistry.setNoiseDecay(presets.NOISE_DECAY);
      }
    }, presets.DEATH_NOISE_RESTORE_DELAY);
  }

  public update(): void {
    if (this.initialized) {
      const transforms = this.context.stores.get<TransformComponent>("transform");
      const playerTrans = transforms.get(this.context.refs.player);
      const weaverTrans = transforms.get(this.context.refs.weaver);
      if (playerTrans && weaverTrans) {
        if (this.audioRegistry) {
          this.audioRegistry.updatePositions(playerTrans.x, weaverTrans.x);
        }
        if (this.audioRegistry && this.toneModule) {
          const panVal = (Math.max(-15.0, Math.min(15.0, playerTrans.x)) / 15.0) * 0.45;
          this.audioRegistry.setSfxPan(panVal, this.toneModule.now());
        }
      }
    }
  }

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

        const registry = new AudioSynthesizerRegistry();
        registry.initialize(Tone).then(() => {
          this.audioRegistry = registry;
          this.broker.publish(GameEvent.USER_GESTURE_REGISTERED, undefined);
        });
      });
    });
  }

  public dispose(): void {
    this.removeGestureListeners();
    this._tracker.clear();
    if (this.audioRegistry) this.audioRegistry.dispose();
  }
}
