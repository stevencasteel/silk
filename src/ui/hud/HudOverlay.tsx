import React, { useEffect, useState, useCallback, useRef } from "react";
import { usePlayerStore, useWeaverStore, useOverlayStore, useInputStore } from "./hudStore";
import { useShallow } from "zustand/react/shallow";
import { Trophy, Skull, RotateCcw, Trash2, Heart, ShieldAlert, Cpu, Package, Layers, Loader2, Lock, Unlock, Check, Monitor, Download } from "lucide-react";
import { useCursorStore } from "../cursor/useCursorStore";
import { motion, AnimatePresence } from "framer-motion";
import { GameEvent } from "../../core/events/GameEvents";
import { VISUAL_JUICE_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import confetti from "canvas-confetti";

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
    successTitle: "STICK SUCCESSFUL!",
    activeTitle: "STICK TO WALL",
    subtitle: "",
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
  }
};

const LOADING_STEPS = [
  { id: 0, label: "Core Engine", sub: "Loading base systems and physics", icon: Cpu },
  { id: 1, label: "World Data", sub: "Initializing 3D arena and bounds", icon: Layers },
  { id: 2, label: "Game Entities", sub: "Spawning player and boss", icon: Package },
  { id: 3, label: "Render Pipeline", sub: "Compiling shaders and UI", icon: Monitor }
];

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

interface MenuButtonProps {
  isFocused: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  leftIcon: React.ReactNode;
  mainLabel: string;
  theme: "VICTORY" | "DEFEATED";
  style?: React.CSSProperties;
}

