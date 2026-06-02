import { ISystem, IDisposable, IUpdateable } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { TetherComponent, TraversalStateComponent } from "../../core/ecs/Components";
import * as Tone from "tone";
import { ProceduralAmbienceEngine } from "./ProceduralAmbienceEngine";

export class AudioSystem implements ISystem, IUpdateable, IDisposable {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.UI;

  private _tracker = new SubscriptionTracker();
  private _synth: Tone.Synth | null = null;
  private _noise: Tone.Noise | null = null;
  private _filter: Tone.Filter | null = null;
  private _ratchetPlayer: Tone.Player | null = null;
  private _webImpactPlayer: Tone.Player | null = null;
  private _spiderSoundsPlayer: Tone.Player | null = null;
  private _boingPlayer: Tone.Player | null = null;
  private _webShotPlayer: Tone.Player | null = null;
  private _bossDeathPlayer: Tone.Player | null = null;
  private _healthBugRupturePlayer: Tone.Player | null = null;
  private _touchedSpikePlayer: Tone.Player | null = null;
  private _flingPlayer: Tone.Player | null = null;
  private _crowdVictoryPlayer: Tone.Player | null = null;
  private _crowdDefeatPlayer: Tone.Player | null = null;
  private _webBreakPlayer: Tone.Player | null = null;
  private _webBreakListener: (() => void) | null = null;
  private _isInitialized = false;

  private _isReeling = false;
  private _lastMaxLength = 0;

  private _ambienceEngine = new ProceduralAmbienceEngine();
  private _gestureCleanup: (() => void) | null = null;
  private _preloadedBuffers = new Map<string, Tone.ToneAudioBuffer>();

  constructor(private context: SystemContext) {}

