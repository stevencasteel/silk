import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { TensionSynthesizer } from "../tone/TensionSynthesizer";
import * as Tone from "tone";

export class AudioDirectorSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private tensionSynth: TensionSynthesizer | null = null;
  private impactSynth: Tone.MembraneSynth | null = null;
  private noiseSynth: Tone.NoiseSynth | null = null;
  private initialized: boolean = false;
  private unsub: (() => void) | null = null;
  private unsubImpact: (() => void) | null = null;
  private unsubWardenHit: (() => void) | null = null;
  private unsubState: (() => void) | null = null;

  constructor(private broker: EventBroker) {}

  public init(): void {
    const triggerOnFirstGesture = (): void => {
      this.bootAudioEngine();
      window.removeEventListener("click", triggerOnFirstGesture);
      window.removeEventListener("keydown", triggerOnFirstGesture);
      window.removeEventListener("touchend", triggerOnFirstGesture);
      window.removeEventListener("mousedown", triggerOnFirstGesture);
    };
    window.addEventListener("click", triggerOnFirstGesture);
    window.addEventListener("keydown", triggerOnFirstGesture);
    window.addEventListener("touchend", triggerOnFirstGesture);
    window.addEventListener("mousedown", triggerOnFirstGesture);

    this.unsub = this.broker.subscribe(GameEvent.ROPE_TENSION_CHANGE, (payload) => {
      if (this.initialized && this.tensionSynth) {
        this.tensionSynth.updateDronePitch(payload.tension);
      }
    });

    this.unsubImpact = this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
      if (this.initialized && this.impactSynth) this.impactSynth.triggerAttackRelease("C2", "8n");
      if (this.initialized && this.noiseSynth) this.noiseSynth.triggerAttackRelease("16n");
    });

    this.unsubWardenHit = this.broker.subscribe(GameEvent.WARDEN_DAMAGED, () => {
      if (this.initialized && this.impactSynth) this.impactSynth.triggerAttackRelease("E3", "16n");
    });

    this.unsubState = this.broker.subscribe(GameEvent.WARDEN_STATE_CHANGE, (payload) => {
      if (this.initialized && this.tensionSynth) {
        this.tensionSynth.handleStateChange(payload.state);
      }
    });
  }

  public update(_dt: number): void {}

  private bootAudioEngine(): void {
    if (this.initialized) return;
    Tone.start().then(() => {
      this.initialized = true;

      // Default the entire application's master output to muted
      Tone.getDestination().mute = true;

      this.tensionSynth = new TensionSynthesizer();
      this.tensionSynth.initialize();
      
      this.impactSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.4, attackCurve: "exponential" }
      }).toDestination();

      this.noiseSynth = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
      }).toDestination();
      this.noiseSynth.volume.value = -10;

      this.broker.publish(GameEvent.USER_GESTURE_REGISTERED, undefined);
    });
  }

  public dispose(): void {
    if (this.unsub) this.unsub();
    if (this.unsubImpact) this.unsubImpact();
    if (this.unsubWardenHit) this.unsubWardenHit();
    if (this.unsubState) this.unsubState();
    if (this.tensionSynth) this.tensionSynth.dispose();
    if (this.impactSynth) this.impactSynth.dispose();
    if (this.noiseSynth) this.noiseSynth.dispose();
  }
}
