import type {
  Synth,
  FMSynth,
  NoiseSynth,
  MembraneSynth,
  Gain,
  Filter,
  BitCrusher,
  Distortion,
  AutoFilter
} from "tone";
import { ProceduralSoundManager } from "./ProceduralSoundManager";

export class WeaverSFXGenerator {
  private soundManager: ProceduralSoundManager;
  private ToneModule: typeof import("tone") | null = null;

  private prepSweepSynth: FMSynth | null = null;
  private tickSequencerSynth: Synth | null = null;
  private thrustStabSynth: Synth | null = null;
  private blastNoiseSynth: NoiseSynth | null = null;
  private glassShatterSynth: NoiseSynth | null = null;
  private subBassSynth: MembraneSynth | null = null;
  private glitchSynth: Synth | null = null;
  private webShotNoise: NoiseSynth | null = null;

  private bitCrusher: BitCrusher | null = null;
  private distortion: Distortion | null = null;
  private lowPassFilter: Filter | null = null;
  private autoFilter: AutoFilter | null = null;
  
  private masterGain: Gain | null = null;

  constructor(soundManager: ProceduralSoundManager) {
    this.soundManager = soundManager;
  }

  public async initialize(ToneRaw: unknown): Promise<void> {
    const Tone = ToneRaw as typeof import("tone");
    this.ToneModule = Tone;

    const bus = this.soundManager.getWeaverVocalBus();
    if (!bus) return;

    this.masterGain = new Tone.Gain(0.8).connect(bus);

    this.bitCrusher = new Tone.BitCrusher(4).connect(this.masterGain);
    this.distortion = new Tone.Distortion(0.6).connect(this.bitCrusher);
    this.lowPassFilter = new Tone.Filter(800, "lowpass").connect(this.distortion);
    this.autoFilter = new Tone.AutoFilter({
      frequency: "8n",
      baseFrequency: 200,
      octaves: 4
    }).connect(this.lowPassFilter);
    this.autoFilter.start();

    const fxChain = this.autoFilter;

    this.prepSweepSynth = new Tone.FMSynth({
      harmonicity: 3.01,
      modulationIndex: 10,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
    }).connect(fxChain);
    this.prepSweepSynth.volume.value = -12;

    this.tickSequencerSynth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }
    }).connect(fxChain);
    this.tickSequencerSynth.volume.value = -18;

    this.thrustStabSynth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 }
    }).connect(this.masterGain);
    this.thrustStabSynth.volume.value = -8;

    this.blastNoiseSynth = new Tone.NoiseSynth({
      noise: { type: "brown" },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 }
    }).connect(this.distortion);
    this.blastNoiseSynth.volume.value = -6;

    this.glassShatterSynth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 }
    }).connect(fxChain);
    this.glassShatterSynth.volume.value = -10;

    this.subBassSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 }
    }).connect(this.masterGain);
    this.subBassSynth.volume.value = -4;

    this.glitchSynth = new Tone.Synth({
      oscillator: { type: "fmsquare" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
    }).connect(fxChain);
    this.glitchSynth.volume.value = -10;

    this.webShotNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }
    }).connect(fxChain);
    this.webShotNoise.volume.value = -12;
  }

  public triggerStriking(phase: "PREP" | "THRUST" | "RECOVER", isBerserk: boolean): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(4)) return;
    const now = this.ToneModule.now();

    if (phase === "PREP") {
      if (this.prepSweepSynth) {
        const baseFreq = isBerserk ? 110 : 82;
        this.prepSweepSynth.triggerAttackRelease(baseFreq, "8n", now, 0.8);
        this.prepSweepSynth.frequency.setValueAtTime(baseFreq, now);
        this.prepSweepSynth.frequency.exponentialRampToValueAtTime(baseFreq * 4, now + 0.3);
      }
      if (this.tickSequencerSynth) {
        const tickNotes = [440, 554, 659, 880];
        const tickTime = isBerserk ? 0.06 : 0.08;
        tickNotes.forEach((note, i) => {
          this.tickSequencerSynth?.triggerAttackRelease(note, "32n", now + i * tickTime, 0.6);
        });
      }
      this.soundManager.recordSound("weaver_prep", 4, 0.4);
    } else if (phase === "THRUST") {
      if (this.thrustStabSynth) {
        const startFreq = isBerserk ? 880 : 660;
        const endFreq = isBerserk ? 110 : 82;
        this.thrustStabSynth.triggerAttackRelease(startFreq, "16n", now, 1.0);
        this.thrustStabSynth.frequency.setValueAtTime(startFreq, now);
        this.thrustStabSynth.frequency.exponentialRampToValueAtTime(endFreq, now + 0.15);
      }
      if (this.subBassSynth) {
        this.subBassSynth.triggerAttackRelease("C1", "8n", now, 1.0);
      }
      this.soundManager.recordSound("weaver_thrust", 5, 0.2);
    } else if (phase === "RECOVER") {
      if (this.tickSequencerSynth) {
        const ratchetNotes = [220, 180, 140, 110, 90];
        ratchetNotes.forEach((note, i) => {
          this.tickSequencerSynth?.triggerAttackRelease(note, "32n", now + i * 0.05, 0.5);
        });
      }
      this.soundManager.recordSound("weaver_recover", 3, 0.3);
    }
  }

  public triggerShockwave(phase: "TELEGRAPH" | "BLAST" | "RECOVER"): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(5)) return;
    const now = this.ToneModule.now();

    if (phase === "TELEGRAPH") {
      if (this.blastNoiseSynth && this.lowPassFilter) {
        this.lowPassFilter.frequency.setValueAtTime(100, now);
        this.lowPassFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.8);
        this.blastNoiseSynth.triggerAttackRelease("4n", now, 0.8);
      }
      this.soundManager.recordSound("weaver_telegraph", 5, 0.8);
    } else if (phase === "BLAST") {
      if (this.blastNoiseSynth) {
        this.blastNoiseSynth.triggerAttackRelease("16n", now, 1.0);
      }
      if (this.subBassSynth) {
        this.subBassSynth.triggerAttackRelease("C0", "8n", now, 1.0);
        this.subBassSynth.frequency.setValueAtTime(60, now);
        this.subBassSynth.frequency.exponentialRampToValueAtTime(20, now + 0.3);
      }
      if (this.glassShatterSynth) {
        this.glassShatterSynth.triggerAttackRelease("32n", now + 0.05, 0.7);
        this.glassShatterSynth.triggerAttackRelease("32n", now + 0.12, 0.5);
      }
      this.soundManager.recordSound("weaver_blast", 6, 0.4);
    } else if (phase === "RECOVER") {
      if (this.glassShatterSynth) {
         this.glassShatterSynth.triggerAttackRelease("2n", now, 0.2);
      }
      this.soundManager.recordSound("weaver_recover", 3, 1.0);
    }
  }

  public triggerDamaged(comboCount: number, isBerserk: boolean): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(4)) return;
    const now = this.ToneModule.now();
    
    const basePitch = 200 + Math.min(comboCount * 15, 150) + (isBerserk ? 100 : 0);
    
    if (this.glitchSynth) {
      for (let i = 0; i < 3; i++) {
        this.glitchSynth.triggerAttackRelease(basePitch + (i * 50), "32n", now + i * 0.03, 0.8);
      }
    }
    if (this.subBassSynth) {
      this.subBassSynth.triggerAttackRelease("G1", "16n", now, 0.9);
    }
    this.soundManager.recordSound("weaver_damaged", 4, 0.15);
  }

  public triggerDefeated(): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(5)) return;
    const now = this.ToneModule.now();
    
    if (this.tickSequencerSynth) {
      const deathNotes = [880, 660, 440, 330, 220, 165, 110, 82, 55];
      let timeOffset = 0;
      deathNotes.forEach((note, i) => {
        this.tickSequencerSynth?.triggerAttackRelease(note, "16n", now + timeOffset, 0.8);
        timeOffset += 0.08 + (i * 0.04);
      });
    }
    if (this.subBassSynth) {
       this.subBassSynth.triggerAttackRelease("C1", "2n", now + 0.8, 0.6);
    }
    this.soundManager.recordSound("weaver_defeated", 5, 2.0);
  }

  public triggerWebShot(): void {
    if (!this.ToneModule || !this.soundManager.canPlaySound(3)) return;
    const now = this.ToneModule.now();
    
    if (this.webShotNoise) {
      this.webShotNoise.triggerAttackRelease("32n", now, 0.8);
      this.webShotNoise.triggerAttackRelease("32n", now + 0.06, 0.6);
      this.webShotNoise.triggerAttackRelease("32n", now + 0.12, 0.4);
    }
    if (this.tickSequencerSynth) {
       this.tickSequencerSynth.triggerAttackRelease(1200, "32n", now, 0.5);
    }
    this.soundManager.recordSound("weaver_web_shot", 3, 0.2);
  }

  public dispose(): void {
    this.prepSweepSynth?.dispose();
    this.tickSequencerSynth?.dispose();
    this.thrustStabSynth?.dispose();
    this.blastNoiseSynth?.dispose();
    this.glassShatterSynth?.dispose();
    this.subBassSynth?.dispose();
    this.glitchSynth?.dispose();
    this.webShotNoise?.dispose();
    this.bitCrusher?.dispose();
    this.distortion?.dispose();
    this.lowPassFilter?.dispose();
    this.autoFilter?.dispose();
    this.masterGain?.dispose();
  }
}
