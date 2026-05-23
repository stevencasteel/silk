export enum GameEvent {
  GAME_INITIALIZED          = "GAME_INITIALIZED",
  USER_GESTURE_REGISTERED   = "USER_GESTURE_REGISTERED",
  PLAYER_MOVE               = "PLAYER_MOVE",
  PLAYER_HEALTH_CHANGED     = "PLAYER_HEALTH_CHANGED",
  PLAYER_VELOCITY_CHANGED   = "PLAYER_VELOCITY_CHANGED",
  PLAYER_DAMAGED            = "PLAYER_DAMAGED",
  PLAYER_DIED               = "PLAYER_DIED",
  PLAYER_STATE_CHANGE       = "PLAYER_STATE_CHANGE",
  ROPE_TENSION_CHANGE       = "ROPE_TENSION_CHANGE",
  ROPE_LENGTH_CHANGE        = "ROPE_LENGTH_CHANGE",
  WARDEN_STATE_CHANGE       = "WARDEN_STATE_CHANGE",
  WARDEN_DAMAGED            = "WARDEN_DAMAGED",
  WARDEN_HEALTH_CHANGED     = "WARDEN_HEALTH_CHANGED",
  WARDEN_DIED               = "WARDEN_DIED",
  CAMERA_SHAKE_TRIGGERED    = "CAMERA_SHAKE_TRIGGERED",
  GAME_OVER                 = "GAME_OVER",
  GAME_WIN                  = "GAME_WIN",
  GAME_RESET                = "GAME_RESET"
}

export interface GameEventMap {
  [GameEvent.GAME_INITIALIZED]:        void;
  [GameEvent.USER_GESTURE_REGISTERED]: void;
  [GameEvent.PLAYER_MOVE]:             { x: number; y: number; z: number };
  [GameEvent.PLAYER_HEALTH_CHANGED]:   { hp: number; maxHp: number };
  [GameEvent.PLAYER_VELOCITY_CHANGED]: { velocity: number; maxVelocity: number };
  [GameEvent.PLAYER_DAMAGED]:          { amount: number; source: string };
  [GameEvent.PLAYER_DIED]:             void;
  [GameEvent.PLAYER_STATE_CHANGE]:     { state: string };
  [GameEvent.ROPE_TENSION_CHANGE]:     { tension: number };
  [GameEvent.ROPE_LENGTH_CHANGE]:      { length: number; maxLength: number };
  [GameEvent.WARDEN_STATE_CHANGE]:     { state: string; hue: string };
  [GameEvent.WARDEN_DAMAGED]:          { amount: number; source: string };
  [GameEvent.WARDEN_HEALTH_CHANGED]:   { hp: number; maxHp: number };
  [GameEvent.WARDEN_DIED]:             void;
  [GameEvent.CAMERA_SHAKE_TRIGGERED]:  { amplitude: number; duration: number };
  [GameEvent.GAME_OVER]:               void;
  [GameEvent.GAME_WIN]:                void;
  [GameEvent.GAME_RESET]:              void;
}
