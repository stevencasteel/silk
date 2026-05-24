import React from "react";

export const HudOverlay: React.FC = () => {
  const handleRetryClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  };

  const handleResumeClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP" }));
  };

  return (
    <>
      <div className="hud-root">
        <div className="hud-top">
          <div className="hud-panel">
            <div className="hud-label">PILOT INTEGRITY</div>
            <div className="hud-hp-row">
              {[...Array(5)].map((_, i) => (
                <div key={i} id={`player-hp-led-${i}`} className="hp-block hp-active" />
              ))}
            </div>
            <div id="player-hp-text" className="hud-subtext">
              5 / 5
            </div>
          </div>

          <div className="hud-panel hud-right">
            <div className="hud-label-row">
              <span className="hud-label">WEAVER CORE</span>
              <span id="weaver-hp-value" className="hud-value">
                100/100
              </span>
            </div>
            <div className="hud-bar-track">
              <div id="weaver-hp-bar" className="hud-bar-fill" />
            </div>
            <span
              id="weaver-state-text"
              className="hud-state-text"
              style={{ color: "rgb(239, 68, 68)" }}
            >
              SWEEPING
            </span>
          </div>
        </div>

        <div className="hud-bottom">
          <div id="traversal-hint" className="hud-hint" />
          <div className="hud-panel hud-center">
            <div className="hud-label-row">
              <span className="hud-label">SILK TENSION</span>
              <span id="tension-meter-text" className="hud-value">
                0%
              </span>
            </div>
            <div className="hud-bar-track">
              <div
                id="tension-meter-bar"
                className="hud-bar-fill"
                style={{ backgroundColor: "rgb(16, 185, 129)" }}
              />
            </div>
          </div>
        </div>
      </div>

      <div id="game-state-overlay" className="overlay-root" style={{ display: "none" }}>
        <div className="overlay-modal">
          <h1 id="game-state-title" className="overlay-title">
            VICTORY
          </h1>
          <div className="overlay-divider" />
          <p id="game-state-subtitle" className="overlay-subtitle">
            The shaft is clear.
          </p>
          <button onClick={handleRetryClick} className="overlay-btn">
            PLAY AGAIN
          </button>
        </div>
      </div>

      <div id="pause-overlay" className="overlay-root" style={{ display: "none" }}>
        <div className="overlay-modal" style={{ borderColor: "var(--accent-tension)" }}>
          <h1 className="overlay-title" style={{ color: "var(--accent-tension)" }}>
            PAUSED
          </h1>
          <div className="overlay-divider" style={{ backgroundColor: "var(--accent-tension)" }} />
          <p className="overlay-subtitle">
            SIMULATION SUSPENDED
          </p>
          <button onClick={handleResumeClick} className="overlay-btn">
            RESUME
          </button>
        </div>
      </div>
    </>
  );
};
