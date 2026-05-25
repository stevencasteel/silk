import { Engine } from "../core/engine/Engine";
import { useOverlayStore } from "../ui/hud/hudStore";

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const overlay = useOverlayStore.getState();

  overlay.setBootStatus("STREAMING SYSTEM ASSETS...");
  overlay.setAwaitingGesture(true);
  await new Promise((resolve) => setTimeout(resolve, 100));

  overlay.setBootStatus("COMPILING PHYSICAL WEB QUANTUMS...");
  const { CompositionRoot } = await import("./compositionRoot");

  overlay.setBootStatus("MOUNTING ENGINES...");
  const root = new CompositionRoot();
  const engine = root.buildEngine(canvas);

  return engine;
}
