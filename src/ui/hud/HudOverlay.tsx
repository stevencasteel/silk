import React from "react";

export const HudOverlay: React.FC = () => {
  return (
    <>
      <div
        className="hud-overlay-container"
        style={{
          position: "absolute",
          inset: "16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          pointerEvents: "none",
          fontFamily: "monospace",
          color: "#f3f4f6"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(10, 11, 15, 0.9)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)", width: "180px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: "bold" }}>
              <span>SYSTEM</span>
              <span id="player-hp-value">INTEGRITY: 5 / 5</span>
            </div>
            <div style={{ width: "100%", height: "6px", background: "#1f2937", borderRadius: "3px", overflow: "hidden" }}>
              <div id="player-hp-bar" style={{ width: "100%", height: "100%", backgroundColor: "#22c55e" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "rgba(10, 11, 15, 0.9)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)", width: "180px", alignItems: "flex-end" }}>
            <span id="boss-state-text" style={{ fontSize: "11px", fontWeight: "bold", color: "#ef4444" }}>WARDEN: SWEEPING</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(10, 11, 15, 0.9)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)", width: "220px" }}>
            <span id="tension-meter-text" style={{ fontSize: "10px", fontWeight: "bold", letterSpacing: "0.1em" }}>TETHER LOAD: 0.0%</span>
            <div style={{ width: "100%", height: "8px", background: "#1f2937", borderRadius: "4px", overflow: "hidden" }}>
              <div id="tension-meter-bar" style={{ width: "0%", height: "100%", backgroundColor: "#22c55e" }} />
            </div>
          </div>
        </div>
      </div>

      <div id="game-state-overlay" style={{
        position: "absolute", inset: 0, display: "none", flexDirection: "column",
        justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.85)",
        zIndex: 100, pointerEvents: "auto", fontFamily: "monospace"
      }}>
        <h1 id="game-state-title" style={{ fontSize: "36px", color: "#ef4444", margin: 0, letterSpacing: "0.15em" }}>TETHER SNAPPED</h1>
        <p id="game-state-subtitle" style={{ fontSize: "14px", color: "#9ca3af", marginTop: "16px", letterSpacing: "0.1em" }}>PRESS [R] TO RECONNECT TETHER</p>
      </div>
    </>
  );
};
