import React from "react";
import { useHudStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";

export const HudOverlay: React.FC = () => {
  const {
    playerHp,
    playerMaxHp,
    traversalHint,
    traversalHintColor,
    traversalHintOpacity,
    overlayVisible,
    overlayTitle,
    overlayColor,
    overlaySubtitle,
    isPaused,
    bootStatus,
    tetherTension,
    weaverHp,
    weaverMaxHp,
    weaverState,
    weaverHue,
  } = useHudStore(
    useShallow((state) => ({
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      traversalHint: state.traversalHint,
      traversalHintColor: state.traversalHintColor,
      traversalHintOpacity: state.traversalHintOpacity,
      overlayVisible: state.overlayVisible,
      overlayTitle: state.overlayTitle,
      overlayColor: state.overlayColor,
      overlaySubtitle: state.overlaySubtitle,
      isPaused: state.isPaused,
      bootStatus: state.bootStatus,
      tetherTension: state.tetherTension,
      weaverHp: state.weaverHp,
      weaverMaxHp: state.weaverMaxHp,
      weaverState: state.weaverState,
      weaverHue: state.weaverHue,
    }))
  );

  const handleRetryClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  };

  const handleResumeClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP" }));
  };

  const isBooting = bootStatus !== "READY";

  const snapLimit = 1.3;
  const clampedTension = Math.max(0, Math.min(snapLimit, tetherTension));
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
      {isBooting ? (
        <div className="overlay-root font-mono">
          <div className="overlay-modal max-w-md w-full border border-zinc-800 bg-[#0a0c12]/95 p-8 flex flex-col items-center">
            <h2 className="text-emerald-500 font-bold uppercase tracking-[0.25em] text-lg mb-4 animate-pulse">
              PROTOTYPE SILK INITIALIZATION
            </h2>
            <div className="w-full bg-black border border-zinc-800 h-2 mb-6 overflow-hidden rounded">
              <div className="h-full bg-emerald-500 animate-[pulse_1.5s_infinite]" style={{ width: "100%" }} />
            </div>
            <pre className="text-zinc-400 text-[10px] uppercase tracking-wider text-left leading-relaxed w-full whitespace-pre-wrap select-none">
              {"[SYSTEM BOOT]: ONLINE\n[STATUS]: " + bootStatus}
            </pre>
          </div>
        </div>
      ) : (
        <div className="hud-root select-none pointer-events-none">
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
                <span className="hud-value text-zinc-400 font-bold">
                  {weaverHp}/{weaverMaxHp}
                </span>
              </div>
              <div className="hud-bar-track">
                <div
                  className="hud-bar-fill transition-transform duration-75"
                  style={{
                    transform: `scaleX(${weaverHpRatio.toFixed(3)})`,
                    transformOrigin: "left",
                    backgroundColor: weaverHpBarColor,
                  }}
                />
              </div>
              <span
                className="hud-state-text font-bold text-xs tracking-wider transition-colors duration-150"
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
                <span className="hud-value font-bold" style={{ color: tensionTextColor }}>
                  {displayTensionPercent}%
                </span>
              </div>
              <div className="hud-bar-track">
                <div
                  className="hud-bar-fill transition-transform duration-75"
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
      )}

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
            <button onClick={handleRetryClick} className="overlay-btn pointer-events-auto">
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {isPaused && !isBooting && (
        <div className="overlay-root">
          <div className="overlay-modal" style={{ borderColor: "var(--accent-tension)" }}>
            <h1 className="overlay-title" style={{ color: "var(--accent-tension)" }}>
              PAUSED
            </h1>
            <div className="overlay-divider" style={{ backgroundColor: "var(--accent-tension)" }} />
            <p className="overlay-subtitle">
              SIMULATION SUSPENDED
            </p>
            <button onClick={handleResumeClick} className="overlay-btn pointer-events-auto">
              RESUME
            </button>
          </div>
        </div>
      )}
    </>
  );
};