const MenuButton: React.FC<MenuButtonProps> = ({
  isFocused,
  onClick,
  onMouseEnter,
  leftIcon,
  mainLabel,
  theme,
  style
}) => {
  const isDefeat = theme === "DEFEATED";
  const activeColorClass = isDefeat ? "led-red" : "led-green";
  const focusBorderColor = isDefeat ? "border-red-500/80" : "border-emerald-500/80";
  const focusShadow = isDefeat
    ? "0 0 15px rgba(239, 68, 68, 0.15), inset 0 0 8px rgba(239, 68, 68, 0.1), 6px 6px 18px rgba(0, 0, 0, 0.95)"
    : "0 0 15px rgba(16, 185, 129, 0.15), inset 0 0 8px rgba(16, 185, 129, 0.1), 6px 6px 18px rgba(0, 0, 0, 0.95)";

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={isFocused ? { scale: 1.02 } : { scale: 1.0 }}
      transition={{ type: "spring", stiffness: 450, damping: 14 }}
      className={`flex items-center justify-start bg-[#0f1218] border border-white/[0.03] py-3.5 px-5 rounded-xl cursor-pointer outline-none transition-all duration-150 ${
        isFocused 
          ? `bg-[#0c0e12] ${focusBorderColor}` 
          : "hover:bg-[#141922] hover:border-white/[0.08]"
      }`}
      style={{
        ...style,
        boxShadow: isFocused ? focusShadow : "none"
      }}
    >
      <div 
        className={`w-2 h-2 rounded-full mr-4 border border-black/50 transition-all duration-150 flex-shrink-0 ${
          isFocused ? activeColorClass : "bg-[#1e2430]"
        }`}
      />

      <div className="flex items-center gap-2.5 flex-grow overflow-hidden select-none">
        <span className={`text-[12px] font-extrabold tracking-widest uppercase transition-colors duration-150 flex items-center gap-2.5 ${
          isFocused ? "text-white" : "text-zinc-400"
        }`}>
          {leftIcon}
          <span>{mainLabel}</span>
        </span>
      </div>
    </motion.button>
  );
};

export const HudOverlay: React.FC = () => {
  const [isWebBreaking, setIsWebBreaking] = useState<boolean>(false);

  useEffect(() => {
    const handleWebBreak = () => {
      setIsWebBreaking(true);
      const timer = setTimeout(() => {
        setIsWebBreaking(false);
      }, 1500);
      return () => clearTimeout(timer);
    };
    window.addEventListener("silk-web-break", handleWebBreak);
    return () => {
      window.removeEventListener("silk-web-break", handleWebBreak);
    };
  }, []);

  const playerState = usePlayerStore(
    useShallow((s) => ({
      playerHp: s.playerHp,
      isWebTrapped: s.isWebTrapped,
      tetherDamage: s.tetherDamage
    }))
  );
  const { playerHp, isWebTrapped, tetherDamage } = playerState;

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
      bootPhase: s.bootPhase,
      bootStatus: s.bootStatus,
      bootLogs: s.bootLogs,
      loadingProgress: s.loadingProgress,
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
    bootPhase,
    bootStatus,
    loadingProgress,
    menuIndex,
    setMenuIndex,
    calibrationStep,
    publishEvent
  } = overlayState;

  const [staggerPhase, setStaggerPhase] = useState<number>(0);
  useEffect(() => {
    if (staggerPhase === 3 && overlayVisible) {
      publishEvent(GameEvent.UI_SFX_REVEAL, undefined);
    }
  }, [staggerPhase, overlayVisible, publishEvent]);

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

  const handleClearStats = useCallback(() => {
    window.dispatchEvent(new CustomEvent("silk-clear-stats"));
    setTickerWins(0);
    setTickerLosses(0);
  }, []);

  const handleDownloadSource = useCallback(() => {
    playConfirmSynth();
    const link = document.createElement("a");
    link.href = "./silk_source_code.txt";
    link.download = "silk_source_code.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [playConfirmSynth]);

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
      const maxLength = detail.maxLength ?? GAMEPLAY_TUNING.REEL.MIN_LENGTH;

      const maxReelLimit = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
      const minReelLimit = GAMEPLAY_TUNING.REEL.MIN_LENGTH;

      const reelProgress = (maxLength - minReelLimit) / (maxReelLimit - minReelLimit);
      const barWidthPercent = Math.max(0.0, Math.min(100.0, reelProgress * 100.0));

      const uiConfig = VISUAL_JUICE_CONFIG.TETHER_UI;
      let color = `rgb(${uiConfig.COLOR_GREEN.r}, ${uiConfig.COLOR_GREEN.g}, ${uiConfig.COLOR_GREEN.b})`;
      let glow = `rgba(${uiConfig.GLOW_GREEN.r}, ${uiConfig.GLOW_GREEN.g}, ${uiConfig.GLOW_GREEN.b}, ${uiConfig.GLOW_GREEN.a})`;

      if (reelProgress >= uiConfig.THRESHOLD_RED) {
        color = `rgb(${uiConfig.COLOR_RED.r}, ${uiConfig.COLOR_RED.g}, ${uiConfig.COLOR_RED.b})`;
        glow = `rgba(${uiConfig.GLOW_RED.r}, ${uiConfig.GLOW_RED.g}, ${uiConfig.GLOW_RED.b}, ${uiConfig.GLOW_RED.a})`;
      } else if (reelProgress >= uiConfig.THRESHOLD_YELLOW) {
        color = `rgb(${uiConfig.COLOR_YELLOW.r}, ${uiConfig.COLOR_YELLOW.g}, ${uiConfig.COLOR_YELLOW.b})`;
        glow = `rgba(${uiConfig.GLOW_YELLOW.r}, ${uiConfig.GLOW_YELLOW.g}, ${uiConfig.GLOW_YELLOW.b}, ${uiConfig.GLOW_YELLOW.a})`;
      }

      if (tensionBarFillRef.current) {
        tensionBarFillRef.current.style.width = `${barWidthPercent.toFixed(1)}%`;
        tensionBarFillRef.current.style.background = color;

        if (tension > uiConfig.MIN_TENSION_FOR_EFFECTS) {
          const pulse = 1.0 + Math.sin(performance.now() * uiConfig.PULSE_FREQ * tension) * uiConfig.PULSE_AMP;
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

  const handleProceed = useCallback(() => {
    const isFullyLoaded = bootStatus === "READY" && awaitingGesture;
    if (!isFullyLoaded) {
      return;
    }

    playConfirmSynth();
    publishEvent(GameEvent.USER_GESTURE_REGISTERED, undefined);
    useOverlayStore.getState().setAwaitingGesture(false);
    useOverlayStore.getState().setBootStatus("READY");

    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.focus();
    }
  }, [bootStatus, awaitingGesture, playConfirmSynth, publishEvent]);

  useEffect(() => {
    if (bootStatus === "READY" && awaitingGesture) {
      const handleStartOnKey = (e: KeyboardEvent) => {
        if (e.key === " " || e.key === "Enter" || e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          handleProceed();
        }
      };
      window.addEventListener("keydown", handleStartOnKey);
      return () => window.removeEventListener("keydown", handleStartOnKey);
    }
  }, [bootStatus, awaitingGesture, handleProceed]);

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
        setMenuIndex((menuIndex - 1 + 4) % 4);
      } else if (isMoveRight || isMoveDown) {
        e.preventDefault();
        playTickSynth();
        setMenuIndex((menuIndex + 1) % 4);
      } else if (code === "Enter") {
        e.preventDefault();
        playConfirmSynth();
        if (menuIndex === 0) {
          handleProceed();
          handleRetryClick();
        } else if (menuIndex === 1) {
          handleClearStats();
        } else if (menuIndex === 2) {
          window.open("https://github.com/stevencasteel/silk", "_blank");
        } else if (menuIndex === 3) {
          handleDownloadSource();
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
    handleClearStats,
    handleProceed,
    handleDownloadSource
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
    if (!overlayVisible) return;

    let cleanupFn: (() => void) | undefined = undefined;
    const confettiCanvas = document.getElementById("confetti-canvas") as HTMLCanvasElement | null;
    
    if (confettiCanvas) {
      const myConfetti = confetti.create(confettiCanvas, { resize: true, useWorker: true });

      if (overlayTitle === "VICTORY") {
        const fireConfetti = () => {
          myConfetti({
            particleCount: 360,
            spread: 80,
            origin: { y: 0.55, x: 0.5 },
            colors: ["#10b981", "#34d399", "#a7f3d0", "#ffffff"]
          });
          myConfetti({
            particleCount: 200,
            spread: 45,
            angle: 135,
            origin: { y: 0.55, x: 0.5 },
            colors: ["#10b981", "#34d399", "#a7f3d0", "#ffffff"]
          });
          myConfetti({
            particleCount: 200,
            spread: 45,
            angle: 45,
            origin: { y: 0.55, x: 0.5 },
            colors: ["#10b981", "#34d399", "#a7f3d0", "#ffffff"]
          });
        };

        fireConfetti();
        const intervalId = setInterval(fireConfetti, 3000);

        let rainIndex = 0;
        const NUM_LANES = 8;
        const victoryColors = ["#10b981", "#34d399", "#a7f3d0", "#ffffff"];
        const rainIntervalId = setInterval(() => {
          for (let k = 0; k < 24; k++) {
            const currentLane = (rainIndex + k) % NUM_LANES;
            const xCoord = (currentLane / (NUM_LANES - 1)) * 0.45 + 0.275 + (Math.random() - 0.5) * 0.05;
            const randomColor = victoryColors[Math.floor(Math.random() * victoryColors.length)];
            myConfetti({
              particleCount: 1,
              angle: 270 + (Math.random() - 0.5) * 10,
              spread: 15,
              startVelocity: 14 + Math.random() * 8,
              decay: 0.95,
              gravity: 0.85,
              origin: {
                y: 0.55,
                x: Math.max(0.01, Math.min(0.99, xCoord))
              },
              colors: [randomColor]
            });
          }
          rainIndex = (rainIndex + 1) % 8;
        }, 120);

        cleanupFn = () => {
          clearInterval(intervalId);
          clearInterval(rainIntervalId);
          myConfetti.reset();
        };

      } else if (overlayTitle === "DEFEATED") {
        let laneIndex = 0;
        const NUM_LANES = 8;
        const defeatColors = ["#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d"];
        
        const intervalId = setInterval(() => {
          for (let k = 0; k < 30; k++) {
            const currentLane = (laneIndex + k) % NUM_LANES;
            const xCoord = (currentLane / (NUM_LANES - 1)) * 0.9 + 0.05 + (Math.random() - 0.5) * 0.05;
            const randomColor = defeatColors[Math.floor(Math.random() * defeatColors.length)];
            
            myConfetti({
              particleCount: 1,
              angle: 270 + (Math.random() - 0.5) * 10,
              spread: 15,
              startVelocity: 14 + Math.random() * 8,
              decay: 0.95,
              gravity: 0.85,
              scalar: 0.65 + Math.random() * 0.3,
              origin: { 
                y: -0.15,
                x: Math.max(0.01, Math.min(0.99, xCoord)) 
              },
              colors: [randomColor]
            });
          }
          laneIndex = (laneIndex + 3) % NUM_LANES;
        }, 120);

        cleanupFn = () => {
          clearInterval(intervalId);
          myConfetti.reset();
        };
      }
    }
    
    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [overlayVisible, overlayTitle]);

  const isBooting = bootStatus !== "READY" && !awaitingGesture;
  const showBootScreen = bootStatus !== "READY" || awaitingGesture;
  const isFullyLoaded = bootStatus === "READY" && awaitingGesture;
  const isFinished = isFullyLoaded || bootStatus === "READY";
  const currentLoadingStep = Math.min(bootPhase, 3);
  const weaverHpRatio = Math.max(0, weaverHp / weaverMaxHp);
  const isCriticalHp = playerHp === 1 && !overlayVisible;

  const activeLedClass = stepSuccess
    ? "led-green led-elastic-spring"
    : "led-yellow led-spring-impact";
  const activeStep = CALIBRATION_STEPS[displayedStep];

  return (
    <>
      {showBootScreen ? (
        <div className="overlay-root backdrop-blur-active font-mono pointer-events-auto flex flex-col justify-between items-center p-6 sm:p-8">
          
          <div className="w-full max-w-sm flex flex-col items-center text-center mt-4">
            <div className="p-4 rounded-xl border border-white/5 bg-[#0c0e12]/60 backdrop-blur-sm shadow-lg">
              <p className="text-[10px] sm:text-xs text-zinc-400 tracking-wide leading-relaxed select-none">
                A game about being tethered to something dangerous{" "}
                <span className="font-bold italic" style={{ color: "var(--signal-green)" }}>with a mind of its own</span>, where the tension between you and the thing trying to kill you is literally your only weapon.
              </p>
            </div>
            
            <div className="mt-4 p-4 rounded-xl border border-white/[0.03] bg-[#07080b]/50 backdrop-blur-sm flex flex-col items-center justify-center w-full select-none">
              <div className="flex items-center justify-center gap-3">
                <motion.span
                  animate={isLeftPressed ? { scale: 0.85 } : { scale: 1 }}
                  className={`keycap-box-large ${isLeftPressed ? "keycap-used" : ""}`}
                >
                  {useWasd ? "A" : "◀"}
                </motion.span>
                <motion.span
                  animate={isUpPressed ? { scale: 0.85 } : { scale: 1 }}
                  className={`keycap-box-large ${isUpPressed ? "keycap-used" : ""}`}
                >
                  {useWasd ? "W" : "▲"}
                </motion.span>
                <motion.span
                  animate={isRightPressed ? { scale: 0.85 } : { scale: 1 }}
                  className={`keycap-box-large ${isRightPressed ? "keycap-used" : ""}`}
                >
                  {useWasd ? "D" : "▶"}
                </motion.span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm flex flex-col gap-4 my-6 p-6 rounded-2xl bg-[#0c0e12] border border-white/5 shadow-2xl"
               style={{ boxShadow: "-8px -8px 24px rgba(255,255,255,0.02), 12px 12px 36px rgba(0,0,0,0.85)" }}>
            <h2 className="text-zinc-500 font-bold uppercase tracking-[0.25em] text-[10px] text-center select-none">
              INITIALIZING CORE SYSTEMS
            </h2>

            <div className="flex flex-col gap-4">
              {LOADING_STEPS.map((step) => {
                const isCompleted = isFinished || step.id < currentLoadingStep;
                const isActive = !isFinished && step.id === currentLoadingStep;
                const StepIcon = step.icon;

                return (
                  <div key={step.id} className={`flex items-center gap-3 transition-all duration-300 ${isActive ? "opacity-100 scale-102" : isCompleted ? "opacity-45" : "opacity-25"}`}>
                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-300 ${
                      isActive 
                        ? "bg-[#141820] border-emerald-500/30 text-emerald-500 shadow-inner" 
                        : isCompleted 
                          ? "bg-[#07080b] border-emerald-500/10 text-emerald-500" 
                          : "bg-[#07080b] border-zinc-800 text-zinc-600"
                    }`}
                    style={isActive ? { boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.5), 0 0 10px rgba(16,185,129,0.1)" } : {}}>
                      
                      <div className="relative w-4 h-4 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          {isActive ? (
                            <motion.div
                              key="spinning-loader"
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="text-emerald-500"
                            >
                              <Loader2 size={16} className="animate-spin" />
                            </motion.div>
                          ) : isCompleted ? (
                            <div className="relative w-4 h-4 flex items-center justify-center">
                              <motion.div
                                key="checkmark-swish"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                  scale: [0, 1.3, 1.3, 0],
                                  opacity: [0, 1, 1, 0]
                                }}
                                transition={{
                                  duration: 1.8,
                                  times: [0, 0.22, 0.78, 1.0],
                                  ease: "easeInOut"
                                }}
                                className="absolute text-emerald-400"
                              >
                                <Check size={16} className="stroke-[3]" />
                              </motion.div>
                              <motion.div
                                key="revealed-icon"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                  scale: [0, 0, 1],
                                  opacity: [0, 0, 1]
                                }}
                                transition={{
                                  duration: 1.8,
                                  times: [0, 0.78, 1.0],
                                  ease: "easeInOut"
                                }}
                                className="text-emerald-500"
                              >
                                <StepIcon size={14} />
                              </motion.div>
                            </div>
                          ) : (
                            <motion.div
                              key="idle-icon"
                              className="text-zinc-600"
                            >
                              <StepIcon size={14} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {isActive && (
                        <div className="absolute -top-1 -right-1 flex items-center justify-center w-2.5 h-2.5">
                          <div className="absolute w-full h-full rounded-full bg-emerald-500 animate-ping opacity-75" />
                          <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-500 border border-[#0c0e12]" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={`text-[9px] font-black tracking-wider ${isActive ? "text-emerald-500" : isCompleted ? "text-zinc-400" : "text-zinc-600"}`}>
                        {step.label}
                      </div>
                      <div className="text-[8px] text-zinc-500 tracking-normal truncate">
                        {isActive ? bootStatus : step.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative w-full h-2 rounded-full bg-[#07080b] border border-white/[0.02] p-0.5 overflow-hidden shadow-inner mt-2">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={{ width: "0%" }}
                animate={{ width: `${isFinished ? 100 : Math.round(loadingProgress * 100)}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 15 }}
                style={{
                  boxShadow: "0 0 8px rgba(16,185,129,0.5)"
                }}
              />
            </div>
            
            <div className="text-[7.5px] text-zinc-600 tracking-wider text-right font-bold uppercase select-none">
              PROGRESS: {isFinished ? 100 : Math.round(loadingProgress * 100)}%
            </div>
          </div>

          <div className="w-full max-w-sm mb-6 px-2">
            {isFullyLoaded ? (
              <motion.button
                onClick={handleProceed}
                onMouseEnter={() => useCursorStore.getState().setCursorType("button")}
                onMouseLeave={() => useCursorStore.getState().setCursorType("default")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="gameover-btn gameover-btn-victory-focused pointer-events-auto w-full flex items-center justify-center gap-3 py-4 rounded-xl cursor-pointer border border-emerald-500/30"
              >
                <Unlock size={14} className="text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-black tracking-[0.15em]">PROCEED TO SHAFT</span>
              </motion.button>
            ) : (
              <button
                disabled
                className="gameover-btn pointer-events-none opacity-40 w-full flex items-center justify-center gap-3 py-4 rounded-xl border border-zinc-800/80 bg-[#07080b] text-zinc-500"
              >
                <Lock size={14} className="text-zinc-600" />
                <span className="text-[11px] font-black tracking-[0.15em] text-zinc-600">
                  BOOTING PROTOCOLS...
                </span>
              </button>
            )}
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
                {(isWebTrapped || isWebBreaking) ? (
                  (() => {
                    const webColor = isWebBreaking ? "rgba(34, 197, 94, 1)" : "rgba(239, 68, 68, 1)";
                    const webGlow = isWebBreaking ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)";
                    const webBorder = isWebBreaking ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)";
                    const webLedClass = isWebBreaking ? "led-green led-elastic-spring" : "led-red";
                    const webText = isWebBreaking ? "BROKEN FREE!" : "BREAK FREE!";

                    return (
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
                          gap: "2px",
                          padding: "2px 10px",
                          borderRadius: "6px",
                          border: `1.5px solid ${webBorder}`,
                          background: "rgba(7, 8, 11, 0.92)",
                          boxShadow: `0 0 8px ${webGlow}`,
                          textShadow: `0 0 5px ${webGlow}`
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
                            className={`led-dot ${webLedClass}`}
                            style={{ width: "6px", height: "6px", marginLeft: "4px" }}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <ShieldAlert
                            size={10}
                            style={{ color: webColor, flexShrink: 0 }}
                            className="animate-pulse"
                          />
                          <span
                            className="bezel-panel-label warn-alert"
                            style={{ fontSize: "9px", fontWeight: "950", letterSpacing: "0.12em", color: webColor }}
                          >
                            {webText}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })()
                ) : activeStep ? (
                  (() => {
                    const activeColor = stepSuccess ? "rgba(34, 197, 94, 1)" : "rgba(234, 179, 8, 1)";
                    const activeGlow = stepSuccess ? "rgba(34, 197, 94, 0.3)" : "rgba(234, 179, 8, 0.3)";
                    const activeBorder = stepSuccess ? "rgba(34, 197, 94, 0.45)" : "rgba(234, 179, 8, 0.45)";

                    return (
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
                          gap: "2px",
                          padding: "2px 10px",
                          borderRadius: "6px",
                          border: `1.5px solid ${activeBorder}`,
                          background: "rgba(7, 8, 11, 0.92)",
                          boxShadow: `0 0 8px ${activeGlow}`,
                          textShadow: `0 0 5px ${activeGlow}`
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
                            color: activeColor,
                            fontSize: "9px",
                            fontWeight: "900",
                            letterSpacing: "0.12em"
                          }}
                        >
                          {stepSuccess ? activeStep.successTitle : activeStep.activeTitle}
                        </span>
                        {activeStep.subtitle && (
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
                        )}
                      </motion.div>
                    );
                  })()
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
                    background: "rgba(234, 179, 8, 0.02)",
                    borderLeft: "2px dashed rgba(234, 179, 8, 0.38)",
                    borderRight: "2px dashed rgba(239, 68, 68, 0.38)",
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
                    fontSize: "11px",
                    fontWeight: "950",
                    letterSpacing: "normal"
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "21.35%",
                      transform: "translateX(-50%)",
                      color: "rgba(16, 185, 129, 0.65)"
                    }}
                  >
                    1
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      left: "61.35%",
                      transform: "translateX(-50%)",
                      color: "rgba(234, 179, 8, 0.65)"
                    }}
                  >
                    2
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      left: "90.0%",
                      transform: "translateX(-50%)",
                      color: "rgba(239, 68, 68, 0.65)"
                    }}
                  >
                    3
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      right: "6px",
                      color: "rgba(239, 68, 68, 0.85)",
                      fontSize: "13px"
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
          <div className="overlay-root backdrop-wipe-active pointer-events-auto overflow-hidden flex flex-col justify-center items-center gap-4">
            <canvas id="confetti-canvas" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }} />
            
            <motion.div
              layout
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className={`overlay-modal relative z-10 ${overlayTitle === "DEFEATED" ? "defeat-border" : "victory-border"}`}
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
                    <motion.div className="victory-icon-anim">
                      <Trophy
                        size={48}
                        className="trophy-shake-loop"
                        style={{
                          color: "var(--accent-success)",
                          filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.45))"
                        }}
                      />
                    </motion.div>
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
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="gameover-divider"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="gameover-btn-container w-full"
                  >
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
                  </motion.div>
                </>
              )}
            </motion.div>

            {staggerPhase >= 3 && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 15 }}
                transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.1 }}
                className={`overlay-modal relative z-10 !p-3 sm:!p-4 ${overlayTitle === "DEFEATED" ? "defeat-border" : "victory-border"}`}
              >
                <div className="gameover-btn-container w-full flex flex-row gap-4">
                  <MenuButton
                    isFocused={menuIndex === 2}
                    onClick={() => window.open("https://github.com/stevencasteel/silk", "_blank")}
                    onMouseEnter={() => {
                      setMenuIndex(2);
                      playTickSynth();
                      useCursorStore.getState().setCursorType("button");
                    }}
                    leftIcon={<GithubIcon />}
                    mainLabel="GITHUB"
                    theme={overlayTitle as "VICTORY" | "DEFEATED"}
                    style={{ flex: "0 0 calc(44% - 8px)" }}
                  />

                  <MenuButton
                    isFocused={menuIndex === 3}
                    onClick={handleDownloadSource}
                    onMouseEnter={() => {
                      setMenuIndex(3);
                      playTickSynth();
                      useCursorStore.getState().setCursorType("button");
                    }}
                    leftIcon={<Download size={14} strokeWidth={2.5} />}
                    mainLabel="DOWNLOAD .TXT"
                    theme={overlayTitle as "VICTORY" | "DEFEATED"}
                    style={{ flex: "0 0 calc(56% - 8px)" }}
                  />
                </div>
              </motion.div>
            )}
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
