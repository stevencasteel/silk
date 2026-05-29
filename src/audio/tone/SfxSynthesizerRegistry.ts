import { ISfxInstrument } from "../../contracts/IAudio";
import type { MembraneSynth, NoiseSynth, Synth, Panner } from "tone";

export class SfxSynthesizerRegistry implements ISfxInstrument {
  public impactSynth: MembraneSynth | null = null;
  public noiseSynth: NoiseSynth | null = null;
  public tickSynth: Synth | null = null;
  public confirmSynth: Synth | null = null;
  public tensionAlarmSynth: Synth | null = null;
  public sfxPanner: Panner | null = null;

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
    if (this.impactSynth) {
      this.impactSynth.triggerAttackRelease(pitch, duration, delay);
    }
  }

  public triggerNoise(duration: string, delay?: string | number): void {
    if (this.noiseSynth) {
      this.noiseSynth.triggerAttackRelease(duration, delay);
    }
  }

  public triggerTick(pitch: string, duration: string, time?: number): void {
    if (this.tickSynth) {
      this.tickSynth.triggerAttackRelease(pitch, duration, time);
    }
  }

  public triggerConfirm(pitch: string, duration: string, time?: number): void {
    if (this.confirmSynth) {
      this.confirmSynth.triggerAttackRelease(pitch, duration, time);
    }
  }

  public triggerAlarm(pitch: string, duration: string, time?: number): void {
    if (this.tensionAlarmSynth) {
      this.tensionAlarmSynth.triggerAttackRelease(pitch, duration, time);
    }
  }

  public setSfxPan(pan: number, time: number): void {
    if (this.sfxPanner) {
      this.sfxPanner.pan.setTargetAtTime(pan, time, 0.05);
    }
  }

  public setNoiseDecay(value: number): void {
    if (this.noiseSynth) {
      this.noiseSynth.envelope.decay = value;
    }
  }

  public dispose(): void {
    this.impactSynth?.dispose();
    this.noiseSynth?.dispose();
    this.tickSynth?.dispose();
    this.confirmSynth?.dispose();
    this.tensionAlarmSynth?.dispose();
    this.sfxPanner?.dispose();
  }
}
