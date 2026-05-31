import { Engine } from "../core/engine/Engine";
import { useOverlayStore } from "../ui/hud/hudStore";
import { GameEvent } from "../core/events/GameEvents";

export async function bootstrapApplication(canvas: HTMLCanvasElement): Promise<Engine> {
  const overlay = useOverlayStore.getState();

  overlay.setBootStatus("INITIALIZING...");
  overlay.setAwaitingGesture(false);

  try {
    const { CompositionRoot } = await import("./compositionRoot");
    const root = new CompositionRoot();
    const engine = root.buildEngine(canvas);

    const unsubscribe = engine.eventBroker.subscribe(GameEvent.GAME_BOOT_PROGRESS, (payload) => {
      overlay.setBootStatus(payload.status);
      const progressMatch = payload.status.match(/\((\d+)%\)/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1], 10) / 100;
        overlay.setLoadingProgress(progress);
      }
    });

    engine._bootProgressUnsubscribe = unsubscribe;

    return engine;
  } catch (error) {
    console.error("Failed to bootstrap application:", error);
    overlay.setBootStatus(
      "BOOT FAILED: " + (error instanceof Error ? error.message : String(error))
    );
    overlay.setLoadingProgress(0);
    throw error;
  }
}
