import * as Tone from "tone";
import { AUDIO_PRESETS } from "./AudioPresets";

export class TensionSynthesizer {
  private fmOsc: Tone.FMOscillator | null = null;
  private lowpassFilter: Tone.Filter | null = null;
  private gainNode: Tone.Gain | null = null;
  private lfo: Tone.LFO | null = null;
  private lastTension: number = -999.0;

  private playerPanner: Tone.Panner | null = null;
  private weaverPanner: Tone.Panner | null = null;

  private ratchetSynth: Tone.Synth | null = null;
  private heartbeatSynth: Tone.MembraneSynth | null = null;
  private heartbeatLoop: Tone.Loop | null = null;

  private lastRatchetTime: number = 0;
  private nextRatchetDelay: number = 0.25;

  public initialize(): void {
    const presets = AUDIO_PRESETS.WEAVER;
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;

    Tone.getTransport().bpm.value = 130;
    Tone.getTransport().start();

    this.lowpassFilter = new Tone.Filter({
      frequency: synthConfig.CABINET_LOWPASS_DEFAULT,
      type: "lowpass",
      Q: 1.5
    }).toDestination();

    this.playerPanner = new Tone.Panner(0).connect(this.lowpassFilter);
    this.weaverPanner = new Tone.Panner(0).connect(this.lowpassFilter);

    this.fmOsc = new Tone.FMOscillator({
      frequency: presets.DRONE_BASE_FREQ,
      type: "sawtooth",
      modulationType: "sine",
      harmonicity: presets.HARMONICITY_NORMAL,
      modulationIndex: synthConfig.DRONE_MOD_INDEX_BASE,
      workspace: undefined
    } as unknown as ConstructorParameters<typeof Tone.FMOscillator>[0]);

    this.gainNode = new Tone.Gain(0.0);

    this.lfo = new Tone.LFO({
      frequency: presets.LFO_NORMAL_HZ,
      min: 120,
      max: 240
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
    }).connect(this.playerPanner);
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
    if (this.playerPanner && this.weaverPanner) {
      const now = Tone.now();
      this.playerPanner.pan.setTargetAtTime(this.getPanFromX(playerX), now, 0.05);
      this.weaverPanner.pan.setTargetAtTime(this.getPanFromX(weaverX), now, 0.05);
    }
  }

  public updateDronePitch(tensionVal: number): void {
    if (!this.fmOsc || !this.gainNode || !this.lowpassFilter) return;

    const clampedTension = Math.max(0, Math.min(1.3, tensionVal));

    if (clampedTension > this.lastTension && clampedTension > 0.05) {
      const now = Tone.now();
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

    const now = Tone.now();
    const presets = AUDIO_PRESETS.WEAVER;
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;

    const targetBaseFreq = presets.DRONE_BASE_FREQ + Math.min(1.0, clampedTension) * presets.DRONE_BASE_FREQ;
    const targetModulationIndex =
      synthConfig.DRONE_MOD_INDEX_BASE + Math.min(1.0, clampedTension) * synthConfig.DRONE_MOD_INDEX_SCALE;
    const targetGain =
      clampedTension > synthConfig.DRONE_GAIN_THRESHOLD
        ? synthConfig.DRONE_MIN_GAIN + Math.min(1.0, clampedTension) * synthConfig.DRONE_MAX_GAIN_ADD
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
    if (!this.lowpassFilter || !this.heartbeatLoop) return;
    const synthConfig = AUDIO_PRESETS.TENSION_SYNTH;
    const targetFreq = active 
      ? synthConfig.CABINET_LOWPASS_MUFFLED 
      : synthConfig.CABINET_LOWPASS_DEFAULT;

    this.lowpassFilter.frequency.rampTo(targetFreq, 0.4);

    if (active) {
      this.heartbeatLoop.start(0);
    } else {
      this.heartbeatLoop.stop();
    }
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
