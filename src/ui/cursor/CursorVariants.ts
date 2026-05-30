import { CursorType } from "./useCursorStore";

export interface CursorVariantConfig {
  color: string;
  isBase: boolean;
  bubbleSize: number;
  bubbleBg: string;
}

export const CURSOR_VARIANTS: Record<CursorType, CursorVariantConfig> = {
  default: {
    color: "#10b981",
    isBase: true,
    bubbleSize: 0,
    bubbleBg: "transparent"
  },
  button: {
    color: "#10b981",
    isBase: true,
    bubbleSize: 0,
    bubbleBg: "transparent"
  },
  text: {
    color: "#10b981",
    isBase: false,
    bubbleSize: 32,
    bubbleBg: "transparent"
  },
  hidden: {
    color: "transparent",
    isBase: false,
    bubbleSize: 0,
    bubbleBg: "transparent"
  }
};
