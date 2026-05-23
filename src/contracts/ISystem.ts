export interface ISystem {
    init?(): Promise<void> | void;
    update(dt: number): void;
    render?(alpha: number): void;
    dispose?(): void;
}