  public async init(): Promise<void> {
    const urls = [
      "sfx/tether_ratchet.mp3",
      "sfx/web_impact.mp3",
      "sfx/spider_sounds.mp3",
      "sfx/boss_boing.mp3",
      "sfx/web_shot.mp3",
      "sfx/boss_death.mp3",
      "sfx/health_bug_rupture.mp3",
      "sfx/touched_spike.mp3",
      "sfx/fling.mp3",
      "sfx/crowd_victory.mp3",
      "sfx/crowd_defeat.mp3",
      "sfx/web_break.mp3"
    ];

    await Promise.all(
      urls.map((url) => {
        return new Promise<void>((resolve) => {
          const buf = new Tone.ToneAudioBuffer();
          buf.load(url).then(() => {
            this._preloadedBuffers.set(url, buf);
            resolve();
          }).catch(() => {
            resolve();
          });
        });
      })
    );

    const startOnGesture = () => {
      this.initAudio();
      if (this._isInitialized && this._gestureCleanup) {
        this._gestureCleanup();
      }
    };
    window.addEventListener("pointerdown", startOnGesture);
    window.addEventListener("keydown", startOnGesture);

    this._gestureCleanup = () => {
      window.removeEventListener("pointerdown", startOnGesture);
      window.removeEventListener("keydown", startOnGesture);
    };

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        this.initAudio();
        this.playConfirmSound();
        if (this._gestureCleanup) {
          this._gestureCleanup();
        }
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
        this.stopCrowdSounds();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        if (isPaused) {
          this.stopRatchet();
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_WALL_HIT, () => {
        this.playWebImpactSound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_LANDED, () => {
        this.playWebImpactSound();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_DAMAGED, (payload) => {
        if (payload && (
          payload.source === "BUG_SPIKES" ||
          payload.source === "SPIKE_BUG_HEAD" ||
          payload.source === "HEALTH_BUG_SPIKES"
        )) {
          this.playTouchedSpike();
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_DAMAGED, (payload) => {
        this.playSpiderSounds();
        if (payload && (
          payload.source === "HEALTH_BUG_SPIKES" ||
          payload.source === "HEALTH_BUG_PINBALL_SPIKES"
        )) {
          this.playTouchedSpike();
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_BOUNCED, () => {
        this.playBossBoing();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_SHOOT, (payload) => {
        if (payload && !payload.isRelease) {
          this.playWebShot();
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        this.playBossDeath();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.HEALTH_BUG_RUPTURED, (payload) => {
        this.playHealthBugRupture();
        if (payload && payload.bySpikes) {
          this.playTouchedSpike();
        }
      })
    );

    this._webBreakListener = () => {
      this.playWebBreak();
    };
    window.addEventListener("silk-web-break", this._webBreakListener);

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, (payload) => {
        if (
          payload.state === "LAUNCHING" &&
          payload.flingStage !== undefined &&
          (payload.flingStage === 2 || payload.flingStage === 3)
        ) {
          this.playFling();
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

      const getPlayer = (url: string, loop = false, fadeIn = 0, fadeOut = 0) => {
        const preloaded = this._preloadedBuffers.get(url);
        return new Tone.Player({
          url: preloaded || url,
          loop,
          autostart: false,
          fadeIn,
          fadeOut
        }).toDestination();
      };

      this._ratchetPlayer = getPlayer("sfx/tether_ratchet.mp3", true, 0.05, 0.05);
      this._webImpactPlayer = getPlayer("sfx/web_impact.mp3");
      this._spiderSoundsPlayer = getPlayer("sfx/spider_sounds.mp3");
      this._boingPlayer = getPlayer("sfx/boss_boing.mp3");
      this._webShotPlayer = getPlayer("sfx/web_shot.mp3");
      this._bossDeathPlayer = getPlayer("sfx/boss_death.mp3");
      this._healthBugRupturePlayer = getPlayer("sfx/health_bug_rupture.mp3");
      this._touchedSpikePlayer = getPlayer("sfx/touched_spike.mp3");
      this._flingPlayer = getPlayer("sfx/fling.mp3");
      this._crowdVictoryPlayer = getPlayer("sfx/crowd_victory.mp3", false, 0, 1.0);
      this._crowdDefeatPlayer = getPlayer("sfx/crowd_defeat.mp3", false, 0, 1.0);
      this._webBreakPlayer = getPlayer("sfx/web_break.mp3");

      const rawCtx = Tone.context.rawContext as AudioContext;
      if (rawCtx) {
        this._ambienceEngine.start(rawCtx, rawCtx.destination);
      }

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

  private stopCrowdSounds(): void {
    if (this._isInitialized) {
      if (this._crowdVictoryPlayer && this._crowdVictoryPlayer.state === "started") {
        this._crowdVictoryPlayer.stop();
      }
      if (this._crowdDefeatPlayer && this._crowdDefeatPlayer.state === "started") {
        this._crowdDefeatPlayer.stop();
      }
    }
  }

  private playWithVariance(player: Tone.Player | null, detuneVar: number, volVar: number): void {
    if (!this._isInitialized || !player || !player.loaded) return;
    try {
      if (player.state === "started") {
        player.stop();
      }
      const cents = (Math.random() - 0.5) * 2 * detuneVar * 0.75;
      player.playbackRate = Math.pow(2, cents / 1200);
      player.volume.value = (Math.random() - 0.5) * 2 * volVar;
      player.start();
    } catch {
      // Defensive
    }
  }

  private playWebImpactSound(): void {
    const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
    const pTrav = travStore.get(this.context.refs.player);
    const isWebTrapped = pTrav ? pTrav.isWebTrapped : false;

    if (isWebTrapped) {
      this.playWithVariance(this._webImpactPlayer, 200, 2);
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
    if (this._isInitialized && this._crowdVictoryPlayer && this._crowdVictoryPlayer.loaded) {
      try {
        if (this._crowdVictoryPlayer.state === "started") {
          this._crowdVictoryPlayer.stop();
        }
        this._crowdVictoryPlayer.start();
      } catch {
        // Defensive catch-all
      }
    }
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
    if (this._isInitialized && this._crowdDefeatPlayer && this._crowdDefeatPlayer.loaded) {
      try {
        if (this._crowdDefeatPlayer.state === "started") {
          this._crowdDefeatPlayer.stop();
        }
        this._crowdDefeatPlayer.start();
      } catch {
        // Defensive catch-all
      }
    }
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

  private playSpiderSounds(): void {
    this.playWithVariance(this._spiderSoundsPlayer, 150, 1.5);
  }

  private playBossBoing(): void {
    this.playWithVariance(this._boingPlayer, 200, 2);
  }

  private playWebShot(): void {
    this.playWithVariance(this._webShotPlayer, 250, 2.5);
  }

  private playBossDeath(): void {
    this.playWithVariance(this._bossDeathPlayer, 50, 1);
  }

  private playHealthBugRupture(): void {
    this.playWithVariance(this._healthBugRupturePlayer, 150, 2);
  }

  private playTouchedSpike(): void {
    this.playWithVariance(this._touchedSpikePlayer, 100, 1.5);
  }


  private playWebBreak(): void {
    this.playWithVariance(this._webBreakPlayer, 120, 1.5);
  }

  private playFling(): void {
    this.playWithVariance(this._flingPlayer, 100, 1.5);
  }

  public dispose(): void {
    this._tracker.clear();
    this.stopRatchet();
    this._ambienceEngine.stop();
    if (this._gestureCleanup) {
      this._gestureCleanup();
    }
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
    if (this._webImpactPlayer) {
      this._webImpactPlayer.dispose();
      this._webImpactPlayer = null;
    }
    if (this._spiderSoundsPlayer) {
      this._spiderSoundsPlayer.dispose();
      this._spiderSoundsPlayer = null;
    }
    if (this._boingPlayer) {
      this._boingPlayer.dispose();
      this._boingPlayer = null;
    }
    if (this._webShotPlayer) {
      this._webShotPlayer.dispose();
      this._webShotPlayer = null;
    }
    if (this._bossDeathPlayer) {
      this._bossDeathPlayer.dispose();
      this._bossDeathPlayer = null;
    }
    if (this._healthBugRupturePlayer) {
      this._healthBugRupturePlayer.dispose();
      this._healthBugRupturePlayer = null;
    }
    if (this._touchedSpikePlayer) {
      this._touchedSpikePlayer.dispose();
      this._touchedSpikePlayer = null;
    }
    if (this._flingPlayer) {
      this._flingPlayer.dispose();
      this._flingPlayer = null;
    }
    if (this._crowdVictoryPlayer) {
      this._crowdVictoryPlayer.dispose();
      this._crowdVictoryPlayer = null;
    }
    if (this._crowdDefeatPlayer) {
      this._crowdDefeatPlayer.dispose();
      this._crowdDefeatPlayer = null;
    }
    if (this._webBreakListener) {
      window.removeEventListener("silk-web-break", this._webBreakListener);
      this._webBreakListener = null;
    }
    if (this._webBreakPlayer) {
      this._webBreakPlayer.dispose();
      this._webBreakPlayer = null;
    }
    this._preloadedBuffers.forEach((buf) => buf.dispose());
    this._preloadedBuffers.clear();
    this._isInitialized = false;
  }
}
