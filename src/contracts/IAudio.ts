export interface IAudioInitializer {
  initialize(Tone: unknown): Promise<void>;
}

export interface IAudioStateManager {
  updatePositions(playerX: number, weaverX: number): void;
  updateDronePitch(tensionVal: number): void;
  setLowHPStatus(active: boolean): void;
  resumeFromPause(): void;
  handleStateChange(
    state: string,
    audioParams?: { baseFreq: number; lfoHz: number; harmonicity: number }
  ): void;
  fadeOutAndMute(): void;
  resetToBaseline(): void;
}

export interface IAudioSfxTrigger {
  triggerImpact(pitch: string | number, duration: string, delay?: string | number): void;
  triggerNoise(duration: string, delay?: string | number): void;
  triggerTick(pitch: string, duration: string, time?: number): void;
  triggerConfirm(pitch: string, duration: string, time?: number): void;
  triggerAlarm(pitch: string, duration: string, time?: number): void;
  setSfxPan(pan: number, time: number): void;
  setNoiseDecay(value: number): void;
}

export interface IAudioRegistry extends IAudioInitializer, IAudioStateManager, IAudioSfxTrigger {
  dispose(): void;
}
