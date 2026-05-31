import { ISystem, IDisposable } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import * as Tone from "tone";

export class AudioSystem implements ISystem, IDisposable {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.UI;

  private _tracker = new SubscriptionTracker();
  private _synth: Tone.Synth | null = null;
  private _noise: Tone.Noise | null = null;
  private _filter: Tone.Filter | null = null;
  private _isInitialized = false;

  constructor(private context: SystemContext) {}

  public init(): void {
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        this.initAudio();
        this.playConfirmSound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.UI_SFX_TICK, () => {
        this.playTickSound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.UI_SFX_CONFIRM, () => {
        this.playConfirmSound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.UI_SFX_REVEAL, () => {
        this.playRevealSound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.UI_SFX_DING, () => {
        this.playDingSound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_WIN, () => {
        this.playVictorySound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.playDefeatSound();
      })
    );
  }

  private async initAudio(): Promise<void> {
    if (this._isInitialized) return;
    try {
      await Tone.start();
      Tone.getDestination().volume.value = -6;

      this._synth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.0, release: 0.1 }
      }).toDestination();

      this._filter = new Tone.Filter({
        type: "bandpass",
        Q: 3
      }).toDestination();

      this._noise = new Tone.Noise("white").connect(this._filter);

      this._isInitialized = true;
    } catch (e) {
      console.warn("Tone.js failed to initialize:", e);
    }
  }

  private playTickSound(): void {
    if (!this._isInitialized || !this._synth) return;
    try {
      this._synth.envelope.attack = 0.001;
      this._synth.envelope.decay = 0.04;
      this._synth.triggerAttackRelease("A5", "16n");
    } catch {
      // Defensive catch-all
    }
  }

  private playConfirmSound(): void {
    if (!this._isInitialized || !this._synth) return;
    try {
      this._synth.envelope.attack = 0.01;
      this._synth.envelope.decay = 0.15;
      this._synth.triggerAttackRelease("A4", "8n");
      setTimeout(() => {
        if (this._synth) this._synth.triggerAttackRelease("E5", "8n");
      }, 80);
    } catch {
      // Defensive catch-all
    }
  }

  private playDingSound(): void {
    if (!this._isInitialized || !this._synth) return;
    try {
      this._synth.envelope.attack = 0.002;
      this._synth.envelope.decay = 0.25;
      this._synth.triggerAttackRelease("G6", "4n");
    } catch {
      // Defensive catch-all
    }
  }

  private playRevealSound(): void {
    if (!this._isInitialized || !this._noise || !this._filter || !this._synth) return;
    try {
      this._filter.frequency.setValueAtTime(150, Tone.now());
      this._filter.frequency.exponentialRampToValueAtTime(800, Tone.now() + 0.28);
      this._noise.start().stop("+0.28");

      this._synth.envelope.attack = 0.05;
      this._synth.envelope.decay = 0.3;
      this._synth.triggerAttackRelease("E5", "4n", "+0.05");
    } catch {
      // Defensive catch-all
    }
  }

  private playVictorySound(): void {
    if (!this._isInitialized || !this._synth) return;
    try {
      const now = Tone.now();
      const notes = ["C5", "E5", "G5", "C6", "E6"];
      notes.forEach((note, idx) => {
        this._synth?.triggerAttackRelease(note, "8n", now + idx * 0.05);
      });
    } catch {
      // Defensive catch-all
    }
  }

  private playDefeatSound(): void {
    if (!this._isInitialized || !this._synth) return;
    try {
      const now = Tone.now();
      const notes = ["G3", "E3", "C3"];
      notes.forEach((note, idx) => {
        this._synth?.triggerAttackRelease(note, "4n", now + idx * 0.25);
      });
    } catch {
      // Defensive catch-all
    }
  }

  public dispose(): void {
    this._tracker.clear();
    if (this._synth) {
      this._synth.dispose();
      this._synth = null;
    }
    if (this._noise) {
      this._noise.dispose();
      this._noise = null;
    }
    if (this._filter) {
      this._filter.dispose();
      this._filter = null;
    }
    this._isInitialized = false;
  }
}
