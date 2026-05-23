import { Engine } from "../core/engine/Engine";

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const engine = new Engine(canvas);
  return engine;
}
