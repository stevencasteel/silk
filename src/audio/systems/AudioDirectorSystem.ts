import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { TensionSynthesizer } from "../tone/TensionSynthesizer";
import { SfxSynthesizerRegistry } from "../tone/SfxSynthesizerRegistry";
import { AUDIO_PRESETS } from "../tone/AudioPresets";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class AudioDirectorSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private tensionSynth: TensionSynthesizer | null = null;
  private sfxRegistry: SfxSynthesizerRegistry | null = null;

  private windowTickListener: (() => void) | null = null;
  private windowConfirmListener: (() => void) | null = null;
  private windowTensionAlarmListener: (() => void) | null = null;
  private initialized: boolean = false;
  private isBooting: boolean = false;

  private broker: EventBroker;
  private _tracker = new SubscriptionTracker();
  private gestureTriggerRef: (() => void) | null = null;

  private hitComboCount = 0;
  private lastHitTime = 0;
  private toneModule: typeof import("tone") | null = null;
  private lastConfirmTime = 0;
  private lastTickTime = 0;
  private lastAlarmTime = 0;

  constructor(private context: SystemContext) {
    this.broker = this.context.broker;

    this.gestureTriggerRef = (): void => {
      this.bootAudioEngine();
      this.removeGestureListeners();
    };

    window.addEventListener("click", this.gestureTriggerRef);
    window.addEventListener("keydown", this.gestureTriggerRef);
    window.addEventListener("touchend", this.gestureTriggerRef);
    window.addEventListener("mousedown", this.gestureTriggerRef);

    this.windowTickListener = () => {
      if (this.initialized && this.sfxRegistry?.tickSynth && this.toneModule) {
        const nowMs = performance.now();
        if (nowMs - this.lastTickTime > 30) {
          this.lastTickTime = nowMs;
          this.sfxRegistry.tickSynth.triggerAttackRelease("E6", "32n", this.toneModule.now());
        }
      }
    };
    window.addEventListener("silk-stats-tick", this.windowTickListener);

    this.windowConfirmListener = () => {
      if (this.initialized && this.sfxRegistry?.confirmSynth && this.toneModule) {
        const nowMs = performance.now();
        if (nowMs - this.lastConfirmTime > 50) {
          this.lastConfirmTime = nowMs;
          this.sfxRegistry.confirmSynth.triggerAttackRelease("C6", "16n", this.toneModule.now());
        }
      }
    };
    window.addEventListener("silk-play-confirm", this.windowConfirmListener);

    this.windowTensionAlarmListener = () => {
      if (this.initialized && this.sfxRegistry?.tensionAlarmSynth && this.toneModule && Math.random() < 0.1) {
        const nowMs = performance.now();
        if (nowMs - this.lastAlarmTime > 80) {
          this.lastAlarmTime = nowMs;
          this.sfxRegistry.tensionAlarmSynth.triggerAttackRelease("F6", "32n", this.toneModule.now());
        }
      }
    };
    window.addEventListener("silk-tension-alarm", this.windowTensionAlarmListener);
  }

  public init(): void {
    this._tracker.add(
      this.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, (payload) => {
        if (this.initialized && this.tensionSynth) {
          this.tensionSynth.updateDronePitch(payload.tension);
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, (payload) => {
        if (payload.state === "LAUNCHING" && this.initialized && this.sfxRegistry) {
          const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
          const pTrav = travStore.get(this.context.refs.player);
          if (pTrav) {
            const reelConfig = GAMEPLAY_TUNING.REEL;
            const power = pTrav.launchPower;

            if (power >= 1.0) {
              this.sfxRegistry.impactSynth?.triggerAttackRelease("A1", "4n");
              this.sfxRegistry.noiseSynth?.triggerAttackRelease("4n");
            } else if (power >= reelConfig.SWEET_SPOT_MIN && power <= reelConfig.SWEET_SPOT_MAX) {
              this.sfxRegistry.tickSynth?.triggerAttackRelease("G6", "16n");
              this.sfxRegistry.impactSynth?.triggerAttackRelease("D4", "16n");
            } else {
              this.sfxRegistry.impactSynth?.triggerAttackRelease("C3", "16n");
            }
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, (payload) => {
        if (this.initialized && this.tensionSynth) {
          this.tensionSynth.setLowHPStatus(payload.hp === 1);
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        const presets = AUDIO_PRESETS.PLAYER;
        if (this.initialized && this.sfxRegistry) {
          this.sfxRegistry.impactSynth?.triggerAttackRelease(
            presets.DAMAGED_NOTE,
            presets.DAMAGED_DURATION
          );
          this.sfxRegistry.noiseSynth?.triggerAttackRelease(presets.DAMAGED_DURATION);
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
        if (this.initialized && this.sfxRegistry?.impactSynth) {
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

          this.sfxRegistry.impactSynth.triggerAttackRelease(freq, "16n");
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, (payload) => {
        if (this.initialized && this.tensionSynth) {
          this.tensionSynth.handleStateChange(payload.state, payload.audioParams);
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_OVER, () => {
        if (this.initialized && this.tensionSynth) {
          this.tensionSynth.fadeOutAndMute();
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        if (this.initialized && this.tensionSynth) {
          this.tensionSynth.fadeOutAndMute();
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        if (this.initialized && this.tensionSynth) {
          this.tensionSynth.resetToBaseline();
        }
        this.hitComboCount = 0;
        this.lastHitTime = 0;
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_PAUSED, (payload) => {
        if (this.initialized && this.tensionSynth && this.toneModule) {
          const rawCtx = this.toneModule.getContext().rawContext as unknown as AudioContext;
          if (payload.isPaused) {
            this.tensionSynth.fadeOutAndMute();
            if (rawCtx && typeof rawCtx.suspend === "function") {
              rawCtx.suspend();
            }
          } else {
            if (rawCtx && typeof rawCtx.resume === "function") {
              rawCtx.resume().then(() => {
                if (this.initialized && this.tensionSynth) {
                  this.tensionSynth.resumeFromPause();
                }
              });
            } else {
              this.tensionSynth.resumeFromPause();
            }
          }
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        if (this.initialized) {
          this.triggerDeathSequence(AUDIO_PRESETS.WEAVER);
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_DIED, () => {
        if (this.initialized) {
          this.triggerDeathSequence(AUDIO_PRESETS.PLAYER);
        }
      })
    );
  }

  private triggerDeathSequence(
    presets: typeof AUDIO_PRESETS.PLAYER | typeof AUDIO_PRESETS.WEAVER
  ): void {
    if (!this.sfxRegistry) return;

    if (this.sfxRegistry.impactSynth) {
      this.sfxRegistry.impactSynth.triggerAttackRelease(
        presets.DEATH_NOTE_1,
        presets.DEATH_NOTE_1_DURATION
      );
      this.sfxRegistry.impactSynth.triggerAttackRelease(
        presets.DEATH_NOTE_2,
        presets.DEATH_NOTE_2_DURATION,
        presets.DEATH_NOTE_2_DELAY
      );
    }
    if (this.sfxRegistry.noiseSynth) {
      this.sfxRegistry.noiseSynth.envelope.decay = presets.DEATH_NOISE_DECAY;
      this.sfxRegistry.noiseSynth.triggerAttackRelease(presets.DEATH_NOTE_1_DURATION);
      setTimeout(() => {
        if (this.sfxRegistry?.noiseSynth) {
          this.sfxRegistry.noiseSynth.envelope.decay = presets.NOISE_DECAY;
        }
      }, presets.DEATH_NOISE_RESTORE_DELAY);
    }
  }

  public update(): void {
    if (this.initialized) {
      const transforms = this.context.stores.get<TransformComponent>("transform");
      const playerTrans = transforms.get(this.context.refs.player);
      const weaverTrans = transforms.get(this.context.refs.weaver);
      if (playerTrans && weaverTrans) {
        if (this.tensionSynth) {
          this.tensionSynth.updatePositions(playerTrans.x, weaverTrans.x);
        }
        if (this.sfxRegistry?.sfxPanner && this.toneModule) {
          const panVal = (Math.max(-15.0, Math.min(15.0, playerTrans.x)) / 15.0) * 0.45;
          this.sfxRegistry.sfxPanner.pan.setTargetAtTime(panVal, this.toneModule.now(), 0.05);
        }
      }
    }
  }

  private removeGestureListeners(): void {
    if (this.gestureTriggerRef) {
      window.removeEventListener("click", this.gestureTriggerRef);
      window.removeEventListener("keydown", this.gestureTriggerRef);
      window.removeEventListener("touchend", this.gestureTriggerRef);
      window.removeEventListener("mousedown", this.gestureTriggerRef);
      this.gestureTriggerRef = null;
    }
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

        this.sfxRegistry = new SfxSynthesizerRegistry();
        this.sfxRegistry.initialize(Tone).then(() => {
          this.tensionSynth = new TensionSynthesizer();
          this.tensionSynth.initialize().then(() => {
            this.broker.publish(GameEvent.USER_GESTURE_REGISTERED, undefined);
          });
        });
      });
    });
  }

  public dispose(): void {
    this.removeGestureListeners();
    this._tracker.clear();
    if (this.tensionSynth) this.tensionSynth.dispose();
    if (this.sfxRegistry) this.sfxRegistry.dispose();
    if (this.windowTickListener) {
      window.removeEventListener("silk-stats-tick", this.windowTickListener);
    }
    if (this.windowConfirmListener) {
      window.removeEventListener("silk-play-confirm", this.windowConfirmListener);
    }
    if (this.windowTensionAlarmListener) {
      window.removeEventListener("silk-tension-alarm", this.windowTensionAlarmListener);
    }
  }
}
