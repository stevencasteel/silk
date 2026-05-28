import type { MembraneSynth, NoiseSynth, Synth, Panner } from "tone";

export class SfxSynthesizerRegistry {
  public impactSynth: MembraneSynth | null = null;
  public noiseSynth: NoiseSynth | null = null;
  public tickSynth: Synth | null = null;
  public confirmSynth: Synth | null = null;
  public tensionAlarmSynth: Synth | null = null;
  public sfxPanner: Panner | null = null;

  public async initialize(Tone: typeof import("tone")): Promise<void> {
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

  public dispose(): void {
    this.impactSynth?.dispose();
    this.noiseSynth?.dispose();
    this.tickSynth?.dispose();
    this.confirmSynth?.dispose();
    this.tensionAlarmSynth?.dispose();
    this.sfxPanner?.dispose();
  }
}
