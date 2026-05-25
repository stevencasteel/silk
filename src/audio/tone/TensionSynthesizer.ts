import * as Tone from "tone";
import { AUDIO_PRESETS } from "./AudioPresets";

export class TensionSynthesizer {
  private fmOsc: Tone.FMOscillator | null = null;
  private lowpassFilter: Tone.Filter | null = null;
  private gainNode: Tone.Gain | null = null;
  private lfo: Tone.LFO | null = null;
  private lastTension: number = -999.0;

  public initialize(): void {
    this.lowpassFilter = new Tone.Filter({
      frequency: 200,
      type: "lowpass",
      Q: 4.0
    }).toDestination();

    const presets = AUDIO_PRESETS.WEAVER;

    this.fmOsc = new Tone.FMOscillator({
      frequency: presets.DRONE_BASE_FREQ,
      type: "sawtooth",
      modulationType: "sine",
      harmonicity: presets.HARMONICITY_NORMAL,
      modulationIndex: AUDIO_PRESETS.TENSION_SYNTH.DRONE_MOD_INDEX_BASE,
      workspace: undefined
    } as unknown as ConstructorParameters<typeof Tone.FMOscillator>[0]);

    this.gainNode = new Tone.Gain(0.0);

    this.lfo = new Tone.LFO({
      frequency: presets.LFO_NORMAL_HZ,
      min: 150,
      max: 280
    });

    this.fmOsc.connect(this.gainNode);
    this.gainNode.connect(this.lowpassFilter);
    this.lfo.connect(this.lowpassFilter.frequency);

    this.lfo.start();
    this.fmOsc.start();
  }

  public updateDronePitch(tensionVal: number): void {
    if (!this.fmOsc || !this.gainNode || !this.lowpassFilter) return;

    const clampedTension = Math.max(0, Math.min(1, tensionVal));

    if (Math.abs(clampedTension - this.lastTension) < 0.005) {
      return;
    }
    this.lastTension = clampedTension;

    const now = Tone.now();
    const presets = AUDIO_PRESETS.WEAVER;
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;

    const targetBaseFreq = presets.DRONE_BASE_FREQ + clampedTension * presets.DRONE_BASE_FREQ;
    const targetModulationIndex =
      synthConfig.DRONE_MOD_INDEX_BASE + clampedTension * synthConfig.DRONE_MOD_INDEX_SCALE;
    const targetGain =
      clampedTension > synthConfig.DRONE_GAIN_THRESHOLD
        ? synthConfig.DRONE_MIN_GAIN + clampedTension * synthConfig.DRONE_MAX_GAIN_ADD
        : 0.0;

    this.fmOsc.frequency.setTargetAtTime(targetBaseFreq, now, synthConfig.DRONE_PITCH_RAMP_TIME);
    this.fmOsc.modulationIndex.setTargetAtTime(
      targetModulationIndex,
      now,
      synthConfig.DRONE_PITCH_RAMP_TIME
    );
    this.gainNode.gain.setTargetAtTime(targetGain, now, synthConfig.DRONE_GAIN_RAMP_TIME);
  }

  public resumeFromPause(): void {
    if (!this.fmOsc || !this.gainNode || !this.lowpassFilter) return;
    const now = Tone.now();
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;
    const clampedTension = this.lastTension === -999.0 ? 0.0 : this.lastTension;
    const targetGain =
      clampedTension > synthConfig.DRONE_GAIN_THRESHOLD
        ? synthConfig.DRONE_MIN_GAIN + clampedTension * synthConfig.DRONE_MAX_GAIN_ADD
        : 0.0;
    this.gainNode.gain.setTargetAtTime(targetGain, now, synthConfig.DRONE_GAIN_RAMP_TIME);
  }

  public handleStateChange(state: string): void {
    if (!this.fmOsc || !this.lfo || !this.lowpassFilter) return;
    const now = Tone.now();
    const presets = AUDIO_PRESETS.WEAVER;

    if (state.includes("BERSERK")) {
      this.fmOsc.frequency.setTargetAtTime(presets.DRONE_BERSERK_FREQ, now, 0.5);
      this.lfo.frequency.setTargetAtTime(presets.LFO_BERSERK_HZ, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(presets.HARMONICITY_BERSERK, now, 0.5);
    } else if (state === "WEAVER DEFEATED") {
      this.fmOsc.frequency.setTargetAtTime(presets.DRONE_DEFEATED_FREQ, now, 0.5);
      this.lfo.frequency.setTargetAtTime(presets.LFO_DEFEATED_HZ, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(presets.HARMONICITY_DEFEATED, now, 0.5);
    } else {
      this.fmOsc.frequency.setTargetAtTime(presets.DRONE_BASE_FREQ, now, 0.5);
      this.lfo.frequency.setTargetAtTime(presets.LFO_NORMAL_HZ, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(presets.HARMONICITY_NORMAL, now, 0.5);
    }
  }

  public fadeOutAndMute(): void {
    if (!this.gainNode) return;
    const now = Tone.now();
    this.gainNode.gain.setTargetAtTime(0.0, now, 0.15);
  }

  public resetToBaseline(): void {
    if (!this.fmOsc || !this.gainNode || !this.lfo || !this.lowpassFilter) return;
    const now = Tone.now();
    const presets = AUDIO_PRESETS.WEAVER;

    this.gainNode.gain.setValueAtTime(0.0, now);
    this.fmOsc.frequency.setValueAtTime(presets.DRONE_BASE_FREQ, now);
    this.fmOsc.harmonicity.setValueAtTime(presets.HARMONICITY_NORMAL, now);
    this.lfo.frequency.setValueAtTime(presets.LFO_NORMAL_HZ, now);
  }

  public dispose(): void {
    if (this.fmOsc) {
      this.fmOsc.stop();
      this.fmOsc.dispose();
    }
    if (this.lfo) {
      this.lfo.stop();
      this.lfo.dispose();
    }
    if (this.lowpassFilter) {
      this.lowpassFilter.dispose();
    }
    if (this.gainNode) {
      this.gainNode.dispose();
    }
  }
}
