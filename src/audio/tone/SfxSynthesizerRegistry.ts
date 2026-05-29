import { ISfxInstrument } from "../../contracts/IAudio";
import type { MembraneSynth, NoiseSynth, Synth, Panner } from "tone";

export class SfxSynthesizerRegistry implements ISfxInstrument {
  public impactSynth: MembraneSynth | null = null;
  public noiseSynth: NoiseSynth | null = null;
  public tickSynth: Synth | null = null;
  public confirmSynth: Synth | null = null;
  public tensionAlarmSynth: Synth | null = null;
  public sfxPanner: Panner | null = null;

  private lastImpactTime = 0;
  private lastNoiseTime = 0;
  private lastTickTime = 0;
  private lastConfirmTime = 0;
  private lastAlarmTime = 0;

  public async initialize(ToneRaw: unknown): Promise<void> {
    const Tone = ToneRaw as typeof import("tone");
    this.sfxPanner = new Tone.Panner(0).toDestination();

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

    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1
      }
    }).connect(this.sfxPanner);
    this.noiseSynth.volume.value = -10;

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
  }

  public triggerImpact(pitch: string | number, duration: string, delay?: string | number): void {
    const now = performance.now();
    if (now - this.lastImpactTime < 40) return;
    this.lastImpactTime = now;

    try {
      if (this.impactSynth) {
        this.impactSynth.triggerAttackRelease(pitch, duration, delay);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerNoise(duration: string, delay?: string | number): void {
    const now = performance.now();
    if (now - this.lastNoiseTime < 40) return;
    this.lastNoiseTime = now;

    try {
      if (this.noiseSynth) {
        this.noiseSynth.triggerAttackRelease(duration, delay);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerTick(pitch: string, duration: string, time?: number): void {
    const now = performance.now();
    if (now - this.lastTickTime < 25) return;
    this.lastTickTime = now;

    try {
      if (this.tickSynth) {
        // Prevent start-time drift asserts by allowing Tone to auto-schedule immediate triggers
        void time;
        this.tickSynth.triggerAttackRelease(pitch, duration);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerConfirm(pitch: string, duration: string, time?: number): void {
    const now = performance.now();
    if (now - this.lastConfirmTime < 40) return;
    this.lastConfirmTime = now;

    try {
      if (this.confirmSynth) {
        void time;
        this.confirmSynth.triggerAttackRelease(pitch, duration);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerAlarm(pitch: string, duration: string, time?: number): void {
    const now = performance.now();
    if (now - this.lastAlarmTime < 40) return;
    this.lastAlarmTime = now;

    try {
      if (this.tensionAlarmSynth) {
        void time;
        this.tensionAlarmSynth.triggerAttackRelease(pitch, duration);
      }
    } catch (e) {
      void e;
    }
  }

  public setSfxPan(pan: number, time: number): void {
    try {
      if (this.sfxPanner) {
        this.sfxPanner.pan.setTargetAtTime(pan, time, 0.05);
      }
    } catch (e) {
      void e;
    }
  }

  public setNoiseDecay(value: number): void {
    try {
      if (this.noiseSynth) {
        this.noiseSynth.envelope.decay = value;
      }
    } catch (e) {
      void e;
    }
  }

  public dispose(): void {
    try {
      this.impactSynth?.dispose();
      this.noiseSynth?.dispose();
      this.tickSynth?.dispose();
      this.confirmSynth?.dispose();
      this.tensionAlarmSynth?.dispose();
      this.sfxPanner?.dispose();
    } catch (e) {
      void e;
    }
  }
}
