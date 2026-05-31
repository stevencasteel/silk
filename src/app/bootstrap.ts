import { Engine } from "../core/engine/Engine";
import { useOverlayStore } from "../ui/hud/hudStore";
import { GameEvent } from "../core/events/GameEvents";

let globalActiveEngine: Engine | null = null;
let isBootstrapping = false;

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const overlay = useOverlayStore.getState();

  const activeEngine = globalActiveEngine as Engine | null;
  if (activeEngine) {
    try {
      activeEngine.stop();
    } catch (e) {
      console.warn("Error stopping active engine:", e);
    }
    globalActiveEngine = null;
  }

  if (isBootstrapping) {
    await new Promise((resolve) => setTimeout(resolve, 380));
    
    const concurrentEngine = globalActiveEngine as Engine | null;
    if (concurrentEngine) {
      try {
        concurrentEngine.stop();
      } catch (e) {
        console.warn("Error stopping concurrent engine:", e);
      }
      globalActiveEngine = null;
    }
  }

  isBootstrapping = true;
  overlay.setBootStatus("INITIALIZING...");
  overlay.addBootLog("INITIALIZING BOOT SEQUENCE...");
  overlay.setAwaitingGesture(false);

  try {
    const { CompositionRoot } = await import("./compositionRoot");
    const root = new CompositionRoot();
    const engine = root.buildEngine(canvas);

    const unsubscribe = engine.eventBroker.subscribe(GameEvent.GAME_BOOT_PROGRESS, (payload) => {
      overlay.setBootStatus(payload.status);
      overlay.addBootLog(payload.status);
      if (payload.progress !== undefined) {
        overlay.setLoadingProgress(payload.progress);
      }
      if (payload.phase !== undefined) {
        overlay.setBootPhase(payload.phase);
      }
    });

    engine._bootProgressUnsubscribe = unsubscribe;
    globalActiveEngine = engine;
    isBootstrapping = false;

    return engine;
  } catch (error) {
    isBootstrapping = false;
    console.error("Failed to bootstrap application:", error);
    const errMsg = "BOOT FAILED: " + (error instanceof Error ? error.message : String(error));
    overlay.setBootStatus(errMsg);
    overlay.addBootLog(errMsg);
    overlay.setLoadingProgress(0);
    throw error;
  }
}
