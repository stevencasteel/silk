export class ProceduralAmbienceEngine {
  private noiseSource: AudioBufferSourceNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private filterStatic: BiquadFilterNode | null = null;
  private filterModulated: BiquadFilterNode | null = null;
  private fadeGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  public start(ctx: AudioContext, destination: AudioNode): void {
    if (this.noiseSource) return;

    const sampleRate = ctx.sampleRate;
    const duration = 5.0;

    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
      const channelData = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.random() * 2 - 1;
      }
    }

    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = this.noiseBuffer;
    this.noiseSource.loop = true;

    this.filterStatic = ctx.createBiquadFilter();
    this.filterStatic.type = "lowpass";
    this.filterStatic.frequency.value = 800;

    this.filterModulated = ctx.createBiquadFilter();
    this.filterModulated.type = "lowpass";
    this.filterModulated.frequency.value = 300;

    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 0.2;

    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 10;

    this.fadeGain = ctx.createGain();
    this.fadeGain.gain.setValueAtTime(0, ctx.currentTime);
    this.fadeGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2.0);

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filterModulated.frequency);

    this.noiseSource.connect(this.filterStatic);
    this.filterStatic.connect(this.filterModulated);
    this.filterModulated.connect(this.fadeGain);
    this.fadeGain.connect(destination);

    this.lfo.start();
    this.noiseSource.start();
  }

  public stop(): void {
    if (!this.noiseSource) return;

    try {
      this.noiseSource.stop();
    } catch {
      // Ignored
    }
    this.noiseSource.disconnect();
    this.noiseSource = null;

    if (this.lfo) {
      try {
        this.lfo.stop();
      } catch {
        // Ignored
      }
      this.lfo.disconnect();
      this.lfo = null;
    }

    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
    }

    if (this.filterStatic) {
      this.filterStatic.disconnect();
      this.filterStatic = null;
    }

    if (this.filterModulated) {
      this.filterModulated.disconnect();
      this.filterModulated = null;
    }

    if (this.fadeGain) {
      this.fadeGain.disconnect();
      this.fadeGain = null;
    }
  }
}
