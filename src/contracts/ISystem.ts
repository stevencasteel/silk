export interface ISystem {
    init?(): void;
    update(dt: number): void;
    render?(alpha: number): void;
    dispose?(): void;
}
