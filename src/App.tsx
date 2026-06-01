import { useEffect, useRef } from "react";
import { bootstrapApplication } from "./app/bootstrap";
import { HudOverlay } from "./ui/hud/HudOverlay";
import { ErrorBoundary } from "./ui/hud/ErrorBoundary";
import { Engine } from "./core/engine/Engine";
import { Cursor } from "./ui/cursor/Cursor";
import { useOverlayStore } from "./ui/hud/hudStore";
import { GameEvent } from "./core/events/GameEvents";
import "./App.css";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const awaitingGesture = useOverlayStore((state) => state.awaitingGesture);
  const overlayVisible = useOverlayStore((state) => state.overlayVisible);
  const isPaused = useOverlayStore((state) => state.isPaused);
  const bootStatus = useOverlayStore((state) => state.bootStatus);

  const showBlur = awaitingGesture || overlayVisible || isPaused || bootStatus !== "READY";

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;
    let engineInstance: Engine | null = null;

    bootstrapApplication(canvasRef.current)
      .then((engine) => {
        if (cancelled) {
          engine.stop();
          return;
        }
        engineInstance = engine;

        const unsubscribe = engine.eventBroker.subscribe(
          GameEvent.GAME_BOOT_PROGRESS,
          (payload) => {
            if (payload.status === "READY") {
              unsubscribe();
              useOverlayStore.getState().setAwaitingGesture(true);
            }
          }
        );

        engineInstance.start();
      })
      .catch((error) => {
        console.error("Failed to initialize game:", error);
      });

    return () => {
      cancelled = true;
      if (engineInstance) {
        engineInstance.stop();
        if (engineInstance._bootProgressUnsubscribe) {
          engineInstance._bootProgressUnsubscribe();
        }
      }
    };
  }, []);

  return (
    <div className="app-wrapper">
      <div className="cabinet-outer">
        <div className="viewport-container">
          <canvas
            ref={canvasRef}
            className={showBlur ? "canvas-blurred" : ""}
            style={{ width: "100%", height: "100%", touchAction: "none" }}
          />
          <div className="vignette-overlay" />
          <ErrorBoundary>
            <HudOverlay />
          </ErrorBoundary>
        </div>
      </div>
      <Cursor />
    </div>
  );
}