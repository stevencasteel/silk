import { create } from "zustand";

export interface HudState {
  playerHp: number;
  playerMaxHp: number;
  currentState: string;
  traversalHint: string;
  traversalHintColor: string;
  traversalHintOpacity: number;
  overlayVisible: boolean;
  overlayTitle: string;
  overlayColor: string;
  overlaySubtitle: string;
  isPaused: boolean;
  bootStatus: string;

  setPlayerHp: (hp: number, maxHp: number) => void;
  setCurrentState: (state: string) => void;
  setTraversalHint: (text: string, color: string, opacity: number) => void;
  showOverlay: (title: string, color: string, subtitle: string) => void;
  hideOverlay: () => void;
  setPaused: (isPaused: boolean) => void;
  setBootStatus: (status: string) => void;
  reset: () => void;
}

export const useHudStore = create<HudState>((set) => ({
  playerHp: 5,
  playerMaxHp: 5,
  currentState: "AIRBORNE",
  traversalHint: "",
  traversalHintColor: "rgb(161, 161, 170)",
  traversalHintOpacity: 0,
  overlayVisible: false,
  overlayTitle: "VICTORY",
  overlayColor: "rgb(16, 185, 129)",
  overlaySubtitle: "The shaft is clear.",
  isPaused: false,
  bootStatus: "OFFLINE",

  setPlayerHp: (hp, maxHp) => set({ playerHp: hp, playerMaxHp: maxHp }),
  setCurrentState: (state) => set({ currentState: state }),
  setTraversalHint: (text, color, opacity) =>
    set({ traversalHint: text, traversalHintColor: color, traversalHintOpacity: opacity }),
  showOverlay: (title, color, subtitle) =>
    set({ overlayVisible: true, overlayTitle: title, overlayColor: color, overlaySubtitle: subtitle }),
  hideOverlay: () => set({ overlayVisible: false }),
  setPaused: (isPaused) => set({ isPaused }),
  setBootStatus: (status) => set({ bootStatus: status }),
  reset: () =>
    set({
      playerHp: 5,
      playerMaxHp: 5,
      currentState: "AIRBORNE",
      traversalHint: "",
      traversalHintOpacity: 0,
      overlayVisible: false,
      isPaused: false,
      bootStatus: "READY",
    }),
}));
