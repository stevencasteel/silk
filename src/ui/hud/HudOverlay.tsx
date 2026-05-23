import React from "react";

export const HudOverlay: React.FC = () => {
  return (
    <>
      <div
        className="hud-overlay-container"
        style={{
          position: "absolute",
          inset: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          pointerEvents: "none",
          fontFamily: "monospace",
          color: "#f3f4f6"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(12, 14, 18, 0.85)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)", width: "240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "bold" }}>
              <span>PLAYER INTEGRITY</span>
              <span id="player-hp-value">HP: 5 / 5</span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "#1f2937", borderRadius: "4px", overflow: "hidden" }}>
              <div id="player-hp-bar" style={{ width: "100%", height: "100%", backgroundColor: "var(--signal-green, #22c55e)", transition: "width 0.15s ease" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(12, 14, 18, 0.85)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)", width: "240px", alignItems: "flex-end" }}>
            <span id="boss-state-text" style={{ fontSize: "13px", fontWeight: "bold", color: "#f3f4f6" }}>WARDEN: DORMANT</span>
            <div id="boss-state-phase" style={{ fontSize: "10px", color: "#9ca3af", border: "1px solid #374151", padding: "4px 8px", borderRadius: "4px" }}>
              PHASE 01
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(12, 14, 18, 0.85)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)", width: "280px" }}>
            <span id="tension-meter-text" style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "0.1em" }}>TENSION: 0.0%</span>
            <div style={{ width: "100%", height: "12px", background: "#1f2937", borderRadius: "6px", overflow: "hidden" }}>
              <div id="tension-meter-bar" style={{ width: "0%", height: "100%", backgroundColor: "var(--signal-green, #22c55e)", transition: "width 0.1s ease" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(12, 14, 18, 0.85)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)", width: "280px" }}>
            <span id="speedometer-text" style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "0.1em" }}>VELOCITY: 0 m/s</span>
            <div style={{ width: "100%", height: "6px", background: "#1f2937", borderRadius: "3px", overflow: "hidden" }}>
              <div id="speedometer-bar" style={{ width: "0%", height: "100%", backgroundColor: "#3b82f6", transition: "width 0.1s ease" }} />
            </div>
          </div>
        </div>
      </div>

      <div id="game-state-overlay" style={{
        position: "absolute", inset: 0, display: "none", flexDirection: "column",
        justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.85)",
        zIndex: 100, pointerEvents: "auto", fontFamily: "monospace"
      }}>
        <h1 id="game-state-title" style={{ fontSize: "64px", color: "#ef4444", margin: 0, letterSpacing: "0.2em", textShadow: "0 0 20px rgba(239, 68, 68, 0.5)" }}>GAME OVER</h1>
        <p id="game-state-subtitle" style={{ fontSize: "18px", color: "#9ca3af", marginTop: "24px", letterSpacing: "0.1em" }}>PRESS [R] TO RESTART</p>
      </div>
    </>
  );
};
