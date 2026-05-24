export enum SystemPhase {
  Input = 0,
  Intents = 1,
  Kinematics = 2,
  Collision = 3,
  PhysicsStep = 4,
  Gameplay = 5,
  RenderSync = 6,
  PostRender = 7
}

export enum InitPhase {
  Bootstrap = 0,
  World = 1,
  Gameplay = 2,
  UI = 3
}
