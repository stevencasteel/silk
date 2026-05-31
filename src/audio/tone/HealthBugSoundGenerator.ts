import type {
  Synth,
  NoiseSynth,
  PolySynth,
  AMSynth,
  Gain
} from "tone";
import { ProceduralSoundManager } from "./ProceduralSoundManager";

export class HealthBugSoundGenerator {
  private soundManager: ProceduralSoundManager;
  private ToneModule: typeof import("tone") | null = null;

  // Layered synths for health bug sounds
  private popSynth: PolySynth | null = null;
  private shimmerSynth: Synth | null = null;
  private crunchSynth: NoiseSynth | null = null;
  private healSynth: AMSynth | null = null;

  private popGain: Gain | null = null;
  private shimmerGain: Gain | null = null;
  private crunchGain: Gain | null = null;
  private healGain: Gain | null = null;

  private lastPopTime = 0;
  private popCooldown = 50; // ms

  constructor(soundManager: ProceduralSoundManager) {
    this.soundManager = soundManager;
  }

  public async initialize(ToneRaw: unknown): Promise<void> {
    const Tone = ToneRaw as typeof import("tone");
    this.ToneModule = Tone;

    const bus = this.soundManager.getHealthBugBus();
    const reverb = this.soundManager.getReverb();
    const delay = this.soundManager.getDelay();

    if (!bus) return;

    // Layer 1: Pop synth - bright, percussive pop
    this.popSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.05
      }
    }).connect(bus);
    this.popSynth.volume.value = -8;

    // Layer 2: Shimmer synth - harmonic overtones
    this.shimmerSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.002,
        decay: 0.15,
        sustain: 0,
        release: 0.1
      }
    }).connect(bus);
    this.shimmerSynth.volume.value = -12;

    // Layer 3: Crunch synth - noise burst for impact
    this.crunchSynth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: {
        attack: 0.001,
        decay: 0.04,
        sustain: 0,
        release: 0.02
      }
    }).connect(bus);
    this.crunchSynth.volume.value = -15;

    // Layer 4: Heal synth - pleasant healing sound
    this.healSynth = new Tone.AMSynth({
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.2,
        release: 0.4
      }
    }).connect(bus);
    this.healSynth.volume.value = -10;

    // Individual gain nodes for layering
    this.popGain = new Tone.Gain(1).connect(bus);
    this.shimmerGain = new Tone.Gain(0.6).connect(bus);
    this.crunchGain = new Tone.Gain(0.4).connect(bus);
    this.healGain = new Tone.Gain(0.8).connect(bus);

    // Add effects to layers
    if (reverb) {
      this.shimmerSynth.connect(reverb);
      this.healSynth.connect(reverb);
    }
    if (delay) {
      this.shimmerSynth.connect(delay);
    }
  }

  public triggerPop(variant: "NORMAL" | "SPIKED" | "PINBALL" | "SPINNING"): void {
    const now = performance.now();
    if (now - this.lastPopTime < this.popCooldown) return;
    this.lastPopTime = now;

    if (!this.soundManager.canPlaySound(2)) return;

    const baseFreq = variant === "SPIKED" ? 880 : variant === "PINBALL" ? 1100 : 660;
    const freqVariation = baseFreq * (0.9 + Math.random() * 0.2);

    // Layer 1: Main pop
    if (this.popSynth) {
      this.popSynth.triggerAttackRelease(
        freqVariation,
        "32n",
        undefined,
        0.8
      );
      this.popSynth.triggerAttackRelease(
        freqVariation * 1.5,
        "32n",
        undefined,
        0.6
      );
    }

    // Layer 2: Shimmer (less for spiked, more for normal)
    if (this.shimmerSynth && variant !== "SPIKED") {
      const shimmerVol = variant === "PINBALL" ? 0.8 : 0.6;
      this.shimmerGain?.gain.setTargetAtTime(shimmerVol, this.ToneModule?.now() || 0, 0.01);
      this.shimmerSynth.triggerAttackRelease(
        freqVariation * 2,
        "16n",
        undefined,
        0.5
      );
      this.shimmerSynth.triggerAttackRelease(
        freqVariation * 3,
        "16n",
        undefined,
        0.3
      );
    }

    // Layer 3: Crunch (more for spiked and pinball)
    if (this.crunchSynth && (variant === "SPIKED" || variant === "PINBALL")) {
      const crunchVol = variant === "SPIKED" ? 0.7 : 0.5;
      this.crunchGain?.gain.setTargetAtTime(crunchVol, this.ToneModule?.now() || 0, 0.01);
      this.crunchSynth.triggerAttackRelease("32n");
    }

    // Layer 4: Heal sound only for normal pops
    if (this.healSynth && variant === "NORMAL") {
      this.healSynth.triggerAttackRelease(
        freqVariation * 0.5,
        "8n",
        "+0.05",
        0.4
      );
      this.healSynth.triggerAttackRelease(
        freqVariation * 0.75,
        "8n",
        "+0.08",
        0.3
      );
    }

    this.soundManager.recordSound("health_bug_pop", 2, 0.15);
  }

  public triggerHeal(): void {
    if (!this.soundManager.canPlaySound(3)) return;

    const now = this.ToneModule?.now() || 0;

    // Pleasant ascending arpeggio for healing
    const healFreqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    
    if (this.healSynth) {
      this.healGain?.gain.setTargetAtTime(0.9, now, 0.05);
      healFreqs.forEach((freq, i) => {
        this.healSynth?.triggerAttackRelease(freq, "8n", now + i * 0.08, 0.6);
      });
    }

    // Subtle shimmer layer
    if (this.shimmerSynth) {
      this.shimmerGain?.gain.setTargetAtTime(0.4, now, 0.05);
      this.shimmerSynth.triggerAttackRelease(783.99, "4n", now + 0.1, 0.3);
      this.shimmerSynth.triggerAttackRelease(1046.5, "4n", now + 0.15, 0.2);
    }

    this.soundManager.recordSound("health_bug_heal", 3, 0.4);
  }

  public triggerSpikedImpact(): void {
    if (!this.soundManager.canPlaySound(4)) return;

    const now = this.ToneModule?.now() || 0;

    // Harsh, dissonant sound for spiked impact
    if (this.popSynth) {
      this.popSynth.triggerAttackRelease(220, "16n", now, 1.0);
      this.popSynth.triggerAttackRelease(233, "16n", now, 0.9);
      this.popSynth.triggerAttackRelease(246, "16n", now, 0.8);
    }

    if (this.crunchSynth) {
      this.crunchGain?.gain.setTargetAtTime(0.8, now, 0.01);
      this.crunchSynth.triggerAttackRelease("8n", now);
    }

    this.soundManager.recordSound("health_bug_spiked", 4, 0.2);
  }

  public triggerPinballBounce(): void {
    if (!this.soundManager.canPlaySound(3)) return;

    const now = this.ToneModule?.now() || 0;

    // Bouncy, playful sound
    const bounceFreq = 440 + Math.random() * 220;
    
    if (this.popSynth) {
      this.popSynth.triggerAttackRelease(bounceFreq, "32n", now, 0.9);
    }

    if (this.shimmerSynth) {
      this.shimmerGain?.gain.setTargetAtTime(0.7, now, 0.01);
      this.shimmerSynth.triggerAttackRelease(bounceFreq * 2, "16n", now + 0.02, 0.5);
    }

    this.soundManager.recordSound("health_bug_pinball", 3, 0.1);
  }

  public dispose(): void {
    this.popSynth?.dispose();
    this.shimmerSynth?.dispose();
    this.crunchSynth?.dispose();
    this.healSynth?.dispose();
    this.popGain?.dispose();
    this.shimmerGain?.dispose();
    this.crunchGain?.dispose();
    this.healGain?.dispose();
  }
}
