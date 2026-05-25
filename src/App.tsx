import { useEffect, useRef } from "react";
import { bootstrapApplication } from "./app/bootstrap";
import { HudOverlay } from "./ui/hud/HudOverlay";
import { ErrorBoundary } from "./ui/hud/ErrorBoundary";
import { Engine } from "./core/engine/Engine";
import "./App.css";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;
    let engineInstance: Engine | null = null;

    bootstrapApplication(canvasRef.current).then((engine) => {
      if (cancelled) {
        engine.stop();
        return;
      }
      engineInstance = engine;
      engineInstance.start();
    });

    return () => {
      cancelled = true;
      if (engineInstance) {
        engineInstance.stop();
      }
    };
  }, []);

  return (
    <div className="cabinet-outer">
      <div className="viewport-container">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        <ErrorBoundary>
          <HudOverlay />
        </ErrorBoundary>
        <div id="debug-telemetry-root" />
      </div>
    </div>
  );
}
