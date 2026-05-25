import React from "react";
import { usePlayerStore, useWeaverStore, useTetherStore, useOverlayStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";

export const HudOverlay: React.FC = () => {
  const playerState = usePlayerStore(
    useShallow((s) => ({ playerHp: s.playerHp, playerMaxHp: s.playerMaxHp }))
  );
  const weaverState = useWeaverStore(
    useShallow((s) => ({
      weaverHp: s.weaverHp,
      weaverMaxHp: s.weaverMaxHp,
      weaverState: s.weaverState,
      weaverHue: s.weaverHue
    }))
  );
  const tetherTension = useTetherStore((s) => s.tetherTension);
  const overlayState = useOverlayStore(
    useShallow((s) => ({
      traversalHint: s.traversalHint,
      traversalHintColor: s.traversalHintColor,
      traversalHintOpacity: s.traversalHintOpacity,
      overlayVisible: s.overlayVisible,
      overlayTitle: s.overlayTitle,
      overlayColor: s.overlayColor,
      overlaySubtitle: s.overlaySubtitle,
      isPaused: s.isPaused,
      bootStatus: s.bootStatus,
      awaitingGesture: s.awaitingGesture
    }))
  );

  const handleRetryClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  };

  const handleResumeClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP" }));
  };

  const isBooting = overlayState.bootStatus !== "READY" && !overlayState.awaitingGesture;

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

  const weaverHpRatio = Math.max(0, weaverState.weaverHp / weaverState.weaverMaxHp);
  const weaverHpBarColor =
    weaverState.weaverHp <= weaverState.weaverMaxHp * 0.3
      ? "rgb(245, 158, 11)"
      : "rgb(239, 68, 68)";

  return (
    <>
      {isBooting ? (
        <div className="overlay-root font-mono">
          <div className="overlay-modal max-w-md w-full border border-zinc-800 bg-[#0a0c12]/95 p-8 flex flex-col items-center">
            <h2 className="text-emerald-500 font-bold uppercase tracking-[0.25em] text-lg mb-4 animate-pulse">
              PROTOTYPE SILK INITIALIZATION
            </h2>
            <div className="w-full bg-black border border-zinc-800 h-2 mb-6 overflow-hidden rounded">
              <div
                className="h-full bg-emerald-500 animate-[pulse_1.5s_infinite]"
                style={{ width: "100%" }}
              />
            </div>
            <pre className="text-zinc-400 text-[10px] uppercase tracking-wider text-left leading-relaxed w-full whitespace-pre-wrap select-none">
              {"[SYSTEM BOOT]: ONLINE\n[STATUS]: " + overlayState.bootStatus}
            </pre>
          </div>
        </div>
      ) : overlayState.awaitingGesture ? (
        <div className="overlay-root font-mono">
          <div className="overlay-modal max-w-md w-full border border-emerald-700 bg-[#0a0c12]/95 p-8 flex flex-col items-center">
            <h2 className="text-emerald-500 font-bold uppercase tracking-[0.25em] text-lg mb-4">
              PROTOTYPE SILK
            </h2>
            <div className="text-zinc-300 text-sm mb-2">SYSTEMS NOMINAL</div>
            <div className="text-emerald-500 text-xs uppercase tracking-widest animate-pulse mt-4">
              CLICK OR PRESS ANY KEY TO START
            </div>
          </div>
        </div>
      ) : (
        <div className="hud-root select-none pointer-events-none">
          <div className="hud-top">
            <div className="hud-panel">
              <div className="hud-label">PILOT INTEGRITY</div>
              <div className="hud-hp-row">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`hp-block ${i < playerState.playerHp ? "hp-active" : ""}`} />
                ))}
              </div>
              <div className="hud-subtext">
                {playerState.playerHp} / {playerState.playerMaxHp}
              </div>
            </div>

            <div className="hud-panel hud-right">
              <div className="hud-label-row">
                <span className="hud-label">WEAVER CORE</span>
                <span className="hud-value text-zinc-400 font-bold">
                  {weaverState.weaverHp}/{weaverState.weaverMaxHp}
                </span>
              </div>
              <div className="hud-bar-track">
                <div
                  className="hud-bar-fill transition-transform duration-75"
                  style={{
                    transform: `scaleX(${weaverHpRatio.toFixed(3)})`,
                    transformOrigin: "left",
                    backgroundColor: weaverHpBarColor
                  }}
                />
              </div>
              <span
                className="hud-state-text font-bold text-xs tracking-wider transition-colors duration-150"
                style={{ color: weaverState.weaverHue }}
              >
                {weaverState.weaverState.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="hud-bottom">
            <div
              className="hud-hint"
              style={{
                opacity: overlayState.traversalHintOpacity,
                color: overlayState.traversalHintColor
              }}
            >
              {overlayState.traversalHint}
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
                    backgroundColor: tensionBarColor
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {overlayState.overlayVisible && (
        <div className="overlay-root">
          <div className="overlay-modal">
            <h1 className="overlay-title" style={{ color: overlayState.overlayColor }}>
              {overlayState.overlayTitle}
            </h1>
            <div className="overlay-divider" />
            <p className="overlay-subtitle">{overlayState.overlaySubtitle}</p>
            <button onClick={handleRetryClick} className="overlay-btn pointer-events-auto">
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {overlayState.isPaused && !isBooting && !overlayState.awaitingGesture && (
        <div className="overlay-root">
          <div className="overlay-modal" style={{ borderColor: "var(--accent-tension)" }}>
            <h1 className="overlay-title" style={{ color: "var(--accent-tension)" }}>
              PAUSED
            </h1>
            <div className="overlay-divider" style={{ backgroundColor: "var(--accent-tension)" }} />
            <p className="overlay-subtitle">SIMULATION SUSPENDED</p>
            <button onClick={handleResumeClick} className="overlay-btn pointer-events-auto">
              RESUME
            </button>
          </div>
        </div>
      )}
    </>
  );
};
