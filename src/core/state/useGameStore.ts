import { create } from "zustand";

interface UIState {
  isPaused: boolean;
  activeScreen: string;
  setPaused: (paused: boolean) => void;
  setScreen: (screen: string) => void;
}

export const useGameStore = create<UIState>((set) => ({
  isPaused: false,
  activeScreen: "ARENA",
  setPaused: (paused) => set({ isPaused: paused }),
  setScreen: (screen) => set({ activeScreen: screen }),
}));
