import { IParticleEmitterStrategy } from "../../../gameplay/juice/ParticleStrategies";

export interface ParticleRequestComponent {
  strategy: IParticleEmitterStrategy;
  x: number;
  y: number;
  z: number;
}
