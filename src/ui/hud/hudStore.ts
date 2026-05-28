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

  wins: number;
  losses: number;
  menuIndex: number;
  setMenuIndex: (index: number) => void;
  setStats: (wins: number, losses: number) => void;

  calibrationStep: number;
  setCalibrationStep: (step: number) => void;

  setBootStatus: (status: string) => void;
  setTraversalHint: (text: string, color: string, opacity: number) => void;
  showOverlay: (title: string, color: string, subtitle: string) => void;
  hideOverlay: () => void;
  setPaused: (isPaused: boolean) => void;
  setAwaitingGesture: (awaiting: boolean) => void;
  reset: () => void;
}

export interface InputStoreState {
  keysPressed: Record<string, boolean>;
  setKeyPressed: (key: string, pressed: boolean) => void;
  reset: () => void;
}

const PLAYER_RESET = { playerHp: 5, playerMaxHp: 5, currentState: "AIRBORNE" };
const WEAVER_RESET = {
  weaverHp: 100,
  weaverMaxHp: 100,
  weaverState: "SWEEPING",
  weaverHue: "rgb(239, 68, 68)"
};
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
  awaitingGesture: false,
  menuIndex: 0,
  calibrationStep: 0
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

export const useOverlayStore = create<OverlayState>((set) => ({
  ...OVERLAY_RESET,
  wins: 0,
  losses: 0,
  setBootStatus: (status) => set({ bootStatus: status }),
  setTraversalHint: (text, color, opacity) =>
    set({ traversalHint: text, traversalHintColor: color, traversalHintOpacity: opacity }),
  showOverlay: (title, color, subtitle) =>
    set({
      overlayVisible: true,
      overlayTitle: title,
      overlayColor: color,
      overlaySubtitle: subtitle
    }),
  hideOverlay: () => set({ overlayVisible: false }),
  setPaused: (isPaused) => set({ isPaused }),
  setAwaitingGesture: (awaiting) => set({ awaitingGesture: awaiting }),

  setMenuIndex: (index) => set({ menuIndex: index }),
  setStats: (wins, losses) => set({ wins, losses }),

  setCalibrationStep: (step) => set({ calibrationStep: step }),

  reset: () =>
    set((state) => ({
      ...OVERLAY_RESET,
      wins: state.wins,
      losses: state.losses
    }))
}));

export const useInputStore = create<InputStoreState>((set) => ({
  keysPressed: {},
  setKeyPressed: (key, pressed) =>
    set((state) => ({
      keysPressed: { ...state.keysPressed, [key]: pressed }
    })),
  reset: () => set({ keysPressed: {} })
}));

export function resetAllStores(): void {
  usePlayerStore.getState().reset();
  useWeaverStore.getState().reset();
  useOverlayStore.getState().reset();
  useInputStore.getState().reset();
}
