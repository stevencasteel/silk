import * as Tone from "tone";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { TensionSynthesizer } from "./TensionSynthesizer";

export class ToneAudioManager {
  private broker: EventBroker;
  private tensionSynth: TensionSynthesizer | null = null;
  private initialized: boolean = false;
  private unsub: (() => void) | null = null;

  constructor(broker: EventBroker) {
    this.broker = broker;
  }

  public initialize(): void {
    if (typeof window === "undefined") return;

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
  }

  private bootAudioEngine(): void {
    if (this.initialized) return;

    Tone.start().then(() => {
      this.initialized = true;
      this.tensionSynth = new TensionSynthesizer();
      this.tensionSynth.initialize();
      this.broker.publish(GameEvent.USER_GESTURE_REGISTERED, undefined);
    });
  }

  public dispose(): void {
    if (this.unsub) {
      this.unsub();
    }
    if (this.tensionSynth) {
      this.tensionSynth.dispose();
    }
  }
}
