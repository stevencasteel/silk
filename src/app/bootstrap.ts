import { Engine } from "../core/engine/Engine";
import { CompositionRoot } from "./compositionRoot";

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const root = new CompositionRoot();
  const engine = root.buildEngine(canvas);
  return engine;
}
