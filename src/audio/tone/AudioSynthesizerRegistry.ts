import { IAudioRegistry } from "../../contracts/IAudio";
import { AUDIO_PRESETS } from "./AudioPresets";
import type { FMOscillator, Filter, Gain, LFO, Synth, MembraneSynth, Loop, Panner, NoiseSynth } from "tone";

export class AudioSynthesizerRegistry implements IAudioRegistry {
  private fmOsc: FMOscillator | null = null;
  private lowpassFilter: Filter | null = null;
  private gainNode: Gain | null = null;
  private lfo: LFO | null = null;
  private lastTension = -999.0;

  private playerPanner: Panner | null = null;
  private weaverPanner: Panner | null = null;
  private ratchetPanner: Panner | null = null;
  private sfxPanner: Panner | null = null;

  public ratchetSynth: Synth | null = null;
  public heartbeatSynth: MembraneSynth | null = null;
  public heartbeatLoop: Loop | null = null;

  public impactSynth: MembraneSynth | null = null;
  public noiseSynth: NoiseSynth | null = null;
  public tickSynth: Synth | null = null;
  public confirmSynth: Synth | null = null;
  public tensionAlarmSynth: Synth | null = null;

  private lastRatchetTime = 0;
  private nextRatchetDelay = 0.25;
  private lastImpactTime = 0;
  private lastNoiseTime = 0;
  private lastTickTime = 0;
  private lastConfirmTime = 0;
  private lastAlarmTime = 0;

  private ToneModule: typeof import("tone") | null = null;

  public async initialize(ToneRaw: unknown): Promise<void> {
    const Tone = ToneRaw as typeof import("tone");
    this.ToneModule = Tone;

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
    this.ratchetPanner = new Tone.Panner(0).toDestination();
    this.sfxPanner = new Tone.Panner(0).toDestination();

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

    this.impactSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
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

    this.lfo.start();
    this.fmOsc.start();
  }

  private getPanFromX(x: number): number {
    const clampedX = Math.max(-15.0, Math.min(15.0, x));
    return (clampedX / 15.0) * 0.45;
  }

  public updatePositions(playerX: number, weaverX: number): void {
    if (this.playerPanner && this.weaverPanner && this.ratchetPanner && this.ToneModule) {
      const now = this.ToneModule.now();
      const panVal = this.getPanFromX(playerX);
      this.playerPanner.pan.setTargetAtTime(panVal, now, 0.05);
      this.ratchetPanner.pan.setTargetAtTime(panVal, now, 0.05);
      this.weaverPanner.pan.setTargetAtTime(this.getPanFromX(weaverX), now, 0.05);
    }
  }

  public updateDronePitch(tensionVal: number): void {
    if (!this.fmOsc || !this.gainNode || !this.lowpassFilter || !this.ToneModule) return;

    const clampedTension = Math.max(0, Math.min(1.3, tensionVal));

    if (clampedTension > this.lastTension && clampedTension > 0.05) {
      const now = this.ToneModule.now();
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

    const now = this.ToneModule.now();
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
    if (!this.fmOsc || !this.gainNode || !this.lowpassFilter || !this.ToneModule) return;
    const now = this.ToneModule.now();
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
    if (!this.fmOsc || !this.lfo || !this.lowpassFilter || !this.ToneModule) return;
    const now = this.ToneModule.now();

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
    if (!this.gainNode || !this.ToneModule) return;
    const now = this.ToneModule.now();
    
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setTargetAtTime(0.0, now, 0.05);
    
    if (this.fmOsc) this.fmOsc.frequency.cancelScheduledValues(now);
    if (this.lfo) this.lfo.frequency.cancelScheduledValues(now);
    
    if (this.heartbeatLoop) this.heartbeatLoop.stop();
    this.lastTension = 0.0;
  }

  public resetToBaseline(): void {
    if (!this.fmOsc || !this.gainNode || !this.lfo || !this.lowpassFilter || !this.ToneModule)
      return;
    const now = this.ToneModule.now();
    const presets = AUDIO_PRESETS.WEAVER;

    this.gainNode.gain.setValueAtTime(0.0, now);
    this.fmOsc.frequency.setValueAtTime(presets.DRONE_BASE_FREQ, now);
    this.fmOsc.harmonicity.setValueAtTime(presets.HARMONICITY_NORMAL, now);
    this.lfo.frequency.setValueAtTime(presets.LFO_NORMAL_HZ, now);
    this.setLowHPStatus(false);
  }

  public triggerImpact(pitch: string | number, duration: string, time?: string | number): void {
    const now = performance.now();
    if (now - this.lastImpactTime < 40) return;
    this.lastImpactTime = now;

    try {
      if (this.impactSynth) {
        this.impactSynth.triggerAttackRelease(pitch, duration, time);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerNoise(duration: string, time?: string | number): void {
    const now = performance.now();
    if (now - this.lastNoiseTime < 40) return;
    this.lastNoiseTime = now;

    try {
      if (this.noiseSynth) {
        this.noiseSynth.triggerAttackRelease(duration, time);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerTick(pitch: string, duration: string, time?: number): void {
    const now = performance.now();
    if (now - this.lastTickTime < 25) return;
    this.lastTickTime = now;

    try {
      if (this.tickSynth) {
        this.tickSynth.triggerAttackRelease(pitch, duration, time);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerConfirm(pitch: string, duration: string, time?: number): void {
    const now = performance.now();
    if (now - this.lastConfirmTime < 40) return;
    this.lastConfirmTime = now;

    try {
      if (this.confirmSynth) {
        this.confirmSynth.triggerAttackRelease(pitch, duration, time);
      }
    } catch (e) {
      void e;
    }
  }

  public triggerAlarm(pitch: string, duration: string, time?: number): void {
    const now = performance.now();
    if (now - this.lastAlarmTime < 40) return;
    this.lastAlarmTime = now;

    try {
      if (this.tensionAlarmSynth) {
        this.tensionAlarmSynth.triggerAttackRelease(pitch, duration, time);
      }
    } catch (e) {
      void e;
    }
  }

  public setSfxPan(pan: number, time: number): void {
    try {
      if (this.sfxPanner) {
        this.sfxPanner.pan.setTargetAtTime(pan, time, 0.05);
      }
    } catch (e) {
      void e;
    }
  }

  public setNoiseDecay(value: number): void {
    try {
      if (this.noiseSynth) {
        this.noiseSynth.envelope.decay = value;
      }
    } catch (e) {
      void e;
    }
  }

  public dispose(): void {
    try {
      this.fmOsc?.stop();
      this.fmOsc?.dispose();
      this.lfo?.stop();
      this.lfo?.dispose();
      this.lowpassFilter?.dispose();
      this.gainNode?.dispose();
      this.playerPanner?.dispose();
      this.weaverPanner?.dispose();
      this.ratchetPanner?.dispose();
      this.sfxPanner?.dispose();
      this.ratchetSynth?.dispose();
      this.heartbeatSynth?.dispose();
      this.heartbeatLoop?.dispose();
      this.impactSynth?.dispose();
      this.noiseSynth?.dispose();
      this.tickSynth?.dispose();
      this.confirmSynth?.dispose();
      this.tensionAlarmSynth?.dispose();
    } catch (e) {
      void e;
    }
  }
}
