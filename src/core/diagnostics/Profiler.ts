export class Profiler {
    private systemTimings = new Map<string, number>();
    private frameStart = 0;
    private frameTime = 0;
    private fps = 0;
    private frameCount = 0;
    private lastFpsUpdate = performance.now();

    public beginFrame(): void {
        this.frameStart = performance.now();
    }

    public endFrame(): void {
        this.frameTime = performance.now() - this.frameStart;
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
    }

    public recordSystem(name: string, duration: number): void {
        this.systemTimings.set(name, duration);
    }

    public getFps(): number { return this.fps; }
    public getFrameTime(): number { return this.frameTime; }
    public getSystemTimings(): Map<string, number> { return this.systemTimings; }
    
    public clearFrame(): void {
        this.systemTimings.clear();
    }
}
