import { Engine } from "../core/engine/Engine";
import { useOverlayStore } from "../ui/hud/hudStore";

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const overlay = useOverlayStore.getState();

  overlay.setBootStatus("READY");
  overlay.setAwaitingGesture(true);

  const { CompositionRoot } = await import("./compositionRoot");
  const root = new CompositionRoot();
  const engine = root.buildEngine(canvas);

  return engine;
}
