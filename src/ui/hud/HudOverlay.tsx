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
    }))
  );

  const handleRetryClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  };

  const handleResumeClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP" }));
  };

  const isBooting = bootStatus !== "READY";

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
                <span id="hud-weaver-text" className="hud-value text-zinc-400 font-bold">
                  100/100
                </span>
              </div>
              <div className="hud-bar-track">
                <div
                  id="hud-weaver-fill"
                  className="hud-bar-fill transition-transform duration-75"
                  style={{
                    transform: "scaleX(1.0)",
                    transformOrigin: "left",
                    backgroundColor: "rgb(239, 68, 68)",
                  }}
                />
              </div>
              <span
                id="hud-weaver-state-text"
                className="hud-state-text font-bold text-xs tracking-wider transition-colors duration-150"
                style={{ color: "rgb(239, 68, 68)" }}
              >
                SWEEPING
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
                <span id="hud-tension-text" className="hud-value font-bold">
                  0%
                </span>
              </div>
              <div className="hud-bar-track">
                <div
                  id="hud-tension-fill"
                  className="hud-bar-fill transition-transform duration-75"
                  style={{
                    transform: "scaleX(0.0)",
                    transformOrigin: "left",
                    backgroundColor: "rgb(16, 185, 129)",
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
