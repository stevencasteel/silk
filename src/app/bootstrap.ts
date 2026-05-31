import { Engine } from "../core/engine/Engine";
import { useOverlayStore } from "../ui/hud/hudStore";
import { GameEvent } from "../core/events/GameEvents";

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const overlay = useOverlayStore.getState();

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

    return engine;
  } catch (error) {
    console.error("Failed to bootstrap application:", error);
    const errMsg = "BOOT FAILED: " + (error instanceof Error ? error.message : String(error));
    overlay.setBootStatus(errMsg);
    overlay.addBootLog(errMsg);
    overlay.setLoadingProgress(0);
    throw error;
  }
}
