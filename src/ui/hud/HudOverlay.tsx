import React from "react";
import { useHudStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";

export const HudOverlay: React.FC = () => {
  const {
    playerHp,
    playerMaxHp,
    weaverHp,
    weaverMaxHp,
    weaverState,
    weaverHue,
    tension,
    traversalHint,
    traversalHintColor,
    traversalHintOpacity,
    overlayVisible,
    overlayTitle,
    overlayColor,
    overlaySubtitle,
    isPaused,
  } = useHudStore(
    useShallow((state) => ({
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      weaverHp: state.weaverHp,
      weaverMaxHp: state.weaverMaxHp,
      weaverState: state.weaverState,
      weaverHue: state.weaverHue,
      tension: state.tension,
      traversalHint: state.traversalHint,
      traversalHintColor: state.traversalHintColor,
      traversalHintOpacity: state.traversalHintOpacity,
      overlayVisible: state.overlayVisible,
      overlayTitle: state.overlayTitle,
      overlayColor: state.overlayColor,
      overlaySubtitle: state.overlaySubtitle,
      isPaused: state.isPaused,
    }))
  );

  const handleRetryClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  };

  const handleResumeClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP" }));
  };

  const snapLimit = 1.3;
  const clampedTension = Math.max(0, Math.min(snapLimit, tension));
  const displayTensionPercent = Math.round(clampedTension * 100);
  const tensionScaleX = clampedTension / snapLimit;

  let tensionBarColor = "rgb(16, 185, 129)";
  let tensionTextColor = "rgb(244, 244, 245)";
  if (clampedTension >= 1.0) {
    tensionBarColor = "rgb(239, 68, 68)";
    tensionTextColor = "rgb(239, 68, 68)";
  } else if (clampedTension >= 0.75) {
    tensionBarColor = "rgb(245, 158, 11)";
    tensionTextColor = "rgb(245, 158, 11)";
  }

  const weaverHpRatio = Math.max(0, weaverHp / weaverMaxHp);
  const weaverHpBarColor = weaverHp <= weaverMaxHp * 0.3 ? "rgb(245, 158, 11)" : "rgb(239, 68, 68)";

  return (
    <>
      <div className="hud-root">
        <div className="hud-top">
          <div className="hud-panel">
            <div className="hud-label">PILOT INTEGRITY</div>
            <div className="hud-hp-row">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`hp-block ${i < playerHp ? "hp-active" : ""}`}
                />
              ))}
            </div>
            <div className="hud-subtext">
              {playerHp} / {playerMaxHp}
            </div>
          </div>

          <div className="hud-panel hud-right">
            <div className="hud-label-row">
              <span className="hud-label">WEAVER CORE</span>
              <span className="hud-value">
                {weaverHp}/{weaverMaxHp}
              </span>
            </div>
            <div className="hud-bar-track">
              <div
                className="hud-bar-fill"
                style={{
                  transform: `scaleX(${weaverHpRatio.toFixed(3)})`,
                  transformOrigin: "left",
                  backgroundColor: weaverHpBarColor,
                }}
              />
            </div>
            <span
              className="hud-state-text"
              style={{ color: weaverHue }}
            >
              {weaverState.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="hud-bottom">
          <div
            className="hud-hint"
            style={{
              opacity: traversalHintOpacity,
              color: traversalHintColor,
            }}
          >
            {traversalHint}
          </div>
          <div className="hud-panel hud-center">
            <div className="hud-label-row">
              <span className="hud-label">TETHER TENSION</span>
              <span className="hud-value" style={{ color: tensionTextColor }}>
                {displayTensionPercent}%
              </span>
            </div>
            <div className="hud-bar-track">
              <div
                className="hud-bar-fill"
                style={{
                  transform: `scaleX(${tensionScaleX.toFixed(3)})`,
                  transformOrigin: "left",
                  backgroundColor: tensionBarColor,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {overlayVisible && (
        <div className="overlay-root">
          <div className="overlay-modal">
            <h1 className="overlay-title" style={{ color: overlayColor }}>
              {overlayTitle}
            </h1>
            <div className="overlay-divider" />
            <p className="overlay-subtitle">
              {overlaySubtitle}
            </p>
            <button onClick={handleRetryClick} className="overlay-btn">
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="overlay-root">
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
      )}
    </>
  );
};
