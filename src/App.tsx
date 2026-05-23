import { useEffect, useRef } from "react";
import { bootstrapApplication } from "./app/bootstrap";
import { HudOverlay } from "./ui/hud/HudOverlay";
import { Engine } from "./core/engine/Engine";
import "./App.css";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    let engineInstance: Engine | null = null;
    bootstrapApplication(canvasRef.current).then((engine) => {
      engineInstance = engine;
      engineInstance.start();
    });

    return () => {
      if (engineInstance) {
        engineInstance.stop();
      }
    };
  }, []);

  return (
    <div className="cabinet-outer">
      <div className="viewport-container">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        <HudOverlay />
      </div>
    </div>
  );
}
