import React from "react";

export const HudOverlay: React.FC = () => {
  return (
    <>
      <div
        className="hud-overlay-container"
        style={{
          position: "absolute",
          inset: "14px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          pointerEvents: "none",
          fontFamily: "'Courier New', Courier, monospace",
          color: "#e2e8f0"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>

          <div style={{
            display: "flex", flexDirection: "column", gap: "5px",
            background: "rgba(8, 9, 14, 0.92)", padding: "10px 12px",
            borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)",
            minWidth: "170px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", letterSpacing: "0.1em", opacity: 0.7 }}>
              <span>PILOT</span>
              <span id="player-hp-value">INTEGRITY: 5 / 5</span>
            </div>
            <div style={{ width: "100%", height: "5px", background: "#0d1117", borderRadius: "3px", overflow: "hidden" }}>
              <div id="player-hp-bar" style={{ width: "100%", height: "100%", backgroundColor: "#22c55e", transition: "width 0.15s ease, background-color 0.3s ease" }} />
            </div>
          </div>

          <div style={{
            display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-end",
            background: "rgba(8, 9, 14, 0.92)", padding: "10px 12px",
            borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)",
            minWidth: "175px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "9px", letterSpacing: "0.1em", opacity: 0.7 }}>
              <span>WEAVER</span>
              <span id="weaver-hp-value">100 / 100</span>
            </div>
            <div style={{ width: "100%", height: "5px", background: "#0d1117", borderRadius: "3px", overflow: "hidden" }}>
              <div id="weaver-hp-bar" style={{ width: "100%", height: "100%", backgroundColor: "#ef4444", transition: "width 0.2s ease" }} />
            </div>
            <span id="weaver-state-text" style={{ fontSize: "10px", fontWeight: "bold", color: "#ef4444", letterSpacing: "0.08em", marginTop: "2px" }}>SWEEPING</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>

          <div id="traversal-hint" style={{
            fontSize: "9px", letterSpacing: "0.12em", color: "#94a3b8",
            opacity: 0, transition: "opacity 0.2s ease",
            textAlign: "center"
          }} />

          <div style={{
            display: "flex", flexDirection: "column", gap: "5px",
            background: "rgba(8, 9, 14, 0.92)", padding: "10px 14px",
            borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)",
            minWidth: "230px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", letterSpacing: "0.1em" }}>
              <span style={{ opacity: 0.7 }}>SILK TENSION</span>
              <span id="tension-meter-text" style={{ color: "#94a3b8" }}>0.0%</span>
            </div>
            <div style={{ width: "100%", height: "7px", background: "#0d1117", borderRadius: "4px", overflow: "hidden" }}>
              <div id="tension-meter-bar" style={{
                width: "0%", height: "100%",
                backgroundColor: "#22c55e",
                transition: "background-color 0.1s ease",
                borderRadius: "4px"
              }} />
            </div>
          </div>
        </div>
      </div>

      <div id="game-state-overlay" style={{
        position: "absolute", inset: 0,
        display: "none", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        background: "rgba(0,0,0,0.88)", zIndex: 100,
        pointerEvents: "auto", fontFamily: "'Courier New', Courier, monospace",
        gap: "16px"
      }}>
        <h1 id="game-state-title" style={{ fontSize: "32px", color: "#ef4444", margin: 0, letterSpacing: "0.18em" }}>
          SILK SNAPPED
        </h1>
        <p id="game-state-subtitle" style={{ fontSize: "12px", color: "#64748b", margin: 0, letterSpacing: "0.12em" }}>
          PRESS [R] TO RECONNECT
        </p>
      </div>
    </>
  );
};
