import type { Synth, NoiseSynth, Gain, Filter, Chorus } from "tone";
import { ProceduralSoundManager } from "./ProceduralSoundManager";

export class HealthBugSoundGenerator {
  private soundManager: ProceduralSoundManager;
  private ToneModule: typeof import("tone") | null = null;

  private popSynth: Synth | null = null;
  private healSynth: Synth | null = null;
  private bounceSynth: Synth | null = null;
  private impactNoise: NoiseSynth | null = null;
  
  private chorus: Chorus | null = null;
  private lowPassFilter: Filter | null = null;
  private masterGain: Gain | null = null;

  constructor(soundManager: ProceduralSoundManager) {
    this.soundManager = soundManager;
  }

  public async initialize(ToneRaw: unknown): Promise<void> {
    const Tone = ToneRaw as typeof import("tone");
    this.ToneModule = Tone;

    const bus = this.soundManager.getHealthBugBus();
    if (!bus) return;

    this.masterGain = new Tone.Gain(0.8).connect(bus);
    
    this.chorus = new Tone.Chorus(4, 2.5, 0.5).connect(this.masterGain);
    this.chorus.start();
    
    this.lowPassFilter = new Tone.Filter(2000, "lowpass").connect(this.masterGain);

    this.popSynth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
    }).connect(this.lowPassFilter);
    this.popSynth.volume.value = -12;

    this.healSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 }
    }).connect(this.chorus);
    this.healSynth.volume.value = -10;

    this.bounceSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
    }).connect(this.lowPassFilter);
    this.bounceSynth.volume.value = -8;

    this.impactNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 }
    }).connect(this.masterGain);
    this.impactNoise.volume.value = -10;
  }

  public triggerPop(variant: "NORMAL" | "SPIKED" | "PINBALL" | "SPINNING"): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(2)) return;
    const now = this.ToneModule.now();

    if (variant === "SPIKED") {
      if (this.popSynth) {
        this.popSynth.triggerAttackRelease("C4", "16n", now, 0.8);
        this.popSynth.triggerAttackRelease("G3", "16n", now + 0.05, 0.6);
      }
    } else {
      if (this.popSynth) {
        this.popSynth.triggerAttackRelease("C5", "32n", now, 0.8);
        this.popSynth.triggerAttackRelease("E5", "32n", now + 0.04, 0.7);
        this.popSynth.triggerAttackRelease("G5", "16n", now + 0.08, 0.9);
      }
    }
    this.soundManager.recordSound("health_bug_pop", 2, 0.15);
  }

  public triggerHeal(): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(3)) return;
    const now = this.ToneModule.now();
    
    if (this.healSynth) {
      const notes = ["C5", "E5", "G5", "C6"];
      notes.forEach((note, i) => {
        this.healSynth?.triggerAttackRelease(note, "8n", now + i * 0.08, 0.7);
      });
    }
    this.soundManager.recordSound("health_bug_heal", 3, 0.4);
  }

  public triggerPinballBounce(): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(2)) return;
    const now = this.ToneModule.now();
    
    if (this.bounceSynth) {
      this.bounceSynth.triggerAttackRelease("C6", "16n", now, 0.9);
      this.bounceSynth.frequency.setValueAtTime(1046.5, now);
      this.bounceSynth.frequency.exponentialRampToValueAtTime(261.63, now + 0.15);
    }
    this.soundManager.recordSound("health_bug_pinball", 2, 0.15);
  }

  public triggerSpikedImpact(): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(3)) return;
    const now = this.ToneModule.now();
    
    if (this.impactNoise && this.lowPassFilter) {
      this.lowPassFilter.frequency.setValueAtTime(8000, now);
      this.lowPassFilter.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      this.impactNoise.triggerAttackRelease("16n", now, 1.0);
    }
    this.soundManager.recordSound("health_bug_spiked", 3, 0.1);
  }

  public dispose(): void {
    this.popSynth?.dispose();
    this.healSynth?.dispose();
    this.bounceSynth?.dispose();
    this.impactNoise?.dispose();
    this.chorus?.dispose();
    this.lowPassFilter?.dispose();
    this.masterGain?.dispose();
  }
}
