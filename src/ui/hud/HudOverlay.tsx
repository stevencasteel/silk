import React, { useEffect, useState, useCallback, useRef } from "react";
import { usePlayerStore, useWeaverStore, useOverlayStore, useInputStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";
import { Trophy, Skull, RotateCcw, Trash2, Heart, ShieldAlert } from "lucide-react";
import { useCursorStore } from "../cursor/useCursorStore";
import { motion, AnimatePresence } from "framer-motion";
import { GameEvent } from "../../core/events/GameEvents";

interface CalibrationStepMeta {
  successTitle: string;
  activeTitle: string;
  subtitle: string;
  renderKeys: (
    useWasd: boolean,
    isLeft: boolean,
    isRight: boolean,
    isUp: boolean,
    isDown: boolean
  ) => React.ReactNode;
}

const CALIBRATION_STEPS: Record<number, CalibrationStepMeta> = {
  0: {
    successTitle: "1. Cling Successful!",
    activeTitle: "1. Cling to a Wall",
    subtitle: "Hold direction against a wall to stick",
    renderKeys: (useWasd, isLeft, isRight) => (
      <>
        <motion.span
          animate={isLeft ? { scale: 0.85 } : { scale: 1 }}
          className={`keycap-box ${isLeft ? "keycap-used" : ""}`}
        >
          {useWasd ? "A" : "◀"}
        </motion.span>
        <motion.span
          animate={isRight ? { scale: 0.85 } : { scale: 1 }}
          className={`keycap-box ${isRight ? "keycap-used" : ""}`}
        >
          {useWasd ? "D" : "▶"}
        </motion.span>
      </>
    )
  },
  1: {
    successTitle: "2. Fling Successful!",
    activeTitle: "2. Let Go to Fling",
    subtitle: "Release key under tension to launch",
    renderKeys: () => (
      <span className="keycap-box" style={{ padding: "3px 8px" }}>
        RELEASE KEY
      </span>
    )
  }
};

export const HudOverlay: React.FC = () => {
  const playerState = usePlayerStore(
    useShallow((s) => ({
      playerHp: s.playerHp,
      isWebTrapped: s.isWebTrapped,
      escapeProgress: s.escapeProgress,
      escapeRequired: s.escapeRequired,
      webMass: s.webMass,
      tetherDamage: s.tetherDamage
    }))
  );
  const { playerHp, isWebTrapped, escapeProgress, escapeRequired, webMass, tetherDamage } =
    playerState;

  const weaverState = useWeaverStore(
    useShallow((s) => ({
      weaverHp: s.weaverHp,
      weaverMaxHp: s.weaverMaxHp
    }))
  );
  const { weaverHp, weaverMaxHp } = weaverState;

  const tensionBarFillRef = useRef<HTMLDivElement | null>(null);

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
      calibrationStep: s.calibrationStep,
      publishEvent: s.publishEvent
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
    calibrationStep,
    publishEvent
  } = overlayState;

  const [staggerPhase, setStaggerPhase] = useState<number>(0);
  const [tickerWins, setTickerWins] = useState<number>(0);
  const [tickerLosses, setTickerLosses] = useState<number>(0);

  const [hpAnims, setHpAnims] = useState<string[]>(Array(5).fill(""));
  const [hurtShakeActive, setHurtShakeActive] = useState<boolean>(false);
  const prevHpRef = useRef(playerHp);

  const pressedKeys = useInputStore((state) => state.keysPressed);
  const [useWasd, setUseWasd] = useState<boolean>(false);

  const [displayedStep, setDisplayedStep] = useState<number>(calibrationStep);
  const stepSuccess = calibrationStep > displayedStep;

  const [activeStruggleDir, setActiveStruggleDir] = useState<string>("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        setUseWasd(true);
      } else if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        setUseWasd(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleStruggleRegistered = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveStruggleDir(customEvent.detail.direction);
      const timer = setTimeout(() => {
        setActiveStruggleDir("");
      }, 180);
      return () => clearTimeout(timer);
    };
    window.addEventListener("silk-web-struggle", handleStruggleRegistered);
    return () => {
      window.removeEventListener("silk-web-struggle", handleStruggleRegistered);
    };
  }, []);

  const isLeftPressed = !!(pressedKeys["a"] || pressedKeys["arrowleft"]);
  const isRightPressed = !!(pressedKeys["d"] || pressedKeys["arrowright"]);
  const isUpPressed = !!(pressedKeys["w"] || pressedKeys["arrowup"]);
  const isDownPressed = !!(pressedKeys["s"] || pressedKeys["arrowdown"]);

  const handleRetryClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
  }, []);

  const playTickSynth = useCallback(() => {
    publishEvent(GameEvent.UI_SFX_TICK, undefined);
  }, [publishEvent]);

  const playConfirmSynth = useCallback(() => {
    publishEvent(GameEvent.UI_SFX_CONFIRM, undefined);
  }, [publishEvent]);

  const playTensionAlarm = useCallback(() => {
    publishEvent(GameEvent.UI_SFX_ALARM, undefined);
  }, [publishEvent]);

  const handleClearStats = useCallback(() => {
    window.dispatchEvent(new CustomEvent("silk-clear-stats"));
    setTickerWins(0);
    setTickerLosses(0);
  }, []);

  useEffect(() => {
    if (calibrationStep > displayedStep) {
      const timer = setTimeout(() => {
        setDisplayedStep(calibrationStep);
      }, 1500);
      return () => clearTimeout(timer);
    } else if (calibrationStep < displayedStep) {
      const timer = setTimeout(() => {
        setDisplayedStep(calibrationStep);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [calibrationStep, displayedStep]);

  useEffect(() => {
    const handleTensionTick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const tension = detail.tension ?? 0;
      const maxLength = detail.maxLength ?? 10.8;

      const maxReelLimit = 38.0;
      const minReelLimit = 10.8;

      // Filled width represents reeled-out tether progress (0% to 100%)
      const reelProgress = (maxLength - minReelLimit) / (maxReelLimit - minReelLimit);
      const barWidthPercent = Math.max(0.0, Math.min(100.0, reelProgress * 100.0));

      // Color/Glow represents dynamic elastic tautness (Restored sweet-spot and red thresholds)
      let color = "rgb(34, 197, 94)";
      let glow = "rgba(34, 197, 94, 0.45)";

      if (tension >= 0.80) {
        color = "rgb(239, 68, 68)";
        glow = "rgba(239, 68, 68, 0.95)";
      } else if (tension >= 0.555) {
        color = "rgb(234, 179, 8)";
        glow = "rgba(234, 179, 8, 0.75)";
      }

      if (tensionBarFillRef.current) {
        tensionBarFillRef.current.style.width = `${barWidthPercent.toFixed(1)}%`;
        tensionBarFillRef.current.style.background = color;
        
        if (tension > 0.05) {
          const pulse = 1.0 + Math.sin(performance.now() * 0.05 * tension) * 0.1;
          tensionBarFillRef.current.style.boxShadow = `0 0 ${Math.floor(12 * tension * pulse)}px ${glow}`;
          tensionBarFillRef.current.style.transform = `scaleY(${pulse.toFixed(2)})`;
        } else {
          tensionBarFillRef.current.style.boxShadow = "none";
          tensionBarFillRef.current.style.transform = "scaleY(1.0)";
        }
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
    let deferredTimer: ReturnType<typeof setTimeout> | null = null;

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

      deferredTimer = setTimeout(() => {
        setHpAnims(nextCls);
      }, 0);

      prevHpRef.current = playerHp;

      animTimer = setTimeout(() => {
        setHpAnims(Array(5).fill(""));
      }, 500);
    }

    return () => {
      if (shakeTimer) clearTimeout(shakeTimer);
      if (animTimer) clearTimeout(animTimer);
      if (deferredTimer) clearTimeout(deferredTimer);
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
      } else if (code === "Enter") {
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

    let tickTimeout: ReturnType<typeof setTimeout> | null = null;

    const t3 = setTimeout(() => {
      let currentW = 0;
      let currentL = 0;
      const targetW = wins;
      const targetL = losses;

      const getDelay = (current: number, target: number) => {
        if (target <= 1) return 180;
        const progress = current / target;
        const minDelay = 25;
        const maxDelay = 260;
        return minDelay + (maxDelay - minDelay) * Math.pow(progress, 2);
      };

      const tickWins = () => {
        if (currentW < targetW) {
          const delay = getDelay(currentW, targetW);
          currentW++;
          setTickerWins(currentW);
          playTickSynth();
          tickTimeout = setTimeout(tickWins, delay);
        } else {
          tickTimeout = setTimeout(tickLosses, 150);
        }
      };

      const tickLosses = () => {
        if (currentL < targetL) {
          const delay = getDelay(currentL, targetL);
          currentL++;
          setTickerLosses(currentL);
          playTickSynth();
          tickTimeout = setTimeout(tickLosses, delay);
        } else {
          setStaggerPhase(3);
        }
      };

      if (targetW > 0) {
        tickWins();
      } else if (targetL > 0) {
        tickLosses();
      } else {
        setStaggerPhase(3);
      }
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (tickTimeout) clearTimeout(tickTimeout);
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

  const activeLedClass = stepSuccess
    ? "led-green led-elastic-spring"
    : "led-yellow led-spring-impact";
  const activeStep = CALIBRATION_STEPS[displayedStep];

  return (
    <>
      {isBooting ? (
        <div className="overlay-root font-mono pointer-events-auto">
          <div className="overlay-modal max-w-sm w-full border border-zinc-800 bg-[#0a0c12]/95 p-8 flex flex-col items-center">
            <h2 className="text-emerald-500 font-bold uppercase tracking-[0.25em] text-sm mb-4">
              INITIALIZING...
            </h2>
            <div className="w-full bg-black border border-zinc-800 h-1.5 mb-6 overflow-hidden rounded">
              <div className="h-full bg-emerald-500" style={{ width: "100%" }} />
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
          <div
            className={`cabinet-header-panel ${isCriticalHp || hurtShakeActive ? "hud-stress-shiver" : ""}`}
          >
            <div className="header-left flex flex-col gap-1.5">
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--signal-green)",
                  fontSize: "13px",
                  fontWeight: "900",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase"
                }}
              >
                <Heart
                  size={13}
                  fill="var(--signal-green)"
                  style={{ color: "var(--signal-green)", flexShrink: 0 }}
                />{" "}
                PLAYER HP
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

            <div
              className="header-center"
              style={{ minWidth: "220px", display: "flex", justifyContent: "center" }}
            >
              <AnimatePresence mode="wait">
                {isWebTrapped ? (
                  <motion.div
                    key="web-trapped-header"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <motion.span
                        animate={activeStruggleDir === "LEFT" ? { scale: 0.82 } : { scale: 1 }}
                        className={`keycap-box ${activeStruggleDir === "LEFT" ? "keycap-used" : ""}`}
                      >
                        {useWasd ? "A" : "◀"}
                      </motion.span>
                      <motion.span
                        animate={activeStruggleDir === "UP" ? { scale: 0.82 } : { scale: 1 }}
                        className={`keycap-box ${activeStruggleDir === "UP" ? "keycap-used" : ""}`}
                      >
                        {useWasd ? "W" : "▲"}
                      </motion.span>
                      <motion.span
                        animate={activeStruggleDir === "DOWN" ? { scale: 0.82 } : { scale: 1 }}
                        className={`keycap-box ${activeStruggleDir === "DOWN" ? "keycap-used" : ""}`}
                      >
                        {useWasd ? "S" : "▼"}
                      </motion.span>
                      <motion.span
                        animate={activeStruggleDir === "RIGHT" ? { scale: 0.82 } : { scale: 1 }}
                        className={`keycap-box ${activeStruggleDir === "RIGHT" ? "keycap-used" : ""}`}
                      >
                        {useWasd ? "D" : "▶"}
                      </motion.span>
                      <div
                        className="led-dot led-red"
                        style={{ width: "6px", height: "6px", marginLeft: "4px" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <ShieldAlert
                        size={10}
                        style={{ color: "var(--signal-red)", flexShrink: 0 }}
                        className="animate-pulse"
                      />
                      <span
                        className="bezel-panel-label warn-alert"
                        style={{ fontSize: "9px", fontWeight: "900", letterSpacing: "0.15em" }}
                      >
                        {webMass > 1 ? `WEB MASS x${webMass}` : "WEB SNAGGED"}
                      </span>
                    </div>
                    <div
                      className="hud-struggle-bar-track"
                      style={{ width: "100px", height: "4px", marginTop: "2px" }}
                    >
                      <div
                        className="hud-struggle-bar-fill"
                        style={{
                          width: `${((escapeProgress / escapeRequired) * 100).toFixed(1)}%`
                        }}
                      />
                    </div>
                  </motion.div>
                ) : activeStep ? (
                  <motion.div
                    key={`step-${displayedStep}`}
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      {activeStep.renderKeys(
                        useWasd,
                        isLeftPressed,
                        isRightPressed,
                        isUpPressed,
                        isDownPressed
                      )}
                      <div
                        className={`led-dot ${activeLedClass}`}
                        style={{ width: "6px", height: "6px", marginLeft: "4px" }}
                      />
                    </div>
                    <span
                      className="bezel-panel-label"
                      style={{
                        color: stepSuccess ? "var(--signal-green)" : "var(--signal-yellow)",
                        fontSize: "9px"
                      }}
                    >
                      {stepSuccess ? activeStep.successTitle : activeStep.activeTitle}
                    </span>
                    <span
                      style={{
                        fontSize: "7.5px",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em"
                      }}
                    >
                      {activeStep.subtitle}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="completed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <span
                      className="warn-text"
                      style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, opacity: 0.85 }}
                      >
                        <line x1="12" y1="2" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <line x1="5" y1="5" x2="19" y2="19" />
                        <line x1="5" y1="19" x2="19" y2="5" />
                        <path d="M12,8 Q13.5,8.5 15,9.5 Q15.5,11 16,12 Q15.5,13 15,14.5 Q13.5,15.5 12,16 Q10.5,15.5 9,14.5 Q8.5,13 8,12 Q8.5,11 9,9.5 Q10.5,8.5 12,8 Z" />
                        <path d="M12,4 Q15.5,5 18,7 Q19,10.5 20,12 Q19,13.5 18,17 Q15.5,19 12,20 Q8.5,19 6,17 Q5,13.5 4,12 Q5,10.5 6,7 Q8.5,5 12,4 Z" />
                      </svg>
                      <span style={{ transform: "translateY(1px)" }}>SILK</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, opacity: 0.85 }}
                      >
                        <line x1="12" y1="2" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <line x1="5" y1="5" x2="19" y2="19" />
                        <line x1="5" y1="19" x2="19" y2="5" />
                        <path d="M12,8 Q13.5,8.5 15,9.5 Q15.5,11 16,12 Q15.5,13 15,14.5 Q13.5,15.5 12,16 Q10.5,15.5 9,14.5 Q8.5,13 8,12 Q8.5,11 9,9.5 Q10.5,8.5 12,8 Z" />
                        <path d="M12,4 Q15.5,5 18,7 Q19,10.5 20,12 Q19,13.5 18,17 Q15.5,19 12,20 Q8.5,19 6,17 Q5,13.5 4,12 Q5,10.5 6,7 Q8.5,5 12,4 Z" />
                      </svg>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="header-right flex flex-col items-end gap-1.5">
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--signal-red)",
                  fontSize: "13px",
                  fontWeight: "900",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase"
                }}
              >
                <Skull
                  size={13}
                  fill="var(--signal-red)"
                  style={{ color: "var(--signal-red)", flexShrink: 0 }}
                />{" "}
                BOSS
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
                  border: "1px solid rgba(0, 0, 0, 0.4)"
                }}
              >
                <div
                  className={weaverHp > 0 ? "led-red" : ""}
                  style={{
                    height: "100%",
                    borderRadius: "4px",
                    width: `${(weaverHpRatio * 100).toFixed(1)}%`,
                    transition: "width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2)"
                  }}
                />
              </div>
            </div>
          </div>

          <div className="hud-bottom">
            {!isWebTrapped && (
              <div
                className="hud-hint"
                style={{
                  opacity: traversalHintOpacity,
                  color: traversalHintColor
                }}
              >
                {traversalHint}
              </div>
            )}
          </div>

          <div className="cabinet-footer-panel">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "16px",
                width: "100%",
                height: "100%",
                justifyContent: "space-between"
              }}
            >
              <div
                className="neo-pressed"
                style={{
                  flexGrow: 1,
                  height: "22px",
                  borderRadius: "6px",
                  padding: "2px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  background: "#07080b",
                  border: "1px solid rgba(0, 0, 0, 0.45)",
                  position: "relative"
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "repeating-linear-gradient(90deg, transparent, transparent 4px, #07080b 4px, #07080b 6px)",
                    zIndex: 3,
                    pointerEvents: "none"
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    left: "42.7%",
                    width: "37.3%",
                    top: 0,
                    bottom: 0,
                    background: "rgba(234, 179, 8, 0.05)",
                    borderLeft: "1px solid rgba(234, 179, 8, 0.25)",
                    borderRight: "1px solid rgba(234, 179, 8, 0.25)",
                    zIndex: 1,
                    pointerEvents: "none"
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 4,
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "8px",
                    fontWeight: "900",
                    color: "rgba(255,255,255,0.22)"
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "5%",
                      color: "rgba(34,197,94,0.45)"
                    }}
                  >
                    1
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      left: "42.7%",
                      color: "rgba(234,179,8,0.45)"
                    }}
                  >
                    2
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      left: "80%",
                      color: "rgba(239,68,68,0.45)"
                    }}
                  >
                    3
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      right: "5%",
                      color: "rgba(239,68,68,0.75)"
                    }}
                  >
                    💀
                  </span>
                </div>

                <div
                  ref={tensionBarFillRef}
                  style={{
                    height: "100%",
                    borderRadius: "4px",
                    width: "0%",
                    zIndex: 2,
                    transition: "width 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.2)"
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "6px",
                  flexShrink: 0
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", gap: "6px" }}>
                  {[...Array(3)].map((_, idx) => {
                    const isDamaged = idx < tetherDamage;
                    return (
                      <div
                        key={idx}
                        className={`led-dot ${isDamaged ? "led-red" : "led-green"}`}
                        style={{
                          width: "12px",
                          height: "12px",
                          border: "1px solid rgba(0,0,0,0.55)",
                          transition: "all 0.15s ease"
                        }}
                      />
                    );
                  })}
                </div>
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
                      style={{
                        color: "var(--accent-danger)",
                        filter: "drop-shadow(0 0 10px rgba(239, 68, 68, 0.45))"
                      }}
                    />
                  ) : (
                    <Trophy
                      size={48}
                      className="victory-icon-anim"
                      style={{
                        color: "var(--accent-success)",
                        filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.45))"
                      }}
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
                    <span
                      key={`wins-${tickerWins}`}
                      className="gameover-stat-value gameover-stat-win led-spring-impact inline-block"
                    >
                      {tickerWins}
                    </span>
                  </div>
                  <div className="gameover-stat-row">
                    <span className="gameover-stat-label">TOTAL LOSSES</span>
                    <span
                      key={`losses-${tickerLosses}`}
                      className="gameover-stat-value gameover-stat-loss led-spring-impact inline-block"
                    >
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
                          ? overlayTitle === "DEFEATED"
                            ? "gameover-btn-defeat-focused"
                            : "gameover-btn-victory-focused"
                          : overlayTitle === "DEFEATED"
                            ? "gameover-btn-defeat-hover"
                            : "gameover-btn-victory-hover"
                      }`}
                    >
                      {menuIndex === 0 && (
                        <span className="gameover-inline-arrow" style={{ marginRight: "6px" }}>
                          ▶
                        </span>
                      )}
                      <RotateCcw size={16} className="flex-shrink-0" />
                      <span>RETRY</span>
                      {menuIndex === 0 && (
                        <span className="gameover-inline-arrow" style={{ marginLeft: "6px" }}>
                          ◀
                        </span>
                      )}
                    </button>

                    <button
                      onClick={handleClearStats}
                      onMouseEnter={() => {
                        setMenuIndex(1);
                        playTickSynth();
                        useCursorStore.getState().setCursorType("button");
                      }}
                      onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
                      className={`neo-btn gameover-btn ${
                        menuIndex === 1
                          ? overlayTitle === "DEFEATED"
                            ? "gameover-btn-defeat-focused"
                            : "gameover-btn-victory-focused"
                          : overlayTitle === "DEFEATED"
                            ? "gameover-btn-defeat-hover"
                            : "gameover-btn-victory-hover"
                      }`}
                    >
                      {menuIndex === 1 && (
                        <span className="gameover-inline-arrow" style={{ marginRight: "6px" }}>
                          ▶
                        </span>
                      )}
                      <Trash2 size={16} className="flex-shrink-0" />
                      <span>CLEAR</span>
                      {menuIndex === 1 && (
                        <span className="gameover-inline-arrow" style={{ marginLeft: "6px" }}>
                          ◀
                        </span>
                      )}
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
            <h1
              className="text-3xl font-black tracking-[0.25em] paused-title-glow"
              style={{ color: "var(--accent-tension)" }}
            >
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
