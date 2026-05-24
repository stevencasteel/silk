import * as Tone from "tone";

export class TensionSynthesizer {
  private fmOsc: Tone.FMOscillator | null = null;
  private lowpassFilter: Tone.Filter | null = null;
  private gainNode: Tone.Gain | null = null;
  private lfo: Tone.LFO | null = null;

  public initialize(): void {
    this.lowpassFilter = new Tone.Filter({
      frequency: 200,
      type: "lowpass",
      Q: 4.0
    }).toDestination();

    this.fmOsc = new Tone.FMOscillator({
      frequency: 55,
      type: "sawtooth",
      modulationType: "sine",
      harmonicity: 1.5,
      modulationIndex: 5
    });

    this.gainNode = new Tone.Gain(0.0);

    this.lfo = new Tone.LFO({
      frequency: 0.2,
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

    const now = Tone.now();
    const clampedTension = Math.max(0, Math.min(1, tensionVal));

    const targetBaseFreq = 55 + clampedTension * 55;
    const targetModulationIndex = 5 + clampedTension * 25;
    const targetGain = clampedTension > 0.02 ? 0.05 + clampedTension * 0.22 : 0.0;

    this.fmOsc.frequency.setTargetAtTime(targetBaseFreq, now, 0.1);
    this.fmOsc.modulationIndex.setTargetAtTime(targetModulationIndex, now, 0.1);
    this.gainNode.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  public handleStateChange(state: string): void {
    if (!this.fmOsc || !this.lfo || !this.lowpassFilter) return;
    const now = Tone.now();

    if (state.includes("BERSERK")) {
      this.fmOsc.frequency.setTargetAtTime(110, now, 0.5);
      this.lfo.frequency.setTargetAtTime(4.0, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(2.5, now, 0.5);
    } else if (state === "WEAVER DEFEATED") {
      this.fmOsc.frequency.setTargetAtTime(30, now, 0.5);
      this.lfo.frequency.setTargetAtTime(0.05, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(1.0, now, 0.5);
    } else {
      this.fmOsc.frequency.setTargetAtTime(55, now, 0.5);
      this.lfo.frequency.setTargetAtTime(0.2, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(1.5, now, 0.5);
    }
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
