import React, { useEffect, useState, useCallback } from "react";
import { usePlayerStore, useWeaverStore, useTetherStore, useOverlayStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";
import { Trophy, Skull, RotateCcw, Trash2 } from "lucide-react";
import { useCursorStore } from "../cursor/useCursorStore";
import { motion, AnimatePresence } from "framer-motion";
import * as Tone from "tone";

export const HudOverlay: React.FC = () => {
  const playerState = usePlayerStore(
    useShallow((s) => ({ playerHp: s.playerHp, currentState: s.currentState }))
  );
  const { playerHp, currentState } = playerState;

  const weaverState = useWeaverStore(
    useShallow((s) => ({
      weaverHp: s.weaverHp,
      weaverMaxHp: s.weaverMaxHp,
      weaverState: s.weaverState,
      weaverHue: s.weaverHue
    }))
  );
  const { weaverHp, weaverMaxHp, weaverState: wStateName, weaverHue } = weaverState;

  const tetherTension = useTetherStore((s) => s.tetherTension);

  const overlayState = useOverlayStore(
    useShallow((s) => ({
      traversalHint: s.traversalHint,
      traversalHintColor: s.traversalHintColor,
      traversalHintOpacity: s.traversalHintOpacity,
      overlayVisible: s.overlayVisible,
      overlayTitle: s.overlayTitle,
      overlayColor: s.overlayColor,
      isPaused: s.isPaused,
      awaitingGesture: s.awaitingGesture,
      wins: s.wins,
      losses: s.losses,
      bootStatus: s.bootStatus,
      menuIndex: s.menuIndex,
      setMenuIndex: s.setMenuIndex,
      clearStats: s.clearStats
    }))
  );

  const {
    traversalHint,
    traversalHintColor,
    traversalHintOpacity,
    overlayVisible,
    overlayTitle,
    overlayColor,
    isPaused,
    awaitingGesture,
    wins,
    losses,
    bootStatus,
    menuIndex,
    setMenuIndex,
    clearStats
  } = overlayState;

  const [staggerPhase, setStaggerPhase] = useState<number>(0);
  const [tickerWins, setTickerWins] = useState<number>(0);
  const [tickerLosses, setTickerLosses] = useState<number>(0);

  const handleRetryClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  }, []);

  const playTickSynth = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("silk-stats-tick"));
    } catch {
      // Ignored
    }
  }, []);

  const playConfirmSynth = useCallback(() => {
    try {
      if (Tone.getContext().state === "running") {
        const synth = new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 }
        }).toDestination();
        synth.volume.value = -6;
        synth.triggerAttackRelease("C6", "16n");
        setTimeout(() => synth.dispose(), 250);
      }
    } catch {
      // Ignored
    }
  }, []);

  const playTensionAlarm = useCallback(() => {
    try {
      if (Tone.getContext().state === "running" && Math.random() < 0.1) {
        const synth = new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 }
        }).toDestination();
        synth.volume.value = -18;
        synth.triggerAttackRelease("F6", "32n");
        setTimeout(() => synth.dispose(), 150);
      }
    } catch {
      // Ignored
    }
  }, []);

  const handleClearStats = useCallback(() => {
    clearStats();
    setTickerWins(0);
    setTickerLosses(0);
  }, [clearStats]);

  useEffect(() => {
    if (awaitingGesture) {
      const handleStartOnKey = (e: KeyboardEvent) => {
        e.preventDefault();
        playConfirmSynth();
        useOverlayStore.getState().setAwaitingGesture(false);
        useOverlayStore.getState().setBootStatus("READY");
      };
      window.addEventListener("keydown", handleStartOnKey);
      return () => window.removeEventListener("keydown", handleStartOnKey);
    }
  }, [awaitingGesture, playConfirmSynth]);

  useEffect(() => {
    if (!overlayVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      const isMoveLeft = code === "ArrowLeft" || code === "KeyA";
      const isMoveRight = code === "ArrowRight" || code === "KeyD";
      const isMoveUp = code === "ArrowUp" || code === "KeyW";
      const isMoveDown = code === "ArrowDown" || code === "KeyS";

      if (isMoveLeft || isMoveUp) {
        e.preventDefault();
        playTickSynth();
        setMenuIndex((menuIndex - 1 + 2) % 2);
      } else if (isMoveRight || isMoveDown) {
        e.preventDefault();
        playTickSynth();
        setMenuIndex((menuIndex + 1) % 2);
      } else if (code === "Enter" || code === "Space") {
        e.preventDefault();
        playConfirmSynth();
        if (menuIndex === 0) {
          handleRetryClick();
        } else {
          handleClearStats();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    overlayVisible,
    menuIndex,
    setMenuIndex,
    playTickSynth,
    playConfirmSynth,
    handleRetryClick,
    handleClearStats
  ]);

  useEffect(() => {
    if (!overlayVisible) {
      const resetTimeout = setTimeout(() => {
        setStaggerPhase(0);
        setTickerWins(0);
        setTickerLosses(0);
      }, 0);
      return () => clearTimeout(resetTimeout);
    }

    const t1 = setTimeout(() => {
      setStaggerPhase(1);
    }, 300);

    const t2 = setTimeout(() => {
      setStaggerPhase(2);
    }, 900);

    const t3 = setTimeout(() => {
      let currentW = 0;
      let currentL = 0;
      const targetW = wins;
      const targetL = losses;

      const statsInterval = setInterval(() => {
        let changed = false;
        if (currentW < targetW) {
          currentW++;
          setTickerWins(currentW);
          changed = true;
        }
        if (currentL < targetL) {
          currentL++;
          setTickerLosses(currentL);
          changed = true;
        }

        if (changed) {
          playTickSynth();
        } else {
          clearInterval(statsInterval);
          setStaggerPhase(3);
        }
      }, 70);

      return () => clearInterval(statsInterval);
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [overlayVisible, wins, losses, playTickSynth]);

  useEffect(() => {
    if (playerHp === 1 && !overlayVisible) {
      const interval = setInterval(playTensionAlarm, 1000);
      return () => clearInterval(interval);
    }
  }, [playerHp, overlayVisible, playTensionAlarm]);

  const isBooting = bootStatus !== "READY" && !awaitingGesture;

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
  const weaverHpBarColor =
    weaverHp <= weaverMaxHp * 0.3
      ? "rgb(245, 158, 11)"
      : "rgb(239, 68, 68)";

  const isCriticalHp = playerHp === 1 && !overlayVisible;

  return (
    <>
      {isBooting ? (
        <div className="overlay-root font-mono pointer-events-auto">
          <div className="overlay-modal max-w-sm w-full border border-zinc-800 bg-[#0a0c12]/95 p-8 flex flex-col items-center">
            <h2 className="text-emerald-500 font-bold uppercase tracking-[0.25em] text-sm mb-4">
              INITIALIZING...
            </h2>
            <div className="w-full bg-black border border-zinc-800 h-1.5 mb-6 overflow-hidden rounded">
              <div
                className="h-full bg-emerald-500"
                style={{ width: "100%" }}
              />
            </div>
            <pre className="text-zinc-400 text-[9px] uppercase tracking-wider text-left leading-relaxed w-full whitespace-pre-wrap select-none">
              {bootStatus}
            </pre>
          </div>
        </div>
      ) : awaitingGesture ? (
        <div className="overlay-root font-mono backdrop-wipe-active pointer-events-auto">
          <div className="overlay-modal start-screen-modal victory-border max-w-sm w-full p-8 flex flex-col items-center">
            <button
              onClick={() => {
                playConfirmSynth();
                useOverlayStore.getState().setAwaitingGesture(false);
                useOverlayStore.getState().setBootStatus("READY");
              }}
              onMouseEnter={() => useCursorStore.getState().setCursorType("button")}
              onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
              className="gameover-btn gameover-btn-victory-focused pointer-events-auto w-full flex items-center justify-center"
            >
              <span>CLICK OR PRESS ANY BUTTON TO BEGIN</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="hud-root select-none pointer-events-none">
          <div className={`cabinet-header-panel ${isCriticalHp ? "hud-stress-shiver" : ""}`}>
            <div className="header-left">
              <span className="bezel-panel-label">PILOT CORE</span>
              <div className="hud-hp-row">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i + "-" + playerHp}
                    className={`hp-block ${i < playerHp ? "hp-active led-spring-impact" : ""}`}
                  />
                ))}
              </div>
            </div>

            <div className="header-center">
              {clampedTension >= 1.0 ? (
                <span className="warn-text warn-alert">WARNING: OVERLOAD</span>
              ) : currentState === "LAUNCHING" ? (
                <span className="warn-text warn-launch">LAUNCH SUCCESS</span>
              ) : (
                <span className="warn-text">▧ SILK ▨</span>
              )}
            </div>

            <div className="header-right">
              <div className="weaver-hp-block">
                <div className="hud-label-row">
                  <span className="bezel-panel-label" style={{ color: weaverHue }}>
                    {wStateName}
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
              </div>
            </div>
          </div>

          <div className="hud-bottom">
            <div
              className="hud-hint"
              style={{
                opacity: traversalHintOpacity,
                color: traversalHintColor
              }}
            >
              {traversalHint}
            </div>
          </div>

          <div className="cabinet-footer-panel">
            <div className="footer-left">
              <div className="hud-label-row">
                <span className="bezel-panel-label">TETHER TENSILE LOAD</span>
                <span className="bezel-panel-val" style={{ color: tensionTextColor }}>
                  {displayTensionPercent}%
                </span>
              </div>
              <div className="hud-bar-track" style={{ width: "160px" }}>
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

            <div className="footer-right">
              <span className="bezel-panel-label">HISTORICAL CAREER DIAGS</span>
              <div className="footer-stats-box font-mono text-[10px]">
                <span className="text-emerald-500">ASC: {wins}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-rose-500">COL: {losses}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {overlayVisible && (
          <div className="overlay-root backdrop-wipe-active pointer-events-auto">
            <motion.div
              layout
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className={`overlay-modal ${overlayTitle === "DEFEATED" ? "defeat-border" : "victory-border"}`}
            >
              {staggerPhase >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="flex-col-center mb-2"
                >
                  {overlayTitle === "DEFEATED" ? (
                    <Skull
                      size={48}
                      className="defeat-icon-anim"
                      style={{ color: "var(--accent-danger)", filter: "drop-shadow(0 0 10px rgba(239, 68, 68, 0.45))" }}
                    />
                  ) : (
                    <Trophy
                      size={48}
                      className="victory-icon-anim"
                      style={{ color: "var(--accent-success)", filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.45))" }}
                    />
                  )}
                  <h1
                    className={`overlay-title ${overlayTitle === "DEFEATED" ? "defeat-title-anim" : "victory-title-anim"}`}
                    style={{ color: overlayColor, marginTop: "12px" }}
                  >
                    {overlayTitle}
                  </h1>
                </motion.div>
              )}

              {staggerPhase >= 2 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: 15 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  onMouseEnter={() => useCursorStore.getState().setCursorType("default")}
                  onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
                  className="gameover-stat-card w-full"
                >
                  <div className="gameover-stat-row">
                    <span className="gameover-stat-label">TOTAL WINS</span>
                    <span key={`wins-${tickerWins}`} className="gameover-stat-value gameover-stat-win led-spring-impact inline-block">
                      {tickerWins}
                    </span>
                  </div>
                  <div className="gameover-stat-row">
                    <span className="gameover-stat-label">TOTAL LOSSES</span>
                    <span key={`losses-${tickerLosses}`} className="gameover-stat-value gameover-stat-loss led-spring-impact inline-block">
                      {tickerLosses}
                    </span>
                  </div>
                </motion.div>
              )}

              {staggerPhase >= 3 && (
                <>
                  <div className="gameover-divider" />
                  <div className="gameover-btn-container w-full">
                    <button
                      onClick={handleRetryClick}
                      onMouseEnter={() => {
                        setMenuIndex(0);
                        playTickSynth();
                        useCursorStore.getState().setCursorType("button");
                      }}
                      onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
                      className={`neo-btn gameover-btn ${
                        menuIndex === 0
                          ? (overlayTitle === "DEFEATED" ? "gameover-btn-defeat-focused" : "gameover-btn-victory-focused")
                          : (overlayTitle === "DEFEATED" ? "gameover-btn-defeat-hover" : "gameover-btn-victory-hover")
                      }`}
                    >
                      {menuIndex === 0 && <span className="gameover-inline-arrow" style={{ marginRight: "6px" }}>▶</span>}
                      <RotateCcw size={16} className="flex-shrink-0" />
                      <span>RETRY</span>
                      {menuIndex === 0 && <span className="gameover-inline-arrow" style={{ marginLeft: "6px" }}>◀</span>}
                    </button>

                    <button
                      onClick={() => {
                        handleClearStats();
                        playConfirmSynth();
                      }}
                      onMouseEnter={() => {
                        setMenuIndex(1);
                        playTickSynth();
                        useCursorStore.getState().setCursorType("button");
                      }}
                      onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
                      className={`neo-btn gameover-btn ${
                        menuIndex === 1
                          ? (overlayTitle === "DEFEATED" ? "gameover-btn-defeat-focused" : "gameover-btn-victory-focused")
                          : (overlayTitle === "DEFEATED" ? "gameover-btn-defeat-hover" : "gameover-btn-victory-hover")
                      }`}
                    >
                      {menuIndex === 1 && <span className="gameover-inline-arrow" style={{ marginRight: "6px" }}>▶</span>}
                      <Trash2 size={16} className="flex-shrink-0" />
                      <span>CLEAR</span>
                      {menuIndex === 1 && <span className="gameover-inline-arrow" style={{ marginLeft: "6px" }}>◀</span>}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isPaused && !isBooting && !awaitingGesture && (
        <div
          className="overlay-root font-mono pointer-events-auto flex items-center justify-center"
          style={{ background: "rgba(12, 13, 17, 0.65)" }}
        >
          <div className="flex flex-col items-center justify-center text-center animate-bounce-short">
            <h1 className="text-3xl font-black tracking-[0.25em] paused-title-glow" style={{ color: "var(--accent-tension)" }}>
              PAUSED
            </h1>
            <p className="text-[11px] text-zinc-400 tracking-[0.15em] uppercase mt-2">
              PRESS 'P' TO RESUME
            </p>
          </div>
        </div>
      )}
    </>
  );
};
