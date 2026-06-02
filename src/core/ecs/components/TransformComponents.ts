export interface TransformComponent {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  prevQx: number;
  prevQy: number;
  prevQz: number;
  prevQw: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  prevScaleX?: number;
  prevScaleY?: number;
  prevScaleZ?: number;
  scaleVelX?: number;
  scaleVelY?: number;
  scaleVelZ?: number;
}

export interface ActorCosmeticComponent {
  emissiveR?: number;
  emissiveG?: number;
  emissiveB?: number;
  emissiveHue?: string;
  targetScaleX: number;
  targetScaleY: number;
  targetScaleZ: number;
  springStiffness: number;
  springDamping: number;
  rotationAngle: number;
  slerpFactor?: number;
  rotationVel?: number;
  currentRotation?: number;
  visualOffsetY?: number;
  visualOffsetVelocityY?: number;
  wobbleAngle?: number;
  currentWobble?: number;
  wobbleVel?: number;
  currentRoll?: number;
  rollVel?: number;
  rotationSpeed?: number;
  gaitAmplitude?: number;
  gaitFrequency?: number;
  gaitTuck?: number;
  hitFlashTimer?: number;
}
