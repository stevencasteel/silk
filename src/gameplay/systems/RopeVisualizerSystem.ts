import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, TetherComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

// ---------------------------------------------------------------------------
// RopeVisualizerSystem
// Renders the silk tether as a catenary curve.
// Visual feedback on tension level:
//   low  (0 %)  -> cool blue,  visible sag,  thin
//   mid  (50 %) -> bright white, slight sag
//   full (100%) -> hot orange,  taut/straight, thick + emissive pulse
// ---------------------------------------------------------------------------

export class RopeVisualizerSystem implements ISystem {
    readonly phase = SystemPhase.RenderSync;

    private readonly SEGMENTS   = 24;
    private readonly MAX_SAG    = 3.8;   // units of midpoint droop at 0 % tension
    private readonly BASE_RADIUS = 0.07;
    private readonly MAX_RADIUS  = 0.13;

    private ropeMesh : BABYLON.Mesh | null = null;
    private ropeMat  : BABYLON.StandardMaterial | null = null;
    private points   : BABYLON.Vector3[] = [];

    // Scratch vectors (avoid GC)
    private scratchAnchor = new BABYLON.Vector3();
    private scratchPlayer = new BABYLON.Vector3();
    private scratchCtrl   = new BABYLON.Vector3();
    private scratchPt     = new BABYLON.Vector3();

    // Oscillation phase for rope vibration at high tension
    private vibPhase = 0;

    constructor(
        private refs: EntityRefs,
        private transforms: ComponentStore<TransformComponent>,
        private tethers: ComponentStore<TetherComponent>,
        private visualRegistry: IVisualRegistry
    ) {
        for (let i = 0; i <= this.SEGMENTS; i++) {
            this.points.push(new BABYLON.Vector3(0, 0, 0));
        }
    }

    public init(): void {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;

        this.ropeMat = new BABYLON.StandardMaterial("ropeMat", scene);
        this.ropeMat.diffuseColor  = new BABYLON.Color3(0.6, 0.85, 1.0);
        this.ropeMat.emissiveColor = new BABYLON.Color3(0.2, 0.45, 0.7);
        this.ropeMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        this.ropeMat.disableLighting = false;

        this.ropeMesh = BABYLON.MeshBuilder.CreateTube("tetherTube", {
            path: this.points,
            radius: this.BASE_RADIUS,
            tessellation: 8,
            cap: BABYLON.Mesh.NO_CAP,
            updatable: true
        }, scene);
        this.ropeMesh.material = this.ropeMat;
    }

    public render(alpha: number): void {
        if (!this.ropeMesh || !this.ropeMat) return;

        const pTrans = this.transforms.get(this.refs.player);
        const tether = this.tethers.get(this.refs.player);
        if (!pTrans || !tether || !tether.isAttached) {
            if (this.ropeMesh) this.ropeMesh.setEnabled(false);
            return;
        }
        this.ropeMesh.setEnabled(true);

        // Interpolated player position
        const px = pTrans.prevX + (pTrans.x - pTrans.prevX) * alpha;
        const py = pTrans.prevY + (pTrans.y - pTrans.prevY) * alpha;
        this.scratchPlayer.set(px, py, 0);

        // Anchor = warden position recorded on TetherComponent
        this.scratchAnchor.set(tether.anchorX, tether.anchorY, tether.anchorZ);

        const tension = Math.max(0, Math.min(1, tether.tension));

        // Vibration: high-frequency oscillation at near-max tension
        this.vibPhase += 0.18;
        const vibAmp = Math.max(0, tension - 0.7) * 0.35;
        const vibOffset = Math.sin(this.vibPhase * 14) * vibAmp;

        // Catenary control point: geometric midpoint + downward sag
        const midX = (this.scratchAnchor.x + this.scratchPlayer.x) * 0.5;
        const midY = (this.scratchAnchor.y + this.scratchPlayer.y) * 0.5;
        const sag   = this.MAX_SAG * (1.0 - tension) + vibOffset;
        this.scratchCtrl.set(midX, midY - sag, 0.35);

        // Compute quadratic bezier path
        for (let i = 0; i <= this.SEGMENTS; i++) {
            const t  = i / this.SEGMENTS;
            const t1 = 1 - t;
            const pt = this.points[i];
            pt.x = t1 * t1 * this.scratchAnchor.x
                 + 2 * t1 * t * this.scratchCtrl.x
                 + t  * t  * this.scratchPlayer.x;
            pt.y = t1 * t1 * this.scratchAnchor.y
                 + 2 * t1 * t * this.scratchCtrl.y
                 + t  * t  * this.scratchPlayer.y;
            pt.z = t1 * t1 * this.scratchAnchor.z
                 + 2 * t1 * t * this.scratchCtrl.z
                 + t  * t  * this.scratchPlayer.z;

            // Subtle Z-waveform for 3D silk feel
            pt.z += Math.sin((i / this.SEGMENTS) * Math.PI * 2.5) * 0.12;
        }

        // Rebuild tube with updated path
        const radius = this.BASE_RADIUS + tension * (this.MAX_RADIUS - this.BASE_RADIUS);
        this.ropeMesh = BABYLON.MeshBuilder.CreateTube("tetherTube", {
            path: this.points,
            radius: radius,
            tessellation: 8,
            cap: BABYLON.Mesh.NO_CAP,
            instance: this.ropeMesh
        });

        // Color gradient: blue(0) -> white(0.5) -> orange(1)
        const r = tension < 0.5
            ? 0.55 + tension * 0.9
            : 1.0;
        const g = tension < 0.5
            ? 0.78 + tension * 0.44
            : 1.0 - (tension - 0.5) * 1.1;
        const b = tension < 0.5
            ? 1.0  - tension * 0.2
            : 0.9  - (tension - 0.5) * 1.7;

        this.ropeMat.diffuseColor.set(
            Math.max(0, Math.min(1, r)),
            Math.max(0, Math.min(1, g)),
            Math.max(0, Math.min(1, b))
        );

        // Emissive glow scales with tension
        const eBrightness = 0.1 + tension * 0.5;
        this.ropeMat.emissiveColor.set(
            eBrightness * (0.3 + tension * 0.7),
            eBrightness * (0.6 - tension * 0.4),
            eBrightness * (1.0 - tension * 0.9)
        );

        this.scratchPt.set(0, 0, 0); // keep lint happy
    }

    public dispose(): void {
        if (this.ropeMesh) { this.ropeMesh.dispose(); this.ropeMesh = null; }
        if (this.ropeMat)  { this.ropeMat.dispose();  this.ropeMat  = null; }
    }
}
