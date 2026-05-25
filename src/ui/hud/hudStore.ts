import { create } from "zustand";

export interface PlayerState {
  playerHp: number;
  playerMaxHp: number;
  currentState: string;
  setPlayerHp: (hp: number, maxHp: number) => void;
  setCurrentState: (state: string) => void;
  reset: () => void;
}

export interface WeaverState {
  weaverHp: number;
  weaverMaxHp: number;
  weaverState: string;
  weaverHue: string;
  setWeaverHealth: (hp: number, maxHp: number) => void;
  setWeaverState: (state: string, hue: string) => void;
  reset: () => void;
}

export interface TetherState {
  tetherTension: number;
  setTetherTension: (tension: number) => void;
  reset: () => void;
}

export interface OverlayState {
  bootStatus: string;
  traversalHint: string;
  traversalHintColor: string;
  traversalHintOpacity: number;
  overlayVisible: boolean;
  overlayTitle: string;
  overlayColor: string;
  overlaySubtitle: string;
  isPaused: boolean;
  awaitingGesture: boolean;
  setBootStatus: (status: string) => void;
  setTraversalHint: (text: string, color: string, opacity: number) => void;
  showOverlay: (title: string, color: string, subtitle: string) => void;
  hideOverlay: () => void;
  setPaused: (isPaused: boolean) => void;
  setAwaitingGesture: (awaiting: boolean) => void;
  reset: () => void;
}

const PLAYER_RESET = { playerHp: 5, playerMaxHp: 5, currentState: "AIRBORNE" };
const WEAVER_RESET = { weaverHp: 100, weaverMaxHp: 100, weaverState: "SWEEPING", weaverHue: "rgb(239, 68, 68)" };
const TETHER_RESET = { tetherTension: 0.0 };
const OVERLAY_RESET = {
  bootStatus: "READY",
  traversalHint: "",
  traversalHintColor: "rgb(161, 161, 170)",
  traversalHintOpacity: 0,
  overlayVisible: false,
  overlayTitle: "VICTORY",
  overlayColor: "rgb(16, 185, 129)",
  overlaySubtitle: "The shaft is clear.",
  isPaused: false,
  awaitingGesture: false
};

export const usePlayerStore = create<PlayerState>((set) => ({
  ...PLAYER_RESET,
  setPlayerHp: (hp, maxHp) => set({ playerHp: hp, playerMaxHp: maxHp }),
  setCurrentState: (state) => set({ currentState: state }),
  reset: () => set(PLAYER_RESET)
}));

export const useWeaverStore = create<WeaverState>((set) => ({
  ...WEAVER_RESET,
  setWeaverHealth: (hp, maxHp) => set({ weaverHp: hp, weaverMaxHp: maxHp }),
  setWeaverState: (state, hue) => set({ weaverState: state, weaverHue: hue }),
  reset: () => set(WEAVER_RESET)
}));

export const useTetherStore = create<TetherState>((set) => ({
  ...TETHER_RESET,
  setTetherTension: (tension) => set({ tetherTension: tension }),
  reset: () => set(TETHER_RESET)
}));

export const useOverlayStore = create<OverlayState>((set) => ({
  ...OVERLAY_RESET,
  setBootStatus: (status) => set({ bootStatus: status }),
  setTraversalHint: (text, color, opacity) =>
    set({ traversalHint: text, traversalHintColor: color, traversalHintOpacity: opacity }),
  showOverlay: (title, color, subtitle) =>
    set({ overlayVisible: true, overlayTitle: title, overlayColor: color, overlaySubtitle: subtitle }),
  hideOverlay: () => set({ overlayVisible: false }),
  setPaused: (isPaused) => set({ isPaused }),
  setAwaitingGesture: (awaiting) => set({ awaitingGesture: awaiting }),
  reset: () => set(OVERLAY_RESET)
}));

export function resetAllStores(): void {
  usePlayerStore.getState().reset();
  useWeaverStore.getState().reset();
  useTetherStore.getState().reset();
  useOverlayStore.getState().reset();
}
