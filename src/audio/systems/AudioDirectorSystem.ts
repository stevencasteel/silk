import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { TensionSynthesizer } from "../tone/TensionSynthesizer";
import { AUDIO_PRESETS } from "../tone/AudioPresets";
import * as Tone from "tone";

export class AudioDirectorSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private tensionSynth: TensionSynthesizer | null = null;
  private impactSynth: Tone.MembraneSynth | null = null;
  private noiseSynth: Tone.NoiseSynth | null = null;
  private initialized: boolean = false;
  private unsub: (() => void) | null = null;
  private unsubImpact: (() => void) | null = null;
  private unsubWeaverHit: (() => void) | null = null;
  private unsubState: (() => void) | null = null;
  private unsubGameOver: (() => void) | null = null;
  private unsubGameWin: (() => void) | null = null;
  private unsubGameReset: (() => void) | null = null;
  private unsubGamePaused: (() => void) | null = null;
  private gestureTriggerRef: (() => void) | null = null;

  constructor(private broker: EventBroker) {}

  public init(): void {
    this.gestureTriggerRef = (): void => {
      this.bootAudioEngine();
      this.removeGestureListeners();
    };

    window.addEventListener("click", this.gestureTriggerRef);
    window.addEventListener("keydown", this.gestureTriggerRef);
    window.addEventListener("touchend", this.gestureTriggerRef);
    window.addEventListener("mousedown", this.gestureTriggerRef);

    this.unsub = this.broker.subscribe(GameEvent.SILK_TENSION_CHANGE, (payload) => {
      if (this.initialized && this.tensionSynth) {
        this.tensionSynth.updateDronePitch(payload.tension);
      }
    });

    this.unsubImpact = this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
      const presets = AUDIO_PRESETS.PLAYER;
      if (this.initialized && this.impactSynth) {
        this.impactSynth.triggerAttackRelease(presets.DAMAGED_NOTE, presets.DAMAGED_DURATION);
      }
      if (this.initialized && this.noiseSynth) {
        this.noiseSynth.triggerAttackRelease(presets.DAMAGED_DURATION);
      }
    });

    this.unsubWeaverHit = this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
      const presets = AUDIO_PRESETS.WEAVER;
      if (this.initialized && this.impactSynth) {
        this.impactSynth.triggerAttackRelease(presets.DAMAGED_NOTE, presets.DAMAGED_DURATION);
      }
    });

    this.unsubState = this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, (payload) => {
      if (this.initialized && this.tensionSynth) {
        this.tensionSynth.handleStateChange(payload.state);
      }
    });

    this.unsubGameOver = this.broker.subscribe(GameEvent.GAME_OVER, () => {
      if (this.initialized && this.tensionSynth) {
        this.tensionSynth.fadeOutAndMute();
      }
    });

    this.unsubGameWin = this.broker.subscribe(GameEvent.GAME_WIN, () => {
      if (this.initialized && this.tensionSynth) {
        this.tensionSynth.fadeOutAndMute();
      }
    });

    this.unsubGameReset = this.broker.subscribe(GameEvent.GAME_RESET, () => {
      if (this.initialized && this.tensionSynth) {
        this.tensionSynth.resetToBaseline();
      }
    });

    this.unsubGamePaused = this.broker.subscribe(GameEvent.GAME_PAUSED, (payload) => {
      if (this.initialized && this.tensionSynth) {
        if (payload.isPaused) {
          this.tensionSynth.fadeOutAndMute();
        }
      }
    });
  }

  public update(): void {}

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
    Tone.start().then(() => {
      this.initialized = true;

      Tone.getDestination().mute = false;

      this.tensionSynth = new TensionSynthesizer();
      this.tensionSynth.initialize();

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
      }).toDestination();

      const presets = AUDIO_PRESETS.PLAYER;

      this.noiseSynth = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: presets.NOISE_DECAY, sustain: 0, release: presets.NOISE_DECAY }
      }).toDestination();
      this.noiseSynth.volume.value = presets.NOISE_VOLUME;

      this.broker.publish(GameEvent.USER_GESTURE_REGISTERED, undefined);
    });
  }

  public dispose(): void {
    this.removeGestureListeners();
    if (this.unsub) this.unsub();
    if (this.unsubImpact) this.unsubImpact();
    if (this.unsubWeaverHit) this.unsubWeaverHit();
    if (this.unsubState) this.unsubState();
    if (this.unsubGameOver) this.unsubGameOver();
    if (this.unsubGameWin) this.unsubGameWin();
    if (this.unsubGameReset) this.unsubGameReset();
    if (this.unsubGamePaused) this.unsubGamePaused();
    if (this.tensionSynth) this.tensionSynth.dispose();
    if (this.impactSynth) this.impactSynth.dispose();
    if (this.noiseSynth) this.noiseSynth.dispose();
  }
}
