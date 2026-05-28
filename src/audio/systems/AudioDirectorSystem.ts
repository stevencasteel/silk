import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { TensionSynthesizer } from "../tone/TensionSynthesizer";
import { AUDIO_PRESETS } from "../tone/AudioPresets";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import type { MembraneSynth, NoiseSynth, Synth, Panner } from "tone";

export class AudioDirectorSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private tensionSynth: TensionSynthesizer | null = null;
  private impactSynth: MembraneSynth | null = null;
  private noiseSynth: NoiseSynth | null = null;
  private tickSynth: Synth | null = null;
  private confirmSynth: Synth | null = null;
  private tensionAlarmSynth: Synth | null = null;
  private sfxPanner: Panner | null = null;
  private windowTickListener: (() => void) | null = null;
  private windowConfirmListener: (() => void) | null = null;
  private windowTensionAlarmListener: (() => void) | null = null;
  private initialized: boolean = false;

  private broker: EventBroker;
  private _tracker = new SubscriptionTracker();
  private gestureTriggerRef: (() => void) | null = null;

  private hitComboCount = 0;
  private lastHitTime = 0;
  private toneModule: typeof import("tone") | null = null;

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
      if (this.initialized && this.tickSynth) {
        this.tickSynth.triggerAttackRelease("E6", "32n");
      }
    };
    window.addEventListener("silk-stats-tick", this.windowTickListener);

    this.windowConfirmListener = () => {
      if (this.initialized && this.confirmSynth) {
        this.confirmSynth.triggerAttackRelease("C6", "16n");
      }
    };
    window.addEventListener("silk-play-confirm", this.windowConfirmListener);

    this.windowTensionAlarmListener = () => {
      if (this.initialized && this.tensionAlarmSynth && Math.random() < 0.1) {
        this.tensionAlarmSynth.triggerAttackRelease("F6", "32n");
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
        if (payload.state === "LAUNCHING" && this.initialized) {
          const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
          const pTrav = travStore.get(this.context.refs.player);
          if (pTrav) {
            const reelConfig = GAMEPLAY_TUNING.REEL;
            const power = pTrav.launchPower;
            
            if (power >= 1.0) {
              if (this.impactSynth) {
                this.impactSynth.triggerAttackRelease("A1", "4n");
              }
              if (this.noiseSynth) {
                this.noiseSynth.triggerAttackRelease("4n");
              }
            } else if (power >= reelConfig.SWEET_SPOT_MIN && power <= reelConfig.SWEET_SPOT_MAX) {
              if (this.tickSynth) {
                this.tickSynth.triggerAttackRelease("G6", "16n");
              }
              if (this.impactSynth) {
                this.impactSynth.triggerAttackRelease("D4", "16n");
              }
            } else {
              if (this.impactSynth) {
                this.impactSynth.triggerAttackRelease("C3", "16n");
              }
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
        if (this.initialized && this.impactSynth) {
          this.impactSynth.triggerAttackRelease(presets.DAMAGED_NOTE, presets.DAMAGED_DURATION);
        }
        if (this.initialized && this.noiseSynth) {
          this.noiseSynth.triggerAttackRelease(presets.DAMAGED_DURATION);
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
        if (this.initialized && this.impactSynth) {
          const nowMs = performance.now();
          if (nowMs - this.lastHitTime < 1500) {
            this.hitComboCount++;
          } else {
            this.hitComboCount = 0;
          }
          this.lastHitTime = nowMs;

          const DORIAN_RATIOS = [1.0000, 1.1225, 1.1892, 1.3348, 1.4983, 1.6818, 1.7818, 2.0000];
          const scaleIndex = this.hitComboCount % DORIAN_RATIOS.length;
          const octave = Math.pow(2, Math.floor(this.hitComboCount / DORIAN_RATIOS.length));
          const baseFreq = 164.81; 
          const freq = baseFreq * DORIAN_RATIOS[scaleIndex] * octave;

          this.impactSynth.triggerAttackRelease(freq, "16n");
        }
      })
    );

    this._tracker.add(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, (payload) => {
        if (this.initialized && this.tensionSynth) {
          this.tensionSynth.handleStateChange(payload.state);
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

  private triggerDeathSequence(presets: typeof AUDIO_PRESETS.PLAYER | typeof AUDIO_PRESETS.WEAVER): void {
    if (this.impactSynth) {
      this.impactSynth.triggerAttackRelease(
        presets.DEATH_NOTE_1,
        presets.DEATH_NOTE_1_DURATION
      );
      this.impactSynth.triggerAttackRelease(
        presets.DEATH_NOTE_2,
        presets.DEATH_NOTE_2_DURATION,
        presets.DEATH_NOTE_2_DELAY
      );
    }
    if (this.noiseSynth) {
      this.noiseSynth.envelope.decay = presets.DEATH_NOISE_DECAY;
      this.noiseSynth.triggerAttackRelease(presets.DEATH_NOTE_1_DURATION);
      setTimeout(() => {
        if (this.noiseSynth) this.noiseSynth.envelope.decay = presets.NOISE_DECAY;
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
        if (this.sfxPanner && this.toneModule) {
          const panVal = Math.max(-15.0, Math.min(15.0, playerTrans.x)) / 15.0 * 0.45;
          this.sfxPanner.pan.setTargetAtTime(panVal, this.toneModule.now(), 0.05);
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
    if (this.initialized) return;
    import("tone").then((Tone) => {
      this.toneModule = Tone;
      Tone.start().then(() => {
        this.initialized = true;

        Tone.getDestination().mute = false;

        this.sfxPanner = new Tone.Panner(0).toDestination();

        this.tensionSynth = new TensionSynthesizer();
        this.tensionSynth.initialize().then(() => {
          this.broker.publish(GameEvent.USER_GESTURE_REGISTERED, undefined);
        });

        this.impactSynth = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0.01,
            release: 0.4,
            attackCurve: "exponential"
          }
        }).connect(this.sfxPanner);

        const presets = AUDIO_PRESETS.PLAYER;

        this.noiseSynth = new Tone.NoiseSynth({
          noise: { type: "pink" },
          envelope: {
            attack: 0.001,
            decay: presets.NOISE_DECAY,
            sustain: 0,
            release: presets.NOISE_DECAY
          }
        }).connect(this.sfxPanner);
        this.noiseSynth.volume.value = presets.NOISE_VOLUME;

        this.tickSynth = new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.002,
            decay: 0.03,
            sustain: 0,
            release: 0.03
          }
        }).toDestination();
        this.tickSynth.volume.value = -14;

        this.confirmSynth = new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: {
            attack: 0.002,
            decay: 0.12,
            sustain: 0,
            release: 0.08
          }
        }).toDestination();
        this.confirmSynth.volume.value = -6;

        this.tensionAlarmSynth = new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.01,
            decay: 0.1,
            sustain: 0,
            release: 0.05
          }
        }).toDestination();
        this.tensionAlarmSynth.volume.value = -18;
      });
    });
  }

  public dispose(): void {
    this.removeGestureListeners();
    this._tracker.clear();
    if (this.tensionSynth) this.tensionSynth.dispose();
    if (this.impactSynth) this.impactSynth.dispose();
    if (this.noiseSynth) this.noiseSynth.dispose();
    if (this.tickSynth) this.tickSynth.dispose();
    if (this.confirmSynth) this.confirmSynth.dispose();
    if (this.tensionAlarmSynth) this.tensionAlarmSynth.dispose();
    if (this.sfxPanner) this.sfxPanner.dispose();
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
