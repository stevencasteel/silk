import type {
  Synth,
  MembraneSynth,
  NoiseSynth,
  PolySynth,
  AMSynth,
  FMSynth,
  MetalSynth,
  PluckSynth,
  Gain,
  Filter,
  Reverb,
  FeedbackDelay,
  Distortion,
  Vibrato,
  Tremolo,
  Chorus
} from "tone";

export interface SoundLayer {
  synth: Synth | MembraneSynth | NoiseSynth | PolySynth | AMSynth | FMSynth | MetalSynth | PluckSynth;
  gain: Gain;
  effects: {
    reverb?: Reverb;
    delay?: FeedbackDelay;
    distortion?: Distortion;
    filter?: Filter;
    vibrato?: Vibrato;
    tremolo?: Tremolo;
    chorus?: Chorus;
  };
  baseVolume: number;
}

export interface SoundEvent {
  type: string;
  priority: number;
  timestamp: number;
  duration: number;
}

export class ProceduralSoundManager {
  private activeSounds: Map<string, SoundLayer> = new Map();
  private maxConcurrentSounds = 8;
  private maxSoundsPerSecond = 12;
  private soundHistory: SoundEvent[] = [];
  private historyWindow = 1000; // 1 second window
  private ToneModule: typeof import("tone") | null = null;

  private masterGain: Gain | null = null;
  private sfxBus: Gain | null = null;
  private weaverVocalBus: Gain | null = null;
  private healthBugBus: Gain | null = null;
  private ambientBus: Gain | null = null;

  private reverb: Reverb | null = null;
  private delay: FeedbackDelay | null = null;
  private distortion: Distortion | null = null;

  public async initialize(ToneRaw: unknown): Promise<void> {
    const Tone = ToneRaw as typeof import("tone");
    this.ToneModule = Tone;

    // Master gain for overall volume control
    this.masterGain = new Tone.Gain(0.8).toDestination();

    // Create separate buses for different sound categories
    this.sfxBus = new Tone.Gain(0.7).connect(this.masterGain);
    this.weaverVocalBus = new Tone.Gain(0.6).connect(this.masterGain);
    this.healthBugBus = new Tone.Gain(0.65).connect(this.masterGain);
    this.ambientBus = new Tone.Gain(0.5).connect(this.masterGain);

    // Shared effects
    this.reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.05,
      wet: 0.15
    }).connect(this.masterGain);

    this.delay = new Tone.FeedbackDelay({
      delayTime: "8n",
      feedback: 0.3,
      wet: 0.1
    }).connect(this.masterGain);

    this.distortion = new Tone.Distortion({
      distortion: 0.4,
      wet: 0.2
    }).connect(this.masterGain);

    await this.reverb.generate();
  }

  public canPlaySound(priority: number): boolean {
    const now = performance.now();
    
    // Clean old sound history
    this.soundHistory = this.soundHistory.filter(
      event => now - event.timestamp < this.historyWindow
    );

    // Check rate limiting
    if (this.soundHistory.length >= this.maxSoundsPerSecond) {
      // Only allow if this sound has higher priority than the oldest in window
      const oldest = this.soundHistory[0];
      if (priority <= oldest.priority) {
        return false;
      }
      this.soundHistory.shift();
    }

    // Check concurrent sound limit
    if (this.activeSounds.size >= this.maxConcurrentSounds) {
      return false;
    }

    return true;
  }

  public registerSound(id: string, soundLayer: SoundLayer): void {
    this.activeSounds.set(id, soundLayer);
  }

  public unregisterSound(id: string): void {
    const soundLayer = this.activeSounds.get(id);
    if (soundLayer) {
      soundLayer.synth.dispose();
      soundLayer.gain.dispose();
      Object.values(soundLayer.effects).forEach(effect => effect?.dispose());
      this.activeSounds.delete(id);
    }
  }

  public recordSound(type: string, priority: number, duration: number): void {
    this.soundHistory.push({
      type,
      priority,
      timestamp: performance.now(),
      duration
    });
  }

  public getSfxBus(): Gain | null {
    return this.sfxBus;
  }

  public getWeaverVocalBus(): Gain | null {
    return this.weaverVocalBus;
  }

  public getHealthBugBus(): Gain | null {
    return this.healthBugBus;
  }

  public getAmbientBus(): Gain | null {
    return this.ambientBus;
  }

  public getReverb(): Reverb | null {
    return this.reverb;
  }

  public getDelay(): FeedbackDelay | null {
    return this.delay;
  }

  public getDistortion(): Distortion | null {
    return this.distortion;
  }

  public setMasterVolume(volume: number): void {
    if (this.masterGain && this.ToneModule) {
      const now = this.ToneModule.now();
      this.masterGain.gain.setTargetAtTime(volume, now, 0.1);
    }
  }

  public setBusVolume(bus: 'sfx' | 'weaverVocal' | 'healthBug' | 'ambient', volume: number): void {
    const targetBus = 
      bus === 'sfx' ? this.sfxBus :
      bus === 'weaverVocal' ? this.weaverVocalBus :
      bus === 'healthBug' ? this.healthBugBus :
      this.ambientBus;
    
    if (targetBus && this.ToneModule) {
      const now = this.ToneModule.now();
      targetBus.gain.setTargetAtTime(volume, now, 0.1);
    }
  }

  public dispose(): void {
    this.activeSounds.forEach((_layer, id) => this.unregisterSound(id));
    this.masterGain?.dispose();
    this.sfxBus?.dispose();
    this.weaverVocalBus?.dispose();
    this.healthBugBus?.dispose();
    this.ambientBus?.dispose();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.distortion?.dispose();
  }
}
