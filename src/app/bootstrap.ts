import { Engine } from "../core/engine/Engine";
import { useOverlayStore } from "../ui/hud/hudStore";
import { GameEvent } from "../core/events/GameEvents";

let globalActiveEngine: Engine | null = null;
let currentBootstrapId = 0;

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const overlay = useOverlayStore.getState();
  const bootstrapId = ++currentBootstrapId;

  const activeEngine = globalActiveEngine as Engine | null;
  if (activeEngine) {
    try {
      activeEngine.stop();
    } catch (e) {
      console.warn("Error stopping active engine:", e);
    }
    globalActiveEngine = null;
  }

  overlay.setBootStatus("INITIALIZING...");
  overlay.addBootLog("INITIALIZING BOOT SEQUENCE...");
  overlay.setAwaitingGesture(false);

  try {
    const { CompositionRoot } = await import("./compositionRoot");

    if (bootstrapId !== currentBootstrapId) {
      throw new Error("Bootstrap superseded by another request");
    }

    const root = new CompositionRoot();
    const engine = root.buildEngine(canvas);

    globalActiveEngine = engine;

    const unsubscribe = engine.eventBroker.subscribe(GameEvent.GAME_BOOT_PROGRESS, (payload) => {
      if (bootstrapId === currentBootstrapId) {
        overlay.setBootStatus(payload.status);
        overlay.addBootLog(payload.status);
        if (payload.progress !== undefined) {
          overlay.setLoadingProgress(payload.progress);
        }
        if (payload.phase !== undefined) {
          overlay.setBootPhase(payload.phase);
        }
      }
    });

    engine._bootProgressUnsubscribe = unsubscribe;
    return engine;
  } catch (error) {
    if (bootstrapId === currentBootstrapId) {
      console.error("Failed to initialize game:", error);
      const errMsg = "BOOT FAILED: " + (error instanceof Error ? error.message : String(error));
      overlay.setBootStatus(errMsg);
      overlay.addBootLog(errMsg);
      overlay.setLoadingProgress(0);
    }
    throw error;
  }
}
