import React, { useEffect, useState, useCallback } from "react";
import { usePlayerStore, useWeaverStore, useTetherStore, useOverlayStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";
import { Trophy, Skull, RotateCcw } from "lucide-react";
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
      overlaySubtitle: s.overlaySubtitle,
      isPaused: s.isPaused,
      awaitingGesture: s.awaitingGesture,
      wins: s.wins,
      losses: s.losses,
      bootStatus: s.bootStatus
    }))
  );

  const {
    traversalHint,
    traversalHintColor,
    traversalHintOpacity,
    overlayVisible,
    overlayTitle,
    overlayColor,
    overlaySubtitle,
    isPaused,
    awaitingGesture,
    wins,
    losses,
    bootStatus
  } = overlayState;

  const [staggerPhase, setStaggerPhase] = useState<number>(0);
  const [tickerWins, setTickerWins] = useState<number>(0);
  const [tickerLosses, setTickerLosses] = useState<number>(0);

  const handleRetryClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  }, []);

  const handleResumeClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP" }));
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
    if (!overlayVisible || staggerPhase < 3) return;

    const handleKeys = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === "Enter" || code === "Space") {
        e.preventDefault();
        playConfirmSynth();
        handleRetryClick();
      }
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [overlayVisible, staggerPhase, playConfirmSynth, handleRetryClick]);

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
        <div className="overlay-root font-mono">
          <div className="overlay-modal max-w-md w-full border border-zinc-800 bg-[#0a0c12]/95 p-8 flex flex-col items-center">
            <h2 className="text-emerald-500 font-bold uppercase tracking-[0.25em] text-lg mb-4 animate-pulse">
              SILK INITIALIZATION
            </h2>
            <div className="w-full bg-black border border-zinc-800 h-2 mb-6 overflow-hidden rounded">
              <div
                className="h-full bg-emerald-500 animate-[pulse_1.5s_infinite]"
                style={{ width: "100%" }}
              />
            </div>
            <pre className="text-zinc-400 text-[10px] uppercase tracking-wider text-left leading-relaxed w-full whitespace-pre-wrap select-none">
              {"[SYSTEM BOOT]: ONLINE\n[STATUS]: " + bootStatus}
            </pre>
          </div>
        </div>
      ) : awaitingGesture ? (
        <div className="overlay-root font-mono">
          <div className="overlay-modal max-w-md w-full border border-emerald-700 bg-[#0a0c12]/95 p-8 flex flex-col items-center">
            <h2 className="text-emerald-500 font-bold uppercase tracking-[0.25em] text-lg mb-4">
              SILK
            </h2>
            <div className="text-zinc-300 text-sm mb-2">SYSTEMS NOMINAL</div>
            <div className="text-emerald-500 text-xs uppercase tracking-widest animate-pulse mt-4">
              CLICK OR PRESS ANY KEY TO START
            </div>
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
                  className="flex-col-center mb-4"
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
                    style={{ color: overlayColor, marginTop: "16px" }}
                  >
                    {overlayTitle}
                  </h1>
                  <p className="overlay-subtitle mt-2">{overlaySubtitle}</p>
                </motion.div>
              )}

              {staggerPhase >= 2 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: 15 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  onMouseEnter={() => useCursorStore.getState().setCursorType("text")}
                  onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
                  className="gameover-stat-card w-full mb-6 py-3 px-4 bg-black/60 border border-zinc-800 rounded flex flex-col gap-2"
                  style={{ overflow: "hidden" }}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-bold uppercase tracking-wider">TOTAL ASCENTS (WINS)</span>
                    <span key={`wins-${tickerWins}`} className="text-emerald-500 font-bold text-sm led-spring-impact inline-block">
                      {tickerWins}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-bold uppercase tracking-wider">LINE COLLAPSES (LOSSES)</span>
                    <span key={`losses-${tickerLosses}`} className="text-rose-500 font-bold text-sm led-spring-impact inline-block">
                      {tickerLosses}
                    </span>
                  </div>
                </motion.div>
              )}

              {staggerPhase >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.15 }}
                  className="w-full"
                >
                  <button
                    onClick={handleRetryClick}
                    onMouseEnter={() => useCursorStore.getState().setCursorType("button")}
                    onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
                    className={`gameover-btn pointer-events-auto relative w-full flex items-center justify-center gap-3 ${
                      overlayTitle === "DEFEATED" ? "gameover-btn-defeat-focused" : "gameover-btn-focused"
                    }`}
                  >
                    <span className="gameover-inline-arrow" style={{ marginRight: "8px" }}>▶</span>
                    <RotateCcw size={14} className="flex-shrink-0" />
                    <span>RETRY RUN</span>
                    <span className="gameover-inline-arrow" style={{ marginLeft: "8px" }}>◀</span>
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isPaused && !isBooting && !awaitingGesture && (
        <div className="overlay-root">
          <div
            className="overlay-modal mb-2 animate-bounce-short"
            style={{ borderColor: "var(--accent-tension)" }}
          >
            <h1 className="overlay-title" style={{ color: "var(--accent-tension)" }}>
              PAUSED
            </h1>
            <div className="overlay-divider" style={{ backgroundColor: "var(--accent-tension)" }} />
            <p className="overlay-subtitle">SIMULATION SUSPENDED</p>
            <button
              onClick={handleResumeClick}
              onMouseEnter={() => useCursorStore.getState().setCursorType("button")}
              onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
              className="overlay-btn pointer-events-auto"
            >
              RESUME
            </button>
          </div>
        </div>
      )}
    </>
  );
};
