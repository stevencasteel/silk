import { Engine } from "../core/engine/Engine";
import { useHudStore } from "../ui/hud/hudStore";

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const store = useHudStore.getState();

  store.setBootStatus("STREAMING SYSTEM ASSETS...");
  await new Promise((resolve) => setTimeout(resolve, 100));

  store.setBootStatus("COMPILING PHYSICAL WEB QUANTUMS...");
  const { CompositionRoot } = await import("./compositionRoot");

  store.setBootStatus("MOUNTING ENGINES...");
  const root = new CompositionRoot();
  const engine = root.buildEngine(canvas);

  store.setBootStatus("READY");
  return engine;
}
