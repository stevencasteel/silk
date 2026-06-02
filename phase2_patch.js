import fs from 'fs';

// 1. TransformComponents.ts - Add hitFlashTimer to ActorCosmeticComponent
let transComponents = fs.readFileSync('src/core/ecs/components/TransformComponents.ts', 'utf8');
transComponents = transComponents.replace(
  '  gaitTuck?: number;\n}',
  '  gaitTuck?: number;\n  hitFlashTimer?: number;\n}'
);
fs.writeFileSync('src/core/ecs/components/TransformComponents.ts', transComponents);

// 2. HealthSystem.ts - Import ActorCosmeticComponent and set hitFlashTimer on damage
let healthContent = fs.readFileSync('src/gameplay/combat/HealthSystem.ts', 'utf8');
healthContent = healthContent.replace(
  '  TransformComponent,\n  ParticleRequestComponent',
  '  TransformComponent,\n  ParticleRequestComponent,\n  ActorCosmeticComponent'
);

const playerDmgFlashLogic = `
      health.current = Math.max(0, health.current - cmd.amount);

      // Arcade Hit-Flash
      const cosmetics = this.context.stores.get<ActorCosmeticComponent>("cosmetic");
      const cosmetic = cosmetics.get(cmd.targetId);
      if (cosmetic && cmd.amount > 0) {
        cosmetic.hitFlashTimer = 0.06;
      }
`;
healthContent = healthContent.replace(
  '      health.current = Math.max(0, health.current - cmd.amount);',
  playerDmgFlashLogic.trim()
);

const weaverDmgFlashLogic = `
      health.current = Math.max(0, health.current - cmd.amount);

      // Arcade Hit-Flash
      const cosmetics = this.context.stores.get<ActorCosmeticComponent>("cosmetic");
      const cosmetic = cosmetics.get(cmd.targetId);
      if (cosmetic && cmd.amount > 0) {
        cosmetic.hitFlashTimer = 0.06;
      }
`;
healthContent = healthContent.replace(
  '      health.current = Math.max(0, health.current - cmd.amount);',
  weaverDmgFlashLogic.trim()
);
fs.writeFileSync('src/gameplay/combat/HealthSystem.ts', healthContent);

// 3. ParticleStrategies.ts - Add MuzzleFlashStrategy
let strategiesContent = fs.readFileSync('src/gameplay/juice/ParticleStrategies', 'utf8');
if (!strategiesContent) {
  strategiesContent = fs.readFileSync('src/gameplay/juice/ParticleStrategies.ts', 'utf8');
}

const muzzleFlashStrategyClass = `
export class MuzzleFlashStrategy implements IParticleEmitterStrategy {
  constructor(private dirX: number, private dirY: number) {}

  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const color = new BABYLON.Color3(0.9, 0.95, 1.0);
    const tempVel = new BABYLON.Vector3();
    const count = 15;

    for (let i = 0; i < count; i++) {
      const angleOffset = (Math.random() - 0.5) * 0.6;
      const speed = 14.0 + Math.random() * 12.0;
      
      const cos = Math.cos(angleOffset);
      const sin = Math.sin(angleOffset);
      const vx = (this.dirX * cos - this.dirY * sin) * speed;
      const vy = (this.dirX * sin + this.dirY * cos) * speed;
      const vz = (Math.random() - 0.5) * 4.0;

      tempVel.set(vx, vy, vz);
      const life = 0.15 + Math.random() * 0.2;

      context.emitRawParticle(position, tempVel, life, color);
    }
  }
}
`;
strategiesContent += '\n' + muzzleFlashStrategyClass.trim() + '\n';
fs.writeFileSync('src/gameplay/juice/ParticleStrategies.ts', strategiesContent);

