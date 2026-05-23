import React from "react";

export const HudOverlay: React.FC = () => {
  const handleRetryClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "R" }));
  };

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
          fontFamily: "'Courier New', Courier, monospace",
          color: "#e2e8f0"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          
          <div 
            className="neo-pressed"
            style={{
              display: "flex", flexDirection: "column", gap: "6px",
              padding: "10px 14px",
              borderRadius: "10px",
              minWidth: "175px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: "bold", letterSpacing: "0.15em", opacity: 0.85 }}>
              <span>PILOT INTEGRITY</span>
            </div>
            
            <div style={{ display: "flex", gap: "6px", margin: "4px 0" }}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  id={`player-hp-led-${i}`}
                  className="led-dot led-green"
                  style={{ width: "12px", height: "12px" }}
                />
              ))}
            </div>

            <div style={{ fontSize: "9px", color: "#64748b", letterSpacing: "0.08em" }} id="player-hp-text">
              INTEGRITY: 5 / 5
            </div>
          </div>

          <div 
            className="neo-pressed"
            style={{
              display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-end",
              padding: "10px 14px",
              borderRadius: "10px",
              minWidth: "175px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "10px", fontWeight: "bold", letterSpacing: "0.15em", opacity: 0.85 }}>
              <span>WEAVER CORE</span>
              <span id="weaver-hp-value" style={{ color: "var(--signal-red)" }}>100/100</span>
            </div>
            <div className="neo-pressed" style={{ width: "100%", height: "8px", borderRadius: "4px", padding: "1px", boxSizing: "border-box", overflow: "hidden", background: "#050608" }}>
              <div id="weaver-hp-bar" style={{ width: "100%", height: "100%", backgroundColor: "var(--signal-red)", transition: "width 0.2s ease" }} />
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

          <div 
            className="neo-pressed"
            style={{
              display: "flex", flexDirection: "column", gap: "6px",
              padding: "12px 16px",
              borderRadius: "10px",
              minWidth: "240px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", letterSpacing: "0.15em", fontWeight: "bold" }}>
              <span style={{ opacity: 0.8 }}>SILK TENSION</span>
              <span id="tension-meter-text" style={{ color: "#94a3b8" }}>0.0%</span>
            </div>
            <div className="neo-pressed" style={{ width: "100%", height: "9px", borderRadius: "4px", padding: "1px", boxSizing: "border-box", overflow: "hidden", background: "#050608" }}>
              <div id="tension-meter-bar" style={{
                width: "0%", height: "100%",
                backgroundColor: "var(--signal-green)",
                transition: "width 0.1s ease, background-color 0.15s ease",
                borderRadius: "3px"
              }} />
            </div>
          </div>
        </div>
      </div>

      <div id="game-state-overlay" className="gameover-overlay" style={{ display: "none" }}>
        <div className="gameover-box neo-elevated">
          <h1 id="game-state-title" style={{ fontSize: "32px", margin: 0, letterSpacing: "0.22em", fontWeight: 900, textTransform: "uppercase" }}>
            SILK SNAPPED
          </h1>
          
          <div style={{ height: "1px", width: "60px", background: "rgba(255,255,255,0.08)", margin: "24px 0" }} />

          <p id="game-state-subtitle" style={{ fontSize: "11px", color: "#718096", margin: "0 0 24px 0", letterSpacing: "0.12em" }}>
            PRESS KEY [R] TO RECONNECT THE LINE
          </p>

          <button
            onClick={handleRetryClick}
            className="neo-btn neo-btn-focused"
            style={{ 
              padding: "14px 28px", 
              fontSize: "12px", 
              borderRadius: "8px", 
              width: "100%", 
              maxWidth: "200px",
              pointerEvents: "auto"
            }}
          >
            <span className="cursor-arrow">▶</span>
            RECONNECT
            <span className="cursor-arrow">◀</span>
          </button>
        </div>
      </div>
    </>
  );
};
