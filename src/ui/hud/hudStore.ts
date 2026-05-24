import { create } from "zustand";

export interface HudState {
  playerHp: number;
  playerMaxHp: number;
  weaverHp: number;
  weaverMaxHp: number;
  weaverState: string;
  weaverHue: string;
  tension: number;
  currentState: string;
  traversalHint: string;
  traversalHintColor: string;
  traversalHintOpacity: number;
  overlayVisible: boolean;
  overlayTitle: string;
  overlayColor: string;
  overlaySubtitle: string;
  isPaused: boolean;

  setPlayerHp: (hp: number, maxHp: number) => void;
  setWeaverHp: (hp: number, maxHp: number) => void;
  setWeaverState: (state: string, hue: string) => void;
  setTension: (tension: number) => void;
  setCurrentState: (state: string) => void;
  setTraversalHint: (text: string, color: string, opacity: number) => void;
  showOverlay: (title: string, color: string, subtitle: string) => void;
  hideOverlay: () => void;
  setPaused: (isPaused: boolean) => void;
  reset: () => void;
}

export const useHudStore = create<HudState>((set) => ({
  playerHp: 5,
  playerMaxHp: 5,
  weaverHp: 100,
  weaverMaxHp: 100,
  weaverState: "SWEEPING",
  weaverHue: "rgb(239, 68, 68)",
  tension: 0.0,
  currentState: "AIRBORNE",
  traversalHint: "",
  traversalHintColor: "rgb(161, 161, 170)",
  traversalHintOpacity: 0,
  overlayVisible: false,
  overlayTitle: "VICTORY",
  overlayColor: "rgb(16, 185, 129)",
  overlaySubtitle: "The shaft is clear.",
  isPaused: false,

  setPlayerHp: (hp, maxHp) => set({ playerHp: hp, playerMaxHp: maxHp }),
  setWeaverHp: (hp, maxHp) => set({ weaverHp: hp, weaverMaxHp: maxHp }),
  setWeaverState: (state, hue) => set({ weaverState: state, weaverHue: hue }),
  setTension: (tension) => set({ tension }),
  setCurrentState: (state) => set({ currentState: state }),
  setTraversalHint: (text, color, opacity) =>
    set({ traversalHint: text, traversalHintColor: color, traversalHintOpacity: opacity }),
  showOverlay: (title, color, subtitle) =>
    set({ overlayVisible: true, overlayTitle: title, overlayColor: color, overlaySubtitle: subtitle }),
  hideOverlay: () => set({ overlayVisible: false }),
  setPaused: (isPaused) => set({ isPaused }),
  reset: () =>
    set({
      playerHp: 5,
      playerMaxHp: 5,
      weaverHp: 100,
      weaverMaxHp: 100,
      weaverState: "SWEEPING",
      weaverHue: "rgb(239, 68, 68)",
      tension: 0.0,
      currentState: "AIRBORNE",
      traversalHint: "",
      traversalHintOpacity: 0,
      overlayVisible: false,
      isPaused: false,
    }),
}));
