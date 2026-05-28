import { motion, AnimatePresence } from "framer-motion";
import { CursorType } from "./useCursorStore";
import { CURSOR_VARIANTS } from "./CursorVariants";

interface CursorLayerProps {
  cursorType: CursorType;
  isPressed: boolean;
}

export function CursorLayer({ cursorType, isPressed }: CursorLayerProps) {
  const variant = CURSOR_VARIANTS[cursorType];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <motion.div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0) 70%)",
          pointerEvents: "none",
          zIndex: 1
        }}
        animate={{
          width: variant.bubbleSize > 0 ? variant.bubbleSize + 16 : 0,
          height: variant.bubbleSize > 0 ? variant.bubbleSize + 16 : 0,
          x: "-50%",
          y: "-50%"
        }}
        transition={{ type: "spring", stiffness: 180, damping: 15 }}
      />

      <motion.div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          borderRadius: "50%",
          backgroundColor: variant.bubbleBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 2
        }}
        animate={{
          width: variant.bubbleSize,
          height: variant.bubbleSize,
          x: "-50%",
          y: "-50%"
        }}
        transition={{ type: "spring", stiffness: 180, damping: 15 }}
      >
        <AnimatePresence mode="wait">
          {cursorType === "text" && (
            <motion.div
              key="text-icon"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <svg width="20" height="20" viewBox="0 0 83 83" style={{ display: "block" }}>
                <path
                  fill="none"
                  stroke={variant.color}
                  strokeLinecap="round"
                  strokeWidth="6"
                  d="M43 71h11M43 12h11M25.5 71h11m-11-59h11m3.5 5v50"
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {variant.isBase && (
        <motion.div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            zIndex: 3,
            pointerEvents: "none",
            transformOrigin: "5.5px 3.2px"
          }}
          animate={{
            scale: isPressed ? 0.85 : 1,
            x: "-50%",
            y: "-50%"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <svg width="20" height="20" viewBox="0 0 100 100" style={{ display: "block" }}>
            <path
              d="M22.917,13.375l51.333,51.333l-19.03,-3.781l14.863,23.031l-8.833,8.834l-14.863,-23.032l-4.387,27.198l-19.083,-83.583Z"
              fill={variant.color}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="3"
            />
          </svg>
        </motion.div>
      )}
    </div>
  );
}
