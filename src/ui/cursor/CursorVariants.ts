import { CursorType } from "./useCursorStore";

export interface CursorVariantConfig {
  blendMode: "normal" | "difference" | "exclusion";
  color: string;
  isBase: boolean;
  bubbleSize: number;
  bubbleBg: string;
}

export const CURSOR_VARIANTS: Record<CursorType, CursorVariantConfig> = {
  default: {
    blendMode: "normal",
    color: "#10b981",
    isBase: true,
    bubbleSize: 0,
    bubbleBg: "transparent",
  },
  button: {
    blendMode: "normal",
    color: "#10b981",
    isBase: true,
    bubbleSize: 0,
    bubbleBg: "transparent",
  },
  text: {
    blendMode: "normal",
    color: "#10b981",
    isBase: false,
    bubbleSize: 32,
    bubbleBg: "transparent",
  },
  hidden: {
    blendMode: "normal",
    color: "transparent",
    isBase: false,
    bubbleSize: 0,
    bubbleBg: "transparent",
  },
};