// 4. ProjectileSystem.ts - Import and trigger MuzzleFlashStrategy and PointLight
let projContent = fs.readFileSync('src/gameplay/combat/ProjectileSystem.ts', 'utf8');
projContent = projContent.replace(
  'import { WEB_SPLAT_STRATEGY } from "../juice/ParticleStrategies";',
  'import { WEB_SPLAT_STRATEGY, MuzzleFlashStrategy } from "../juice/ParticleStrategies";'
);

const muzzleFlashReleaseLogic = `
        pComp.isCharging = false;
        pComp.lifeTime = 0.0;

        const scene = this.context.visualQuery.getScene();
        if (scene) {
          const muzzleLight = new BABYLON.PointLight("muzzleFlashLight", new BABYLON.Vector3(trans.x, trans.y, 0), scene);
          muzzleLight.intensity = 12.0;
          muzzleLight.range = 16.0;
          muzzleLight.diffuse = new BABYLON.Color3(0.95, 0.98, 1.0);
          setTimeout(() => {
            if (!scene.isDisposed()) {
              muzzleLight.dispose();
            }
          }, 35);
        }

        const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
        if (reqStore) {
          const reqId = this.context.world.create();
          reqStore.add(reqId, {
            strategy: new MuzzleFlashStrategy(dx / dist, dy / dist),
            x: trans.x,
            y: trans.y,
            z: 0
          });
        }
`;
projContent = projContent.replace(
  '        pComp.isCharging = false;\n        pComp.lifeTime = 0.0;',
  muzzleFlashReleaseLogic.trim()
);
fs.writeFileSync('src/gameplay/combat/ProjectileSystem.ts', projContent);

// 5. VisualStateDressingSystem.ts - Tick hitFlashTimer and apply emissive override
let dressingContent = fs.readFileSync('src/visual/systems/VisualStateDressingSystem.ts', 'utf8');

// Tick hitFlashTimer
const tickFlashLogic = `
    const playerCosmetic = cosmetics.get(this.context.refs.player);
    if (playerCosmetic && playerCosmetic.hitFlashTimer !== undefined && playerCosmetic.hitFlashTimer > 0) {
      playerCosmetic.hitFlashTimer = Math.max(0, playerCosmetic.hitFlashTimer - dt);
    }
    const weaverCosmetic = cosmetics.get(this.context.refs.weaver);
    if (weaverCosmetic && weaverCosmetic.hitFlashTimer !== undefined && weaverCosmetic.hitFlashTimer > 0) {
      weaverCosmetic.hitFlashTimer = Math.max(0, weaverCosmetic.hitFlashTimer - dt);
    }

    const wAI = this.context.stores
`;
dressingContent = dressingContent.replace(
  '    const wAI = this.context.stores',
  tickFlashLogic.trim()
);

// Override player emissive
const playerEmissiveOverride = `
          if (pCosmetic.hitFlashTimer !== undefined && pCosmetic.hitFlashTimer > 0) {
            mat.emissiveColor.set(4.0, 4.0, 4.0);
          } else if (flashAlpha > 0) {
`;
dressingContent = dressingContent.replace(
  '          if (flashAlpha > 0) {',
  playerEmissiveOverride.trim()
);

// Override weaver emissive
const weaverEmissiveOverride = `
          if (wCosmetic.hitFlashTimer !== undefined && wCosmetic.hitFlashTimer > 0) {
            pbrMat.emissiveColor.set(4.0, 4.0, 4.0);
          } else {
            pbrMat.emissiveColor.set(
              matColor.r * scale + pulse * 0.12,
              matColor.g * scale,
              matColor.b * scale
            );
          }
`;
dressingContent = dressingContent.replace(
  '          pbrMat.emissiveColor.set(\n            matColor.r * scale + pulse * 0.12,\n            matColor.g * scale,\n            matColor.b * scale\n          );',
  weaverEmissiveOverride.trim()
);
fs.writeFileSync('src/visual/systems/VisualStateDressingSystem.ts', dressingContent);

console.log("Phase 2 patch script executed successfully.");
