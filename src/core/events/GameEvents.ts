export enum GameEvent {
  GAME_INITIALIZED          = "GAME_INITIALIZED",
  USER_GESTURE_REGISTERED   = "USER_GESTURE_REGISTERED",
  PLAYER_HEALTH_CHANGED     = "PLAYER_HEALTH_CHANGED",
  PLAYER_DAMAGED            = "PLAYER_DAMAGED",
  PLAYER_DIED               = "PLAYER_DIED",
  PLAYER_STATE_CHANGE       = "PLAYER_STATE_CHANGE",
  SILK_TENSION_CHANGE       = "SILK_TENSION_CHANGE",
  SILK_LENGTH_CHANGE        = "SILK_LENGTH_CHANGE",
  WEAVER_STATE_CHANGE       = "WEAVER_STATE_CHANGE",
  WEAVER_DAMAGED            = "WEAVER_DAMAGED",
  WEAVER_HEALTH_CHANGED     = "WEAVER_HEALTH_CHANGED",
  WEAVER_DIED               = "WEAVER_DIED",
  CAMERA_SHAKE_TRIGGERED    = "CAMERA_SHAKE_TRIGGERED",
  GAME_OVER                 = "GAME_OVER",
  GAME_WIN                  = "GAME_WIN",
  GAME_RESET                = "GAME_RESET"
}

export interface GameEventMap {
  [GameEvent.GAME_INITIALIZED]:        void;
  [GameEvent.USER_GESTURE_REGISTERED]: void;
  [GameEvent.PLAYER_HEALTH_CHANGED]:   { hp: number; maxHp: number };
  [GameEvent.PLAYER_DAMAGED]:          { amount: number; source: string };
  [GameEvent.PLAYER_DIED]:             void;
  [GameEvent.PLAYER_STATE_CHANGE]:     { state: string };
  [GameEvent.SILK_TENSION_CHANGE]:     { tension: number };
  [GameEvent.SILK_LENGTH_CHANGE]:      { length: number; maxLength: number };
  [GameEvent.WEAVER_STATE_CHANGE]:     { state: string; hue: string };
  [GameEvent.WEAVER_DAMAGED]:          { amount: number; source: string };
  [GameEvent.WEAVER_HEALTH_CHANGED]:   { hp: number; maxHp: number };
  [GameEvent.WEAVER_DIED]:             void;
  [GameEvent.CAMERA_SHAKE_TRIGGERED]:  { amplitude: number; duration: number };
  [GameEvent.GAME_OVER]:               void;
  [GameEvent.GAME_WIN]:                void;
  [GameEvent.GAME_RESET]:              void;
}
