import type {
  Synth,
  FMSynth,
  AMSynth,
  MembraneSynth,
  NoiseSynth,
  Gain,
  Vibrato,
  Tremolo,
  Filter
} from "tone";
import { ProceduralSoundManager } from "./ProceduralSoundManager";

export class WeaverVocalSoundGenerator {
  private soundManager: ProceduralSoundManager;
  private ToneModule: typeof import("tone") | null = null;

  // Layered synths for weaver vocals
  private vocalSynth: FMSynth | null = null;
  private growlSynth: AMSynth | null = null;
  private screamSynth: Synth | null = null;
  private breathSynth: NoiseSynth | null = null;
  private impactSynth: MembraneSynth | null = null;

  private vocalGain: Gain | null = null;
  private growlGain: Gain | null = null;
  private screamGain: Gain | null = null;
  private breathGain: Gain | null = null;
  private impactGain: Gain | null = null;

  private vibrato: Vibrato | null = null;
  private tremolo: Tremolo | null = null;
  private filter: Filter | null = null;

  private lastVocalTime = 0;
  private vocalCooldown = 150; // ms

  constructor(soundManager: ProceduralSoundManager) {
    this.soundManager = soundManager;
  }

  public async initialize(ToneRaw: unknown): Promise<void> {
    const Tone = ToneRaw as typeof import("tone");
    this.ToneModule = Tone;

    const bus = this.soundManager.getWeaverVocalBus();
    const reverb = this.soundManager.getReverb();
    const distortion = this.soundManager.getDistortion();

    if (!bus) return;

    // Layer 1: Main vocal synth - FM synthesis for organic vocal quality
    this.vocalSynth = new Tone.FMSynth({
      oscillator: { type: "sawtooth" },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.3,
        release: 0.4
      },
      modulation: {
        type: "sine"
      }
    }).connect(bus);
    this.vocalSynth.volume.value = -12;
    (this.vocalSynth as any).modulationIndex.value = 10;
    (this.vocalSynth as any).harmonicity.value = 2;

