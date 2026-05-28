import { AUDIO_PRESETS } from "./AudioPresets";
import type { FMOscillator, Filter, Gain, LFO, Synth, MembraneSynth, Loop, Panner } from "tone";

export class TensionSynthesizer {
  private fmOsc: FMOscillator | null = null;
  private lowpassFilter: Filter | null = null;
  private gainNode: Gain | null = null;
  private lfo: LFO | null = null;
  private lastTension: number = -999.0;

  private playerPanner: Panner | null = null;
  private weaverPanner: Panner | null = null;
  private ratchetPanner: Panner | null = null;

  private ratchetSynth: Synth | null = null;
  private heartbeatSynth: MembraneSynth | null = null;
  private heartbeatLoop: Loop | null = null;

  private lastRatchetTime: number = 0;
  private nextRatchetDelay: number = 0.25;
  private toneModule: typeof import("tone") | null = null;

  public async initialize(): Promise<void> {
    const Tone = await import("tone");
    this.toneModule = Tone;

    const presets = AUDIO_PRESETS.WEAVER;
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;

    Tone.getTransport().bpm.value = 130;
    Tone.getTransport().start();

    this.lowpassFilter = new Tone.Filter({
      frequency: 200,
      type: "lowpass",
      Q: 1.5
    }).toDestination();

    this.playerPanner = new Tone.Panner(0).connect(this.lowpassFilter);
    this.weaverPanner = new Tone.Panner(0).connect(this.lowpassFilter);
    this.ratchetPanner = new Tone.Panner(0).toDestination(); // Bypasses lowpass to keep clicks crisp

    this.fmOsc = new Tone.FMOscillator({
      frequency: presets.DRONE_BASE_FREQ,
      type: "sawtooth",
      modulationType: "sine",
      harmonicity: presets.HARMONICITY_NORMAL,
      modulationIndex: synthConfig.DRONE_MOD_INDEX_BASE,
      workspace: undefined
    } as unknown as ConstructorParameters<typeof FMOscillator>[0]);

    this.gainNode = new Tone.Gain(0.0);

    this.lfo = new Tone.LFO({
      frequency: presets.LFO_NORMAL_HZ,
      min: 150,
      max: 280
    });

    this.fmOsc.connect(this.gainNode);
    this.gainNode.connect(this.weaverPanner);
    this.lfo.connect(this.lowpassFilter.frequency);

    this.ratchetSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.001,
        decay: 0.015,
        sustain: 0,
        release: 0.015
      }
    }).connect(this.ratchetPanner);
    this.ratchetSynth.volume.value = synthConfig.RATCHET_VOLUME;

    this.heartbeatSynth = new Tone.MembraneSynth({
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.18,
        sustain: 0,
        release: 0.12
      }
    }).connect(this.lowpassFilter);
    this.heartbeatSynth.volume.value = synthConfig.HEARTBEAT_VOLUME;

    this.heartbeatLoop = new Tone.Loop((time) => {
      if (this.heartbeatSynth) {
        this.heartbeatSynth.triggerAttackRelease("A1", "8n", time);
        this.heartbeatSynth.triggerAttackRelease("G1", "8n", time + 0.18);
      }
    }, synthConfig.HEARTBEAT_INTERVAL);

    this.lfo.start();
    this.fmOsc.start();
  }

  private getPanFromX(x: number): number {
    const clampedX = Math.max(-15.0, Math.min(15.0, x));
    return (clampedX / 15.0) * 0.45;
  }

  public updatePositions(playerX: number, weaverX: number): void {
    if (this.playerPanner && this.weaverPanner && this.ratchetPanner && this.toneModule) {
      const now = this.toneModule.now();
      const panVal = this.getPanFromX(playerX);
      this.playerPanner.pan.setTargetAtTime(panVal, now, 0.05);
      this.ratchetPanner.pan.setTargetAtTime(panVal, now, 0.05);
      this.weaverPanner.pan.setTargetAtTime(this.getPanFromX(weaverX), now, 0.05);
    }
  }

  public updateDronePitch(tensionVal: number): void {
    if (!this.fmOsc || !this.gainNode || !this.lowpassFilter || !this.toneModule) return;

    const clampedTension = Math.max(0, Math.min(1.3, tensionVal));

    if (clampedTension > this.lastTension && clampedTension > 0.05) {
      const now = this.toneModule.now();
      if (now > this.lastRatchetTime + this.nextRatchetDelay) {
        this.lastRatchetTime = now;
        this.nextRatchetDelay = Math.max(0.04, 0.28 - clampedTension * 0.2);
        const pitch = 150 + clampedTension * 320;
        this.ratchetSynth?.triggerAttackRelease(pitch, "32n", now);
      }
    }

    if (Math.abs(clampedTension - this.lastTension) < 0.005) {
      return;
    }
    this.lastTension = clampedTension;

    const now = this.toneModule.now();
    const presets = AUDIO_PRESETS.WEAVER;
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;

    const targetBaseFreq =
      presets.DRONE_BASE_FREQ + Math.min(1.0, clampedTension) * presets.DRONE_BASE_FREQ;
    const targetModulationIndex =
      synthConfig.DRONE_MOD_INDEX_BASE +
      Math.min(1.0, clampedTension) * synthConfig.DRONE_MOD_INDEX_SCALE;
    const targetGain =
      clampedTension > synthConfig.DRONE_GAIN_THRESHOLD
        ? synthConfig.DRONE_MIN_GAIN +
          Math.min(1.0, clampedTension) * synthConfig.DRONE_MAX_GAIN_ADD
        : 0.0;

    this.fmOsc.frequency.setTargetAtTime(targetBaseFreq, now, synthConfig.DRONE_PITCH_RAMP_TIME);
    this.fmOsc.modulationIndex.setTargetAtTime(
      targetModulationIndex,
      now,
      synthConfig.DRONE_PITCH_RAMP_TIME
    );
    this.gainNode.gain.setTargetAtTime(targetGain, now, synthConfig.DRONE_GAIN_RAMP_TIME);
  }

  public setLowHPStatus(active: boolean): void {
    if (!this.lfo || !this.heartbeatLoop) return;

    const targetMin = active ? 40 : 150;
    const targetMax = active ? 150 : 280;

    this.lfo.min = targetMin;
    this.lfo.max = targetMax;

    if (active) {
      this.heartbeatLoop.start();
    } else {
      this.heartbeatLoop.stop();
    }
  }

  public resumeFromPause(): void {
    if (!this.fmOsc || !this.gainNode || !this.lowpassFilter || !this.toneModule) return;
    const now = this.toneModule.now();
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;
    const clampedTension = this.lastTension === -999.0 ? 0.0 : this.lastTension;
    const targetGain =
      clampedTension > synthConfig.DRONE_GAIN_THRESHOLD
        ? synthConfig.DRONE_MIN_GAIN + clampedTension * synthConfig.DRONE_MAX_GAIN_ADD
        : 0.0;
    this.gainNode.gain.setTargetAtTime(targetGain, now, synthConfig.DRONE_GAIN_RAMP_TIME);
  }

  public handleStateChange(
    _state: string,
    audioParams?: { baseFreq: number; lfoHz: number; harmonicity: number }
  ): void {
    if (!this.fmOsc || !this.lfo || !this.lowpassFilter || !this.toneModule) return;
    const now = this.toneModule.now();

    if (audioParams) {
      this.fmOsc.frequency.setTargetAtTime(audioParams.baseFreq, now, 0.5);
      this.lfo.frequency.setTargetAtTime(audioParams.lfoHz, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(audioParams.harmonicity, now, 0.5);
    } else {
      const presets = AUDIO_PRESETS.WEAVER;
      this.fmOsc.frequency.setTargetAtTime(presets.DRONE_BASE_FREQ, now, 0.5);
      this.lfo.frequency.setTargetAtTime(presets.LFO_NORMAL_HZ, now, 0.5);
      this.fmOsc.harmonicity.setTargetAtTime(presets.HARMONICITY_NORMAL, now, 0.5);
    }
  }

  public fadeOutAndMute(): void {
    if (!this.gainNode || !this.toneModule) return;
    const now = this.toneModule.now();
    this.gainNode.gain.setTargetAtTime(0.0, now, 0.15);
  }

  public resetToBaseline(): void {
    if (!this.fmOsc || !this.gainNode || !this.lfo || !this.lowpassFilter || !this.toneModule)
      return;
    const now = this.toneModule.now();
    const presets = AUDIO_PRESETS.WEAVER;

    this.gainNode.gain.setValueAtTime(0.0, now);
    this.fmOsc.frequency.setValueAtTime(presets.DRONE_BASE_FREQ, now);
    this.fmOsc.harmonicity.setValueAtTime(presets.HARMONICITY_NORMAL, now);
    this.lfo.frequency.setValueAtTime(presets.LFO_NORMAL_HZ, now);
    this.setLowHPStatus(false);
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
    if (this.playerPanner) {
      this.playerPanner.dispose();
    }
    if (this.weaverPanner) {
      this.weaverPanner.dispose();
    }
    if (this.ratchetPanner) {
      this.ratchetPanner.dispose();
    }
    if (this.ratchetSynth) {
      this.ratchetSynth.dispose();
    }
    if (this.heartbeatSynth) {
      this.heartbeatSynth.dispose();
    }
    if (this.heartbeatLoop) {
      this.heartbeatLoop.dispose();
    }
  }
}
