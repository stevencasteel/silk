import { create } from "zustand";

export type CursorType = "default" | "text" | "button" | "hidden";

interface CursorStore {
  cursorType: CursorType;
  setCursorType: (type: CursorType) => void;
}

export const useCursorStore = create<CursorStore>((set) => ({
  cursorType: "default",
  setCursorType: (type) => set({ cursorType: type })
}));