    // Layer 2: Growl synth - AM synthesis for rumbling
    this.growlSynth = new Tone.AMSynth({
      oscillator: { type: "square" },
      envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.5,
        release: 0.6
      },
      modulation: {
        type: "sawtooth"
      }
    }).connect(bus);
    this.growlSynth.volume.value = -15;
    (this.growlSynth as any).harmonicity.value = 1.5;

    // Layer 3: Scream synth - bright, piercing
    this.screamSynth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.1,
        release: 0.2
      }
    }).connect(bus);
    this.screamSynth.volume.value = -10;

    // Layer 4: Breath synth - noise for breathing sounds
    this.breathSynth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: {
        attack: 0.2,
        decay: 0.5,
        sustain: 0.3,
        release: 0.8
      }
    }).connect(bus);
    this.breathSynth.volume.value = -20;

    // Layer 5: Impact synth - for body hits
    this.impactSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 3,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.3,
        sustain: 0,
        release: 0.4
      }
    }).connect(bus);
    this.impactSynth.volume.value = -8;

    // Individual gain nodes
    this.vocalGain = new Tone.Gain(0.7).connect(bus);
    this.growlGain = new Tone.Gain(0.5).connect(bus);
    this.screamGain = new Tone.Gain(0.6).connect(bus);
    this.breathGain = new Tone.Gain(0.3).connect(bus);
    this.impactGain = new Tone.Gain(0.8).connect(bus);

    // Effects for vocal character
    this.vibrato = new Tone.Vibrato({
      frequency: 6,
      depth: 0.3,
      type: "sine"
    }).connect(bus);

    this.tremolo = new Tone.Tremolo({
      frequency: 8,
      depth: 0.4,
      type: "sine"
    }).connect(bus);

    this.filter = new Tone.Filter({
      frequency: 800,
      type: "lowpass",
      Q: 2
    }).connect(bus);

    // Connect synths through effects
    this.vocalSynth.connect(this.vibrato);
    this.vibrato.connect(this.filter);
    this.growlSynth.connect(this.filter);
    this.screamSynth.connect(this.filter);

    // Add reverb and distortion
    if (reverb) {
      this.vocalSynth.connect(reverb);
      this.growlSynth.connect(reverb);
      this.screamSynth.connect(reverb);
    }
    if (distortion) {
      this.screamSynth.connect(distortion);
      this.impactSynth.connect(distortion);
    }
  }

  public triggerPatrolling(isBerserk: boolean): void {
    const now = performance.now();
    if (now - this.lastVocalTime < this.vocalCooldown) return;
    this.lastVocalTime = now;

    if (!this.soundManager.canPlaySound(1)) return;

    const baseFreq = isBerserk ? 110 : 82; // Lower when berserk
    const freqVariation = baseFreq * (0.95 + Math.random() * 0.1);

    // Gentle vocalization for patrolling
    if (this.vocalSynth) {
      this.vocalGain?.gain.setTargetAtTime(0.5, this.ToneModule?.now() || 0, 0.1);
      this.vocalSynth.triggerAttackRelease(freqVariation, "4n", undefined, 0.4);
    }

    // Subtle breath layer
    if (this.breathSynth && Math.random() < 0.3) {
      this.breathGain?.gain.setTargetAtTime(0.2, this.ToneModule?.now() || 0, 0.2);
      this.breathSynth.triggerAttackRelease("2n");
    }

    this.soundManager.recordSound("weaver_patrolling", 1, 0.5);
  }

  public triggerStriking(phase: "PREP" | "THRUST" | "RECOVER", isBerserk: boolean): void {
    if (phase === "PREP") {
      if (!this.soundManager.canPlaySound(3)) return;

      const now = this.ToneModule?.now() || 0;
      const baseFreq = isBerserk ? 130 : 98;

      // Rising pitch for anticipation
      if (this.vocalSynth) {
        this.vocalGain?.gain.setTargetAtTime(0.7, now, 0.05);
        if (this.vibrato) {
          this.vibrato.frequency.value = 8;
          this.vibrato.depth.value = 0.5;
        }
        this.vocalSynth.triggerAttackRelease(baseFreq, "8n", undefined, 0.6);
        this.vocalSynth.triggerAttackRelease(baseFreq * 1.2, "8n", "+0.1", 0.5);
      }

      // Growl layer
      if (this.growlSynth) {
        this.growlGain?.gain.setTargetAtTime(0.6, now, 0.1);
        this.growlSynth.triggerAttackRelease(baseFreq * 0.5, "4n", undefined, 0.5);
      }

      this.soundManager.recordSound("weaver_prep", 3, 0.3);
    } else if (phase === "THRUST") {
      if (!this.soundManager.canPlaySound(4)) return;

      const now = this.ToneModule?.now() || 0;
      const baseFreq = isBerserk ? 164 : 130;

      // Scream on thrust
      if (this.screamSynth) {
        this.screamGain?.gain.setTargetAtTime(0.8, now, 0.01);
        this.screamSynth.triggerAttackRelease(baseFreq, "16n", undefined, 0.9);
        this.screamSynth.triggerAttackRelease(baseFreq * 1.5, "16n", undefined, 0.7);
      }

      // Impact layer
      if (this.impactSynth) {
        this.impactGain?.gain.setTargetAtTime(0.9, now, 0.01);
        this.impactSynth.triggerAttackRelease(baseFreq * 0.3, "8n");
      }

      this.soundManager.recordSound("weaver_thrust", 4, 0.2);
    } else if (phase === "RECOVER") {
      if (!this.soundManager.canPlaySound(2)) return;

      const now = this.ToneModule?.now() || 0;

      // Exhausted breathing
      if (this.breathSynth) {
        this.breathGain?.gain.setTargetAtTime(0.5, now, 0.1);
        this.breathSynth.triggerAttackRelease("4n");
      }

      // Low vocalization
      if (this.vocalSynth) {
        this.vocalGain?.gain.setTargetAtTime(0.3, now, 0.2);
        this.vocalSynth.triggerAttackRelease(73, "2n", undefined, 0.3);
      }

      this.soundManager.recordSound("weaver_recover", 2, 0.8);
    }
  }

  public triggerShockwave(phase: "TELEGRAPH" | "BLAST" | "RECOVER"): void {
    if (phase === "TELEGRAPH") {
      if (!this.soundManager.canPlaySound(4)) return;

      const now = this.ToneModule?.now() || 0;

      // Building scream
      if (this.screamSynth) {
        this.screamGain?.gain.setTargetAtTime(0.7, now, 0.1);
        this.tremolo?.start();
        this.screamSynth.triggerAttackRelease(220, "8n", undefined, 0.7);
        this.screamSynth.triggerAttackRelease(293, "8n", "+0.1", 0.6);
      }

      // Growl layer
      if (this.growlSynth) {
        this.growlGain?.gain.setTargetAtTime(0.6, now, 0.1);
        this.growlSynth.triggerAttackRelease(110, "4n", undefined, 0.6);
      }

      this.soundManager.recordSound("weaver_telegraph", 4, 0.4);
    } else if (phase === "BLAST") {
      if (!this.soundManager.canPlaySound(5)) return;

      const now = this.ToneModule?.now() || 0;

      // Explosive scream
      if (this.screamSynth) {
        this.screamGain?.gain.setTargetAtTime(1.0, now, 0.01);
        this.screamSynth.triggerAttackRelease(440, "16n", undefined, 1.0);
        this.screamSynth.triggerAttackRelease(587, "16n", undefined, 0.9);
        this.screamSynth.triggerAttackRelease(880, "16n", undefined, 0.8);
      }

      // Heavy impact
      if (this.impactSynth) {
        this.impactGain?.gain.setTargetAtTime(1.0, now, 0.01);
        this.impactSynth.triggerAttackRelease(55, "4n");
      }

      // Noise burst
      if (this.breathSynth) {
        this.breathGain?.gain.setTargetAtTime(0.8, now, 0.01);
        this.breathSynth.triggerAttackRelease("8n");
      }

      this.soundManager.recordSound("weaver_blast", 5, 0.3);
    } else if (phase === "RECOVER") {
      if (!this.soundManager.canPlaySound(2)) return;

      const now = this.ToneModule?.now() || 0;

      this.tremolo?.stop();

      // Worn out breathing
      if (this.breathSynth) {
        this.breathGain?.gain.setTargetAtTime(0.6, now, 0.2);
        this.breathSynth.triggerAttackRelease("2n");
      }

      this.soundManager.recordSound("weaver_recover", 2, 1.0);
    }
  }

  public triggerAscending(): void {
    if (!this.soundManager.canPlaySound(2)) return;

    const now = this.ToneModule?.now() || 0;

    // Ascending vocalization
    if (this.vocalSynth) {
      this.vocalGain?.gain.setTargetAtTime(0.6, now, 0.1);
      if (this.vibrato) {
        this.vibrato.frequency.value = 4;
        this.vibrato.depth.value = 0.2;
      }
      this.vocalSynth.triggerAttackRelease(98, "8n", now, 0.5);
      this.vocalSynth.triggerAttackRelease(130, "8n", now + 0.15, 0.4);
      this.vocalSynth.triggerAttackRelease(164, "4n", now + 0.3, 0.3);
    }

    this.soundManager.recordSound("weaver_ascending", 2, 0.6);
  }

  public triggerDamaged(comboCount: number, _isBerserk: boolean): void {
    if (!this.soundManager.canPlaySound(4)) return;

    const now = this.ToneModule?.now() || 0;

    // Pitch rises with combo
    const baseFreq = 110 + Math.min(comboCount * 20, 100);
    const freqVariation = baseFreq * (0.9 + Math.random() * 0.2);

    // Pain scream
    if (this.screamSynth) {
      this.screamGain?.gain.setTargetAtTime(0.8, now, 0.01);
      this.screamSynth.triggerAttackRelease(freqVariation, "16n", now, 0.9);
    }

    // Growl layer
    if (this.growlSynth) {
      this.growlGain?.gain.setTargetAtTime(0.6, now, 0.05);
      this.growlSynth.triggerAttackRelease(freqVariation * 0.5, "8n", now, 0.6);
    }

    // Impact
    if (this.impactSynth) {
      this.impactGain?.gain.setTargetAtTime(0.7, now, 0.01);
      this.impactSynth.triggerAttackRelease(freqVariation * 0.3, "8n", now);
    }

    this.soundManager.recordSound("weaver_damaged", 4, 0.3);
  }

  public triggerDefeated(): void {
    if (!this.soundManager.canPlaySound(5)) return;

    const now = this.ToneModule?.now() || 0;

    // Defeated cry
    if (this.vocalSynth) {
      this.vocalGain?.gain.setTargetAtTime(0.8, now, 0.05);
      if (this.vibrato) {
        this.vibrato.frequency.value = 3;
        this.vibrato.depth.value = 0.6;
      }
      this.vocalSynth.triggerAttackRelease(82, "2n", now, 0.8);
      this.vocalSynth.triggerAttackRelease(65, "4n", now + 0.3, 0.6);
    }

    // Long breath
    if (this.breathSynth) {
      this.breathGain?.gain.setTargetAtTime(0.7, now, 0.1);
      this.breathSynth.triggerAttackRelease("2n", now);
    }

    this.soundManager.recordSound("weaver_defeated", 5, 2.0);
  }

  public dispose(): void {
    this.vocalSynth?.dispose();
    this.growlSynth?.dispose();
    this.screamSynth?.dispose();
    this.breathSynth?.dispose();
    this.impactSynth?.dispose();
    this.vocalGain?.dispose();
    this.growlGain?.dispose();
    this.screamGain?.dispose();
    this.breathGain?.dispose();
    this.impactGain?.dispose();
    this.vibrato?.dispose();
    this.tremolo?.dispose();
    this.filter?.dispose();
  }
}
