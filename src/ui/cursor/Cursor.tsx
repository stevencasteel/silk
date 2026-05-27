import { useEffect, useState } from "react";
import { useMotionValue, motion } from "framer-motion";
import { useCursorStore } from "./useCursorStore";
import { CursorLayer } from "./CursorLayer";
import { useOverlayStore } from "../hud/hudStore";

export function Cursor() {
  const cursorType = useCursorStore((state) => state.cursorType);
  const [isVisible, setIsVisible] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  const awaitingGesture = useOverlayStore((state) => state.awaitingGesture);
  const overlayVisible = useOverlayStore((state) => state.overlayVisible);
  const isPaused = useOverlayStore((state) => state.isPaused);
  const modalsOpen = awaitingGesture || overlayVisible || isPaused;

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handlePointerEnter = () => setIsVisible(true);
    const handlePointerLeave = () => setIsVisible(false);

    const handlePointerDown = () => setIsPressed(true);
    const handlePointerUp = () => setIsPressed(false);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerenter", handlePointerEnter);
    document.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerenter", handlePointerEnter);
      document.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [mouseX, mouseY, isVisible]);

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        x: mouseX,
        y: mouseY,
        translateX: "-50%",
        translateY: "-50%",
        width: 48,
        height: 48,
        pointerEvents: "none",
        zIndex: 99999,
      }}
      className="[@media(pointer:coarse)]:hidden"
      animate={{
        opacity: isVisible && modalsOpen && cursorType !== "hidden" ? 1 : 0,
      }}
      transition={{ duration: 0.25 }}
    >
      <CursorLayer cursorType={cursorType} isPressed={isPressed} />
    </motion.div>
  );
}
