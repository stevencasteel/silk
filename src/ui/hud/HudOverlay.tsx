import React, { useEffect, useState, useCallback, useRef } from "react";
import { usePlayerStore, useWeaverStore, useOverlayStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";
import { Trophy, Skull, RotateCcw, Trash2, Heart } from "lucide-react";
import { useCursorStore } from "../cursor/useCursorStore";
import { motion, AnimatePresence } from "framer-motion";

export const HudOverlay: React.FC = () => {
  const playerState = usePlayerStore(
    useShallow((s) => ({ playerHp: s.playerHp, currentState: s.currentState }))
  );
  const { playerHp, currentState } = playerState;

  const weaverState = useWeaverStore(
    useShallow((s) => ({
      weaverHp: s.weaverHp,
      weaverMaxHp: s.weaverMaxHp
    }))
  );
  const { weaverHp, weaverMaxHp } = weaverState;

  // React Bypass DOM Element Refs for High-Frequency Tension updates
  const tensionBarFillRef = useRef<HTMLDivElement | null>(null);
  const tensionTextValRef = useRef<HTMLSpanElement | null>(null);

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

  const [hpAnims, setHpAnims] = useState<string[]>(Array(5).fill(""));
  const [hurtShakeActive, setHurtShakeActive] = useState<boolean>(false);
  const prevHpRef = useRef(playerHp);

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
      window.dispatchEvent(new CustomEvent("silk-play-confirm"));
    } catch {
      // Ignored
    }
  }, []);

  const playTensionAlarm = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("silk-tension-alarm"));
    } catch {
      // Ignored
    }
  }, []);

  const handleClearStats = useCallback(() => {
    clearStats();
    setTickerWins(0);
    setTickerLosses(0);
  }, [clearStats]);

  // Hooking the high-frequency event stream to bypass the React rendering tree
  useEffect(() => {
    const handleTensionTick = (e: Event) => {
      const tensionVal = (e as CustomEvent).detail.tension;
      const snapLimit = 1.3;
      const clamped = Math.max(0, Math.min(snapLimit, tensionVal));
      const displayPercent = Math.round(clamped * 100);
      const scaleX = clamped / snapLimit;

      let color = "rgb(16, 185, 129)";
      let textColor = "rgb(244, 244, 245)";
      if (clamped >= 1.0) {
        color = "rgb(239, 68, 68)";
        textColor = "rgb(239, 68, 68)";
      } else if (clamped >= 0.75) {
        color = "rgb(245, 158, 11)";
        textColor = "rgb(245, 158, 11)";
      }

      if (tensionBarFillRef.current) {
        tensionBarFillRef.current.style.width = `${(scaleX * 100).toFixed(1)}%`;
        tensionBarFillRef.current.style.background = color;
        tensionBarFillRef.current.style.boxShadow = `0 0 8px ${color}`;
      }

      if (tensionTextValRef.current) {
        tensionTextValRef.current.textContent = `${displayPercent}%`;
        tensionTextValRef.current.style.color = textColor;
      }
    };

    window.addEventListener("silk-tension-render-tick", handleTensionTick);
    return () => {
      window.removeEventListener("silk-tension-render-tick", handleTensionTick);
    };
  }, []);

  useEffect(() => {
    const prevHP = prevHpRef.current;
    let shakeTimer: ReturnType<typeof setTimeout> | null = null;
    let animTimer: ReturnType<typeof setTimeout> | null = null;

    if (playerHp !== prevHP) {
      const tookDamage = playerHp < prevHP && prevHP !== -1;
      const healed = playerHp > prevHP && prevHP !== -1;

      if (tookDamage) {
        setHurtShakeActive(true);
        shakeTimer = setTimeout(() => setHurtShakeActive(false), 200);
      }

      const nextCls = Array<string>(5).fill("");
      for (let i = 0; i < 5; i++) {
        if (tookDamage && i === playerHp) {
          nextCls[i] = "led-shaking-die";
        } else if (healed && i === playerHp - 1) {
          nextCls[i] = "led-elastic-spring";
        } else if (tookDamage && i < playerHp) {
          nextCls[i] = "led-spring-impact";
        }
      }
      setHpAnims(nextCls);
      prevHpRef.current = playerHp;

      animTimer = setTimeout(() => {
        setHpAnims(Array(5).fill(""));
      }, 500);
    }

    return () => {
      if (shakeTimer) clearTimeout(shakeTimer);
      if (animTimer) clearTimeout(animTimer);
    };
  }, [playerHp]);

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
  const weaverHpRatio = Math.max(0, weaverHp / weaverMaxHp);
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
        <div className="overlay-root font-mono backdrop-wipe-gesture pointer-events-auto">
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
          <div className={`cabinet-header-panel ${isCriticalHp || hurtShakeActive ? "hud-stress-shiver" : ""}`}>
            <div className="header-left flex flex-col gap-1.5">
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--signal-green)", fontSize: "13px", fontWeight: "900", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                <Heart size={13} fill="var(--signal-green)" style={{ color: "var(--signal-green)", flexShrink: 0 }} /> PLAYER HP
              </span>
              <div className="hud-hp-row" style={{ display: "flex", gap: "6px" }}>
                {[...Array(5)].map((_, i) => {
                  const isLit = i < playerHp;
                  return (
                    <div
                      key={i}
                      className={`led-dot ${isLit ? "led-green" : ""} ${hpAnims[i]}`}
                      style={{
                        border: "1px solid rgba(0,0,0,0.6)",
                        background: isLit ? undefined : "#07080b",
                        width: "14px",
                        height: "14px"
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="header-center">
              {currentState === "LAUNCHING" ? (
                <span className="warn-text warn-launch">LAUNCH SUCCESS</span>
              ) : (
                <span className="warn-text">▧ SILK ▨</span>
              )}
            </div>

            <div className="header-right flex flex-col items-end gap-1.5">
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--signal-red)", fontSize: "13px", fontWeight: "900", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                <Skull size={13} fill="var(--signal-red)" style={{ color: "var(--signal-red)", flexShrink: 0 }} /> BOSS
              </span>
              <div
                className="neo-pressed"
                style={{
                  width: "140px",
                  height: "12px",
                  borderRadius: "6px",
                  padding: "2px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  background: "#07080b",
                  border: "1px solid rgba(0,0,0,0.4)"
                }}
              >
                <div
                  className={weaverHp > 0 ? "led-red" : ""}
                  style={{
                    height: "100%",
                    borderRadius: "4px",
                    width: `${(weaverHpRatio * 100).toFixed(1)}%`,
                    transition: "width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2)",
                  }}
                />
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
            <div className="flex flex-col items-center gap-2" style={{ width: "320px" }}>
              <div className="flex justify-between w-full font-bold" style={{ padding: "0 4px", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: "900", letterSpacing: "0.2em", textTransform: "uppercase" }}>TENSION</span>
                <span ref={tensionTextValRef} style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "900", letterSpacing: "0.05em" }}>
                  0%
                </span>
              </div>
              <div
                className="neo-pressed"
                style={{
                  width: "100%",
                  height: "14px",
                  borderRadius: "7px",
                  padding: "2px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  background: "#07080b",
                  border: "1px solid rgba(0,0,0,0.4)"
                }}
              >
                <div
                  ref={tensionBarFillRef}
                  style={{
                    height: "100%",
                    borderRadius: "5px",
                    width: "0%",
                    transition: "width 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.2)"
                  }}
                />
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
                  className="flex flex-col items-center mb-2"
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
