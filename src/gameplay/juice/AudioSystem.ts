import { ISystem, IDisposable, IUpdateable } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { TetherComponent } from "../../core/ecs/Components";
import * as Tone from "tone";

export class AudioSystem implements ISystem, IUpdateable, IDisposable {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.UI;

  private _tracker = new SubscriptionTracker();
  private _synth: Tone.Synth | null = null;
  private _noise: Tone.Noise | null = null;
  private _filter: Tone.Filter | null = null;
  private _ratchetPlayer: Tone.Player | null = null;
  private _isInitialized = false;

  private _isReeling = false;
  private _lastMaxLength = 0;

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
        this.stopRatchet();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.playDefeatSound();
        this.stopRatchet();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.stopRatchet();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        if (isPaused) {
          this.stopRatchet();
        }
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

      this._ratchetPlayer = new Tone.Player({
        url: "/sfx/tether_ratchet.mp3",
        loop: true,
        autostart: false,
        fadeIn: 0.05,
        fadeOut: 0.05
      }).toDestination();

      this._isInitialized = true;
    } catch (e) {
      console.warn("Tone.js failed to initialize:", e);
    }
  }

  public update(dt: number): void {
    void dt;
    if (!this._isInitialized || !this._ratchetPlayer) return;

    const tethers = this.context.stores.get<TetherComponent>("tether");
    const playerTether = tethers.get(this.context.refs.player);

    if (playerTether && playerTether.isAttached) {
      const velocityActive = playerTether.reelVelocity !== 0;
      const lengthChangeActive = Math.abs(playerTether.maxLength - this._lastMaxLength) > 0.001;
      const isCurrentlyReeling = velocityActive || lengthChangeActive;

      this._lastMaxLength = playerTether.maxLength;

      if (isCurrentlyReeling) {
        if (!this._isReeling) {
          this._isReeling = true;
          this.startRatchet();
        }
      } else {
        if (this._isReeling) {
          this._isReeling = false;
          this.stopRatchet();
        }
      }
    } else {
      if (this._isReeling) {
        this._isReeling = false;
        this.stopRatchet();
      }
    }
  }

  private startRatchet(): void {
    if (this._isInitialized && this._ratchetPlayer && this._ratchetPlayer.loaded) {
      if (this._ratchetPlayer.state !== "started") {
        const randomOffset = Math.random() * 6.0;
        this._ratchetPlayer.start(undefined, randomOffset);
      }
    }
  }

  private stopRatchet(): void {
    this._isReeling = false;
    if (this._ratchetPlayer && this._ratchetPlayer.state === "started") {
      this._ratchetPlayer.stop();
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
    this.stopRatchet();
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
    if (this._ratchetPlayer) {
      this._ratchetPlayer.dispose();
      this._ratchetPlayer = null;
    }
    this._isInitialized = false;
  }
}
