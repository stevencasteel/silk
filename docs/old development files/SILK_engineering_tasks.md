# SILK — Engineering Task Document

> *Build order is load-bearing. Each phase produces something testable before the next begins.*

---

## Quick Reference — Non-Negotiables

Before anything else, internalize these. Every scope decision defers to this list.

```
NEVER CUT   Wall slide charge + launch         Core feel. The game is this.
NEVER CUT   Warden emotional state lighting    Personality judges remember.
NEVER CUT   Fake-out sequence (hit 6 → 7)      The shareable moment.
NEVER CUT   Tone.js silk tension drone         30 min to add. Enormous return.

CUT FIRST   Elastic + Sticky anchors           Ship Standard anchor only if pressed.
CUT SECOND  Warden Cunning state               Stalking + Frenzied is enough.
CUT THIRD   Bioluminescent wall veins          Pure polish.
CUT FOURTH  Howler SFX pack                    Tone.js alone clears the bar.
```

---

## Phase 0 — Project Scaffolding

**Goal:** Repo is running, dependencies installed, blank Babylon scene renders in browser.

### 0.1 — Initialize Repo

```bash
npm create vite@latest silk -- --template react-ts
cd silk
```

Configure `vite.config.ts`:
- Set `assetsInlineLimit: 0` — Rapier's WASM must be served as a file, not inlined.
- Add `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']` — prevents Vite from pre-bundling WASM.
- Target `build.target: 'es2020'` for WASM compatibility.

### 0.2 — Install All Dependencies

```bash
npm install @babylonjs/core @babylonjs/materials @babylonjs/loaders
npm install @dimforge/rapier3d-compat
npm install gsap
npm install tone
npm install howler
npm install zustand
npm install stats.js leva
npm install @types/howler @types/stats.js
```

> **Note on Lygia:** Import individual GLSL functions by copying them into `/src/shaders/lygia/` rather than via npm. The npm package requires a build pipeline step that's not worth configuring for a jam. Copy only `color/iridescence.glsl` and `generative/fbm.glsl`.

### 0.3 — Directory Structure

```
/src
  /babylon         Scene setup, camera, lights, post-processing
  /physics         Rapier init, rope system, character controller
  /systems         AnchorSystem, WallSlideSystem, WardenAI, ShaderUniforms
  /audio           ToneEngine.ts, HowlerBank.ts
  /shaders         /lygia copies, silk.fragment.glsl, spider.fragment.glsl
  /store           gameStore.ts (Zustand)
  /ui              HUD components (React)
  /core            GameLoop.ts, StateMachine.ts, EventBroker.ts, ObjectPool.ts
  /input           InputProvider.ts
  main.tsx         Mount React, init Babylon canvas
```

### 0.4 — Blank Scene Smoke Test

- Create `BabylonScene.tsx` — a React component that owns a `<canvas>` ref.
- On mount: initialize `Engine`, `Scene`, a `FreeCamera` pointing down the shaft axis, one `HemisphericLight`.
- Render one `MeshBuilder.CreateBox` at origin.
- Confirm FPS counter shows ~60 before proceeding.

**Gate:** Box visible in browser. DevTools shows no console errors.

---

## Phase 1 — Core Infrastructure

**Goal:** `GameLoop`, `EventBroker`, `StateMachine`, `ObjectPool`, and `InputProvider` are implemented and wired. No gameplay yet — this is the skeleton everything else hangs on.

### 1.1 — GameLoop

```typescript
// GameLoop.ts
class GameLoop {
  private lastTime: number = 0
  private systems: Array<{ update: (dt: number) => void }> = []

  register(system: { update: (dt: number) => void }) { ... }
  start() { /* requestAnimationFrame loop, passes dt in seconds */ }
  stop() { ... }
}
```

- Delta time capped at `0.05s` (20fps floor). Rapier will explode on large dt spikes.
- `dt` passed in seconds, not milliseconds. Standardize this now.

### 1.2 — EventBroker

Typed pub/sub. Define all event names as a const enum up front:

```typescript
enum GameEvent {
  TENSION_CHANGED,
  CHARGE_CHANGED,
  HIT_WARDEN,
  ANCHOR_PLACED,
  ANCHOR_BROKEN,
  LAUNCH,
  LEASH_SNAP,
  WARDEN_STATE_CHANGED,
  PHASE_CHANGED,
}
```

- Generic `on<T>(event, handler)` / `emit<T>(event, payload)`.
- `off()` must exist — memory leak risk in a game loop context.

### 1.3 — StateMachine

Generic `StateMachine<S extends string>` class:
- States: enter/update/exit callbacks.
- `transition(newState)` guards against self-transitions.
- Used for: WardenAI states, GamePhase states. Wire both to `EventBroker.emit(WARDEN_STATE_CHANGED)` / `emit(PHASE_CHANGED)` on transition.

### 1.4 — ObjectPool

```typescript
class ObjectPool<T> {
  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number) {}
  acquire(): T { ... }
  release(obj: T): void { ... }
}
```

Used for: Anchor meshes, particle bursts. Allocate `20` anchors, `100` particle instances at startup. No runtime allocation during play.

### 1.5 — Zustand Store

```typescript
// gameStore.ts
interface GameStore {
  tension: number           // 0.0–1.0
  charge: number            // 0.0–1.0
  wardenHealth: number      // 0–7
  wardenState: WardenState  // Stalking | Frenzied | Cunning | Exhausted
  phase: GamePhase          // Loading | Playing | Fakeout | Phase2 | Dead | Win
  anchors: Anchor[]
  // Actions
  setTension: (v: number) => void
  setCharge: (v: number) => void
  damageWarden: () => void
  setWardenState: (s: WardenState) => void
  setPhase: (p: GamePhase) => void
  placeAnchor: (a: Anchor) => void
  removeAnchor: (id: string) => void
}
```

- Babylon systems call store actions directly. React HUD subscribes with selectors.
- Do not call React setState from inside the Babylon loop — Zustand is the bridge.

### 1.6 — InputProvider

Three logical inputs: `LEFT`, `RIGHT`, `HOLD`. Nothing else.

```typescript
class InputProvider {
  isDown(input: Input): boolean { ... }
  wasJustPressed(input: Input): boolean { ... }  // single-frame true
  wasJustReleased(input: Input): boolean { ... } // single-frame true
  update(): void { /* call each frame, swap buffers */ }
}
```

- Keyboard: `A`/`←` = LEFT, `D`/`→` = RIGHT, `Space`/`↓` = HOLD.
- Touch: Left third of screen = LEFT, right third = RIGHT, center third = HOLD.
- `wasJustReleased(HOLD)` is the launch trigger — this timing matters a lot later.

**Gate:** `InputProvider.update()` called in `GameLoop`. Console log confirms input state changes.

---

## Phase 2 — Scene Geometry

**Goal:** The shaft exists. Player capsule and Warden blob exist. Camera is correct. No physics yet.

### 2.1 — Shaft

- Two tall `MeshBuilder.CreateBox` panels as left/right walls. Dimensions: `2 units wide × 40 units tall × 2 units deep`.
- Gap between walls: `6 units` (player travel space).
- Set `wall.checkCollisions = false` — Rapier handles all collision, not Babylon's built-in.
- Fog: `scene.fogMode = Scene.FOGMODE_LINEAR`. Start at `y=20`, full at `y=40`. Color: near-black `#0a0a12`.
- Background web strands: 8–12 `MeshBuilder.CreateLines` instances with random points between walls. Static. Semi-transparent white material.

### 2.2 — Warden Mesh

Build procedurally — no assets.

```
Body:     MeshBuilder.CreateSphere, diameter 1.2, positioned at top center
Legs:     8× MeshBuilder.CreateCylinder, diameter 0.08, length 1.4
          Parented to body. Arranged radially (45° apart).
          Store leg meshes in array for animation access later.
Eye glow: 2× MeshBuilder.CreateSphere, diameter 0.15
          Self-illuminating emissive material
          PointLight parented to body (this is the emotional state light)
```

Initial position: `y = 35` (top of shaft). Player starts at `y = 0`.

### 2.3 — Player Mesh

- `MeshBuilder.CreateCapsule`, height `0.6`, radius `0.18`.
- Initial position: `y = 2`, `x = 0`.
- Silk wrapping: 3–4 `MeshBuilder.CreateTube` instances coiled around capsule. Static for now — will animate with tension shader later.

### 2.4 — Camera

- `FollowCamera` targeting player capsule.
- `heightOffset: 0`, `radius: 8`, `rotationOffset: 180°` — camera behind player looking up shaft.
- `lowerRadiusLimit` and `upperRadiusLimit` both set to `8` — locked distance, no zoom.
- Add subtle `camera.position.y` lerp: `camera.position.y = lerp(camera.position.y, player.position.y, 0.08 * dt * 60)` each frame.

**Gate:** Shaft renders. Warden blob visible at top with 8 legs. Player capsule at bottom. Camera follows correctly.

---

## Phase 3 — Physics Layer

**Goal:** Rapier initialized, silk rope simulating, player character controller active. The rope should sag and respond to gravity before any game logic touches it.

### 3.1 — Rapier Initialization

```typescript
// physics/RapierWorld.ts
import RAPIER from '@dimforge/rapier3d-compat'

let world: RAPIER.World

export async function initRapier() {
  await RAPIER.init()
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  return world
}
```

- Await this before `GameLoop.start()`. Show loading screen during init.
- Fixed timestep: `world.timestep = 1/60`. Step manually in `GameLoop` — do not use `world.step()` with dt directly; use accumulator pattern to avoid spiral of death.

### 3.2 — Rope System (RopeSystem.ts)

This is the most complex physics object. Build carefully.

**Rapier side — verlet chain:**
```
50 rigid bodies (RigidBodyType.Dynamic), mass 0.02 each
49 spherical joints connecting consecutive nodes
First node (index 0): anchored to Warden body position (KinematicPositionBased)
Last node (index 49): anchored to Player body (KinematicPositionBased)
Joint stiffness: 800. Damping: 20. Tune via Leva.
```

**Babylon side — tube mesh:**
```typescript
// Each frame: read rope node world positions from Rapier
// Rebuild tube path from those positions
// MeshBuilder.CreateTube with updatable: true on first call
// Pass new path array on subsequent calls — avoids mesh recreation
```

- Expose `ropeNodes: Vector3[]` as a property — AnchorSystem and ShaderUniforms will need it.
- Track `tensionValue: number` — computed as `sum of distance between consecutive nodes / restLength`. Normalize to 0.0–1.0. Emit `TENSION_CHANGED` via EventBroker when it crosses 0.1 thresholds.
- `tensionValue > 1.0` = snap condition. Set a `SNAP_THRESHOLD = 0.95` as the last warning before snap.

### 3.3 — Character Controller

```typescript
// Rapier KinematicCharacterController
const characterDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
const characterColliderDesc = RAPIER.ColliderDesc.capsule(0.3, 0.18)
const controller = world.createCharacterController(0.01) // offset
controller.setUp({ x: 0, y: 1, z: 0 })
controller.setApplyImpulsesToDynamicBodies(true)
```

- Movement applied via `controller.computeColliderMovement()` each frame.
- Wall contact detected via `controller.numComputedCollisions()` > 0 after movement step.
- Store `isOnWall: boolean`, `wallNormal: Vector3` as character state — WallSlideSystem reads these.

### 3.4 — Sync Babylon → Rapier → Babylon

Every frame, in order:
1. Write player input intent to Rapier character controller desired movement.
2. Step Rapier world (accumulator pattern).
3. Read all Rapier body positions back to Babylon mesh positions.
4. Rebuild rope tube mesh from node positions.

This write → step → read order must never be scrambled.

**Gate:** Rope visibly sags under gravity between player and a fixed top point. Player capsule moves left/right with input. Wall contact detected and logged.

---

## Phase 4 — Wall Slide + Launch (The Core Loop)

**Goal:** The game's fundamental feel. This phase is complete when the slingshot launch works end-to-end and feels good. Budget significant iteration time here.

### 4.1 — Pendulum Swing

- While `!isOnWall`: apply lateral force to character based on LEFT/RIGHT input.
- Force magnitude: `8.0` (tune via Leva). Applied in world-space X.
- Damping on release: reduce lateral velocity by `0.92` per frame when no input — slight swing persistence.
- Rope tension naturally constrains swing radius — this is free behavior from the physics joint chain.

### 4.2 — WallSlideSystem

Triggered when `isOnWall = true` AND `InputProvider.isDown(HOLD)`.

**Charge accumulation:**
```typescript
// WallSlideSystem.update(dt)
if (isOnWall && input.isDown(HOLD)) {
  const dragMultiplier = calculateAnchorDrag(anchors) // 1.0 base, +0.3 per standard anchor in contact
  charge += CHARGE_RATE * dragMultiplier * dt         // CHARGE_RATE = 0.6 (tune)
  charge = Math.min(charge, 1.0)
  store.setCharge(charge)
  EventBroker.emit(CHARGE_CHANGED, charge)
}
```

**Release detection:**
```typescript
if (wasJustReleased(HOLD) && isOnWall) {
  if (charge >= LAUNCH_THRESHOLD) {   // LAUNCH_THRESHOLD = 0.4
    triggerLaunch(charge)
  } else {
    triggerQuickFling(charge)          // Small tap lunge
  }
  charge = 0
}
```

**Quick-fling (tap, no hold):**
```typescript
if (wasJustPressed(HOLD) && wasJustReleased(HOLD) /* same frame or within 80ms */) {
  applyImpulse(towardWarden, FLING_FORCE * 0.3)
  charge -= 0.1   // Burns small tension
}
```

### 4.3 — Launch

```typescript
function triggerLaunch(chargeAmount: number) {
  const launchDir = normalize(wardenPosition - playerPosition)
  const force = LAUNCH_BASE_FORCE + (chargeAmount * LAUNCH_CHARGE_SCALE)
  // LAUNCH_BASE_FORCE = 15, LAUNCH_CHARGE_SCALE = 25 (tune heavily)

  applyImpulse(launchDir, force)
  EventBroker.emit(LAUNCH, { charge: chargeAmount })

  // Briefly detach rope constraint (first node kinematic → dynamic for 0.3s)
  // This lets player fly free during launch — reattach on landing
  ropeSystem.detachPlayerEnd(0.3)
}
```

- Camera shake on launch: `ShakeAmount = charge * 0.4`. Duration `200ms`.
- During launch phase: disable all input except detecting hit.

### 4.4 — Hit Detection

- Rapier `ColliderDesc` sphere on player (radius `0.3`), marked as sensor.
- Rapier `ColliderDesc` sphere on Warden body (radius `0.8`), marked as sensor.
- `world.intersectionsWith()` checked every physics step during launch phase.
- On intersection: emit `HIT_WARDEN`. Re-enable input after `400ms` (stun window).

### 4.5 — Warden Knockback + Reel

- On `HIT_WARDEN`: Warden velocity impulse directly away from player. Distance `3 units`.
- `GSAP.to(warden.position, { y: -= 3, duration: 0.3, ease: "back.out" })`.
- Post-knockback, Warden resumes reel-in at current state speed.
- **Reel-in** is simple: every frame, first rope node (anchored to Warden) position moves toward Warden body position. Net effect: leash shortens. Failure condition if player `y` reaches `wardenPosition.y - 1.0`.

**Gate:** Player can swing, hit wall, build charge bar, release, fly at Warden, register a hit, see knockback. Loop is completable. Iterate feel until the launch punch is viscerally satisfying.

---

## Phase 5 — Anchor System

**Goal:** Player can place anchors mid-swing that increase charge rate and redirect rope.

### 5.1 — Anchor Placement Logic

- Anchor fires from player position toward nearest wall (raycasting in Rapier — `world.castRay()`).
- Fires automatically when `InputProvider.wasJustPressed(HOLD)` AND `!isOnWall` (mid-air placement).
- Max anchors active simultaneously: `4`. Placing a 5th removes oldest.
- Use `ObjectPool<AnchorMesh>` — acquire on place, release on break.

### 5.2 — Anchor Drag Calculation

```typescript
function calculateAnchorDrag(anchors: Anchor[]): number {
  // Find anchors whose position is between player and Warden on the rope path
  // Each qualifying anchor adds its drag multiplier to the total
  const activeAnchors = anchors.filter(a => isRopeContactPoint(a, ropeNodes))
  return 1.0 + activeAnchors.reduce((sum, a) => sum + a.dragValue, 0)
}
```

Drag values:
- Standard anchor: `+0.3`
- Hard-to-reach wall spot (detected by ray hit normal angle > 45°): `+0.5` bonus

### 5.3 — Anchor Break Conditions

- Standard anchor breaks after `3` Warden pull events (Warden reel-in passes it).
- Frenzied state: break threshold reduced to `1` pull.
- On break: emit `ANCHOR_BROKEN`. Release back to pool. Silk strand burst particles.
- `GSAP` scale punch on anchor mesh before returning to pool: `scale → 0 over 0.15s`.

### 5.4 — Anchor Visual

From `ObjectPool<Mesh>`:
- `MeshBuilder.CreateCylinder` (spike shape), height `0.3`, radius `0.05`.
- Deploy animation: `GSAP.from(scale, { x: 0, y: 0, z: 0, duration: 0.12, ease: "back.out(2)" })`.
- Tether line: `MeshBuilder.CreateLines` from anchor position to rope intersection point. Update position each frame.

**Gate:** Anchors deploy to wall, visibly contact rope, charge builds faster with anchors placed, anchors break after Warden pulls.

---

## Phase 6 — Warden AI

**Goal:** The Warden has four behavioral states, reads anchor placement, and transitions meaningfully. She feels like an opponent, not a pattern.

### 6.1 — WardenAI State Machine

Use the `StateMachine<WardenState>` from Phase 1.

```
States:   Stalking | Frenzied | Cunning | Exhausted
```

**Stalking (default)**
```
Reel speed:     0.4 units/sec
Behavior:       Standard reel-in. 
                Every 3 seconds: sample anchor placement quality (count × average drag).
                If quality > threshold → transition to Cunning.
Transition out: 2 hits within 4 seconds → Frenzied.
                Taking a hit → Exhausted.
```

**Frenzied**
```
Reel speed:     1.2 units/sec
Behavior:       Increased reel. Spawns 1 debris obstacle (simple sphere) every 2 seconds.
                Anchor break threshold reduced to 1 pull.
Transition out: After 8 seconds OR on taking a hit → Exhausted.
                Post-Exhausted recovery → Stalking.
```

**Cunning** *(cut if time is short — Stalking + Frenzied is sufficient)*
```
Reel speed:     0.2 units/sec (deliberately slow)
Behavior:       Moves laterally to route around player's anchor web.
                Goes visually quiet (dims body point light to 20% brightness).
                No anchor breaks — routes around them instead.
Transition out: Player launches while Cunning is active → Exhausted.
                After 10 seconds → Stalking.
```

**Exhausted**
```
Reel speed:     0.15 units/sec
Behavior:       Warden droops. Legs animate to hanging position.
                Point light dims and flickers.
                Full vulnerability window: player charge builds 2× faster.
Duration:       3 seconds, then → Stalking.
```

### 6.2 — Anchor Pattern Reading

```typescript
// Called during Stalking every 3 seconds
function assessAnchorThreat(): number {
  const anchorCount = store.anchors.length
  const avgDrag = store.anchors.reduce((s, a) => s + a.dragValue, 0) / Math.max(anchorCount, 1)
  const coverage = measureRopeCoverage(store.anchors, ropeNodes) // 0.0–1.0
  return (anchorCount * 0.2) + (avgDrag * 0.4) + (coverage * 0.4)
}
// If assessAnchorThreat() > 0.6 → transition to Cunning
```

### 6.3 — Emotional State Lighting

The Warden's `PointLight` (parented to body) changes color and intensity by state. This is the personality the judges remember.

```typescript
const wardenLightColors = {
  Stalking:   new Color3(0.2, 0.4, 1.0),   // cold blue
  Frenzied:   new Color3(1.0, 0.15, 0.1),  // hot red
  Cunning:    new Color3(0.1, 0.6, 0.15),  // dim green
  Exhausted:  new Color3(0.7, 0.7, 0.7),   // faded white
}
const wardenLightIntensity = {
  Stalking: 1.2, Frenzied: 2.0, Cunning: 0.4, Exhausted: 0.5
}

// On state transition: GSAP tween light color + intensity over 0.6s
gsap.to(wardenLight, {
  intensity: wardenLightIntensity[newState],
  duration: 0.6,
  ease: "power2.out"
})
```

### 6.4 — Leg Animation

8 legs, each a `TransformNode` parented to body.

```typescript
// Skitter (Cunning) — rapid small oscillations
legs.forEach((leg, i) => {
  const phase = (i / 8) * Math.PI * 2
  leg.rotation.z = Math.sin(time * 8 + phase) * 0.15
})

// Flail (hit reaction) — GSAP sequence
gsap.timeline()
  .to(legs.map(l => l.rotation), { z: "random(-1.2, 1.2)", duration: 0.1, stagger: 0.01 })
  .to(legs.map(l => l.rotation), { z: 0, duration: 0.4, ease: "elastic.out(1, 0.4)", stagger: 0.02 })

// Droop (Exhausted)
gsap.to(legs.map(l => l.rotation), { x: Math.PI * 0.4, duration: 0.5, ease: "power2.out" })
```

### 6.5 — Squash/Stretch (Procedural, Every Frame)

```typescript
// In WardenAI.update(dt)
const vel = wardenBody.linvel()  // from Rapier rigid body
warden.scaling.x = 1 + vel.x * STRETCH_FACTOR   // STRETCH_FACTOR = 0.08
warden.scaling.y = 1 - Math.abs(vel.x) * SQUASH_FACTOR  // SQUASH_FACTOR = 0.05
warden.scaling.z = 1 - Math.abs(vel.z) * SQUASH_FACTOR
// Lerp back toward 1.0 each frame: scaling = lerp(scaling, 1.0, 0.15)
```

**Gate:** All four states active. Warden changes color/speed on transition. Legs animate per state. Anchor threat assessment fires and triggers Cunning.

---

## Phase 7 — Fake-Out Sequence

**Build this whole sequence before touching shaders.** It's the most important single moment in the game.

### 7.1 — Hit 6 Detection

In `EventBroker` handler for `HIT_WARDEN`:
```typescript
if (store.wardenHealth === 1 /* about to reach 0 */) {
  store.setPhase(GamePhase.Fakeout)
  triggerFakeOutSequence()
  return  // Do NOT reduce health to 0 yet
}
```

### 7.2 — Fake-Out Sequence

```typescript
function triggerFakeOutSequence() {
  disablePlayerInput()

  gsap.timeline()
    // Warden collapses
    .to(warden.scaling, { x: 0.1, y: 0.1, z: 0.1, duration: 0.4, ease: "back.in(2)" })
    .to(legs.map(l => l.rotation), { x: Math.PI, stagger: 0.04, duration: 0.3 }, "<")
    .call(() => {
      wardenLight.intensity = 0
      EventBroker.emit(PHASE_CHANGED, GamePhase.Fakeout)
    })
    // Silk snap effect on player leash
    .call(() => triggerSilkSnapParticles(player.position))
    .call(() => howler.play('fakeout_sting'))
    // Silence
    .to({}, { duration: 0.8 })  // hold beat
    // Warden screech + resurrection
    .call(() => howler.play('spider_screech'))
    .to(warden.scaling, { x: 2.2, y: 2.2, z: 2.2, duration: 0.15, ease: "elastic.out(1, 0.3)" })
    .to(legs.map(l => l.rotation), { x: 0, stagger: 0.02, duration: 0.2 }, "<")
    .call(() => {
      // New leash forms — reattach rope with new max tension tolerance
      ropeSystem.reattachWithSlack(1.5)  // longer rope
      store.setPhase(GamePhase.Phase2)
      store.setWardenState(WardenState.Frenzied) // Permanently
      reenablePlayerInput()
    })
}
```

### 7.3 — Phase 2

- `wardenState` locked to `Frenzied`. State machine transitions to Frenzied on any incoming trigger.
- One more hit (hit 7) triggers win sequence.
- Warden speed: `1.8` (faster than Phase 1 Frenzied).

**Gate:** Play to 6 hits. Fake-out fires correctly. Phase 2 starts with Frenzied Warden. Game completable with 7th hit.

---

## Phase 8 — Shader Layer

**Goal:** Silk rope looks iridescent and reacts to tension. Spider body has subsurface scattering approximation. Damage dissolve on hits.

### 8.1 — Silk Shader

Create a Babylon `ShaderMaterial` for the rope tube mesh.

```glsl
// silk.fragment.glsl
uniform float u_tension;      // 0.0–1.0
uniform float u_time;
uniform vec3  u_viewDir;

#include "lygia/color/iridescence.glsl"
#include "lygia/generative/fbm.glsl"

void main() {
  // Base iridescence: view angle × tension drives hue shift
  float iriAngle = dot(normalize(vNormal), u_viewDir);
  vec3 iriColor = iridescence(iriAngle + fbm(vPosition.xy * 4.0 + u_time * 0.3) * 0.2);

  // Tension-based color blend
  // Slack (0.0): cool blue-grey
  // Taut (1.0): bright white
  // Critical (>0.9): red core bleeds in
  vec3 slackColor  = vec3(0.3, 0.4, 0.7);
  vec3 tautColor   = vec3(0.9, 0.95, 1.0);
  vec3 critColor   = vec3(0.9, 0.1, 0.1);

  vec3 baseColor = mix(slackColor, tautColor, u_tension);
  float critFactor = smoothstep(0.85, 1.0, u_tension);
  baseColor = mix(baseColor, critColor, critFactor);

  vec3 finalColor = mix(baseColor, iriColor, 0.4);
  gl_FragColor = vec4(finalColor, 1.0);
}
```

**Rope thickness:** Update in `RopeSystem.update()` — pass `diameter = 0.04 + tension * 0.04` to `CreateTube`.

### 8.2 — Spider Body Shader

```glsl
// spider.fragment.glsl
uniform vec3  u_lightDir;
uniform vec3  u_viewDir;
uniform float u_hitCount;  // 0–7, drives dissolve

// Subsurface scattering approx
float sss = pow(max(dot(-u_lightDir, u_viewDir), 0.0), 4.0) * 0.3;
vec3 skinColor = vec3(0.05, 0.02, 0.08);  // deep purple-black
vec3 result = skinColor + sss * vec3(0.4, 0.2, 0.5);

// Damage dissolve: silk wrapping spreads per hit
float dissolveThreshold = u_hitCount / 7.0;
float noise = fbm(vPosition.xyz * 3.0);
if (noise < dissolveThreshold) {
  // Show silk wrapping color instead of body
  result = mix(result, vec3(0.8, 0.9, 1.0), 0.7);
}

gl_FragColor = vec4(result, 1.0);
```

### 8.3 — ShaderUniforms System

```typescript
// ShaderUniforms.ts — registered in GameLoop
class ShaderUniforms {
  update(dt: number) {
    const { tension } = store.getState()
    const time = performance.now() / 1000

    silkMaterial.setFloat('u_tension', tension)
    silkMaterial.setFloat('u_time', time)
    silkMaterial.setVector3('u_viewDir', camera.getForwardRay().direction)

    spiderMaterial.setVector3('u_lightDir', wardenLight.direction)
    spiderMaterial.setVector3('u_viewDir', camera.getForwardRay().direction)
    spiderMaterial.setFloat('u_hitCount', store.wardenHealth)
    // Note: hitCount is inverted — health decreases, dissolve increases
    spiderMaterial.setFloat('u_hitCount', 7 - store.wardenHealth)
  }
}
```

**Gate:** Rope changes color from blue → white → red as tension rises. Spider body shows faint SSS glow. Silk wrapping pattern spreads visibly across spider body per hit.

---

## Phase 9 — Audio Stack

**Goal:** Tone.js reactive drone is live. Howler discrete SFX fires on events. Audio starts after first user interaction (browser requirement).

### 9.1 — ToneEngine (Tone.js)

```typescript
// ToneEngine.ts
import * as Tone from 'tone'

class ToneEngine {
  private tensionOsc: Tone.Oscillator
  private chargeSweep: Tone.Filter
  private chargeSaw: Tone.Oscillator

  async init() {
    await Tone.start()  // Must be called from user gesture handler

    // Silk tension drone
    this.tensionOsc = new Tone.Oscillator({ type: 'sine', frequency: 80 }).toDestination()
    this.tensionOsc.volume.value = -18  // dB
    this.tensionOsc.start()

    // Charge sweep: sawtooth through filter
    this.chargeSaw = new Tone.Oscillator({ type: 'sawtooth', frequency: 110 })
    this.chargeSweep = new Tone.Filter({ type: 'bandpass', frequency: 400, rolloff: -24 })
    this.chargeSaw.connect(this.chargeSweep)
    this.chargeSweep.toDestination()
    this.chargeSaw.volume.value = -30
  }

  setTension(t: number) {
    // Map 0.0–1.0 tension to 80hz–400hz
    this.tensionOsc.frequency.rampTo(80 + t * 320, 0.05)
    this.tensionOsc.volume.rampTo(-18 + t * 8, 0.05)  // gets louder as critical
  }

  setCharge(c: number) {
    if (c > 0) {
      this.chargeSaw.start()
      this.chargeSweep.frequency.rampTo(200 + c * 1600, 0.02)  // filter sweep up
    } else {
      this.chargeSaw.stop()
    }
  }
}
```

Subscribe to EventBroker:
```typescript
EventBroker.on(TENSION_CHANGED, (t) => toneEngine.setTension(t))
EventBroker.on(CHARGE_CHANGED, (c) => toneEngine.setCharge(c))
```

One-shot synthesis events (no Howler needed for these):
```typescript
// Launch burst
const launchSynth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15 } })
EventBroker.on(LAUNCH, () => launchSynth.triggerAttackRelease('8n'))

// Wall impact
const wallSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.08 } })
// Varies pitch by wall material — reuse same synth, vary frequency
```

### 9.2 — HowlerBank (Howler.js)

```typescript
// HowlerBank.ts
import { Howl } from 'howler'

// All generated via ElevenLabs
const bank = {
  spider_screech: new Howl({ src: ['/audio/spider_screech.mp3'] }),
  fakeout_sting:  new Howl({ src: ['/audio/fakeout_sting.mp3'] }),
  anchor_deploy:  new Howl({ src: ['/audio/anchor_deploy.mp3'] }),
  anchor_break:   new Howl({ src: ['/audio/anchor_break.mp3'] }),
  silk_snap:      new Howl({ src: ['/audio/silk_snap.mp3'] }),
  victory:        new Howl({ src: ['/audio/victory.mp3'] }),
}

EventBroker.on(ANCHOR_PLACED,  () => bank.anchor_deploy.play())
EventBroker.on(ANCHOR_BROKEN,  () => bank.anchor_break.play())
EventBroker.on(HIT_WARDEN,     () => bank.spider_screech.play())
EventBroker.on(LEASH_SNAP,     () => bank.silk_snap.play())
```

> **Fallback plan:** If ElevenLabs SFX generation runs over time, skip Howler entirely. Tone.js one-shots cover all critical events. Howler is additive polish.

**Gate:** Tension drone pitch rises as rope tightens. Charge sweep activates during wall slide. Launch burst fires on release. Hit screech plays on Warden contact.

---

## Phase 10 — Post-Processing & Camera Juice

**Goal:** Babylon post-processing pipeline active. Bloom on rope and eyes. Vignette tightens with tension. Chromatic aberration above 90%. Camera shake on all impact events.

### 10.1 — Post-Processing Pipeline

```typescript
// babylon/PostProcessing.ts
import { DefaultRenderingPipeline } from '@babylonjs/core'

const pipeline = new DefaultRenderingPipeline('main', true, scene, [camera])

// Bloom — silk threads and spider eyes glow
pipeline.bloomEnabled = true
pipeline.bloomThreshold = 0.6
pipeline.bloomWeight = 0.4
pipeline.bloomKernel = 64

// Vignette — tightens with tension
pipeline.imageProcessingEnabled = true
pipeline.imageProcessing.vignetteEnabled = true
pipeline.imageProcessing.vignetteWeight = 1.5  // base
// Update each frame: .vignetteWeight = 1.5 + tension * 2.5

// Chromatic aberration — activates above 90% tension
// Babylon doesn't have built-in CA — use a custom PostProcess shader
// Simple CA: sample R/G/B channels with slight UV offset per channel
// Offset magnitude: Math.max(0, (tension - 0.9) / 0.1) * 0.008
```

### 10.2 — Chromatic Aberration PostProcess

```glsl
// ca.fragment.glsl
uniform float u_strength;
uniform sampler2D textureSampler;

void main() {
  vec2 dir = vUV - vec2(0.5);
  float r = texture2D(textureSampler, vUV + dir * u_strength).r;
  float g = texture2D(textureSampler, vUV).g;
  float b = texture2D(textureSampler, vUV - dir * u_strength).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
```

Update `u_strength` from `ShaderUniforms.update()`.

### 10.3 — Camera Shake

```typescript
// babylon/CameraShake.ts
class CameraShake {
  private trauma: number = 0  // 0.0–1.0, decays over time
  private shakePower = 2       // trauma^2 = shake magnitude

  addTrauma(amount: number) {
    this.trauma = Math.min(1.0, this.trauma + amount)
  }

  update(dt: number) {
    const shake = Math.pow(this.trauma, this.shakePower)
    camera.position.x += (Math.random() * 2 - 1) * shake * 0.15
    camera.position.y += (Math.random() * 2 - 1) * shake * 0.08
    this.trauma = Math.max(0, this.trauma - dt * 1.2)  // decay speed
  }
}

EventBroker.on(HIT_WARDEN,     () => shake.addTrauma(0.6))
EventBroker.on(ANCHOR_BROKEN,  () => shake.addTrauma(0.3))
EventBroker.on(LAUNCH,         (e) => shake.addTrauma(e.charge * 0.4))
```

### 10.4 — FOV Pulse

```typescript
// Tied to Warden emotional state — camera breathes with spider
const fovByState = { Stalking: 75, Frenzied: 85, Cunning: 70, Exhausted: 72 }
EventBroker.on(WARDEN_STATE_CHANGED, (state) => {
  gsap.to(camera, { fov: fovByState[state] * (Math.PI / 180), duration: 0.8 })
})
```

**Gate:** Bloom visible on rope and Warden eyes. Vignette perceptibly tightens near snap. Camera jolts on hit. CA flickers appear above 90% tension.

---

## Phase 11 — React HUD Layer

**Goal:** Minimal React UI over the Babylon canvas. Three elements: tension indicator, charge bar, hit counter.

### 11.1 — Layout

```
Canvas (Babylon — full viewport, z-index 0)
HUD overlay (React — absolute positioned, pointer-events: none, z-index 10)
  ├── TensionIndicator  (bottom center — vertical bar, color-coded)
  ├── ChargeBar         (bottom center — horizontal bar, pulses on full charge)
  └── WardenHealth      (top center — 7 dots, one dims per hit, fake-out animates)
```

### 11.2 — Zustand Selectors

```typescript
// Each component subscribes to only what it needs — no unnecessary re-renders
const tension = useGameStore((s) => s.tension)
const charge  = useGameStore((s) => s.charge)
const health  = useGameStore((s) => s.wardenHealth)
const phase   = useGameStore((s) => s.phase)
```

### 11.3 — Tension Indicator

- Vertical bar, height proportional to `tension`.
- Color: CSS linear-gradient, transitions from `#3a6fdb` (slack) → `#e8f0ff` (taut) → `#c92a2a` (critical).
- Above 90%: bar pulses (CSS keyframe animation `pulse 0.3s infinite`).
- On `LEASH_SNAP` event: bar flashes white, then CSS transitions to off.

### 11.4 — Warden Health Display

- 7 orbs in a row.
- Active: `background: radial-gradient(circle, #c0d8ff, #3060c0)`.
- Hit: orb scales to 0 over 0.3s via Framer Motion (or CSS transition).
- Fake-out: after orb 6 dies, short pause, then ALL orbs reanimate (2 back? No — just 1 final orb pulses into existence with a red glow). Signal phase 2 with a glow change on remaining orb.

### 11.5 — Loading Screen

React component rendered while `phase === GamePhase.Loading`:
- Dark background. 8 silk threads animate in from edges (CSS SVG animation), converging toward center.
- Spider silhouette fades in at center behind threads.
- Progress bar driven by Rapier WASM load progress + Babylon scene ready event.

**Gate:** HUD elements all update reactively from Babylon game loop. No prop drilling. Loading screen shows during Rapier init.

---

## Phase 12 — Win / Lose Flows

**Goal:** Both endings complete with appropriate audio/visual signatures. Game is replayable.

### 12.1 — Win Sequence (Hit 7)

```typescript
function triggerWin() {
  store.setPhase(GamePhase.Win)
  disablePlayerInput()

  // Slow motion
  world.timestep = 1/240  // 4x physics slowdown
  Tone.getTransport().bpm.rampTo(40, 0.5)  // slow the tension drone

  howler.play('victory')  // silence, then release

  gsap.timeline()
    // Silk engulfs Warden
    .call(() => triggerSilkEngulfParticles(warden.position))
    .to(warden.scaling, { x: 0, y: 0, z: 0, duration: 1.2, ease: "power3.in" })
    // Warden falls past player
    .to(wardenBody.position, { y: -50, duration: 2.0, ease: "power2.in" })
    .call(() => ropeSystem.goSlack())  // tension → 0
    .to({}, { duration: 1.5 })  // silence
    // Show win screen
    .call(() => showWinOverlay())
}
```

### 12.2 — Lose Condition A — Leash Snap

Triggered when `tension >= 1.0` in `RopeSystem`.

```typescript
EventBroker.emit(LEASH_SNAP)
howler.play('silk_snap')
triggerSilkExplosionParticles(player.position)  // burst of 80 strand particles
// Screen flash white, fade to black over 0.5s
// Show lose overlay: "The silk broke. She wins."
store.setPhase(GamePhase.Dead)
```

### 12.3 — Lose Condition B — Warden Escapes

Triggered when `warden.position.y > SHAFT_TOP_Y`.

```typescript
// Rope goes slack visually — all nodes drop with gravity
ropeSystem.detachWardenEnd()
// Show lose overlay: "She's gone. You hang in silence."
store.setPhase(GamePhase.Dead)
```

### 12.4 — Restart

- Win/Lose overlays show a "Run Again" button.
- On click: `resetGameState()` — restore all Rapier bodies to spawn positions, reset Zustand store, re-enable input.
- Do not reload the page — full soft reset.

**Gate:** Both lose conditions fire correctly. Win plays in full. Game is restartable without page reload.

---

## Phase 13 — Dev Tooling + Polish Pass

**Goal:** Leva panel exposes all tunable values. Stats.js running. Final feel pass — these 30-minute changes have outsized impact.

### 13.1 — Leva Tuning Panel

```typescript
// Only imported in dev — vite define plugin strips in production
import { useControls } from 'leva'

const { chargeRate, launchForce, ropeStiffness, wardenSpeed, stretchFactor } = useControls({
  chargeRate:     { value: 0.6,  min: 0.1, max: 3.0, step: 0.05 },
  launchForce:    { value: 40.0, min: 10,  max: 80,  step: 1.0  },
  ropeStiffness:  { value: 800,  min: 100, max: 2000, step: 50  },
  wardenSpeed:    { value: 0.4,  min: 0.1, max: 2.0, step: 0.05 },
  stretchFactor:  { value: 0.08, min: 0.0, max: 0.3, step: 0.01 },
  snapThreshold:  { value: 0.95, min: 0.7, max: 1.0, step: 0.01 },
})
```

Pass values into systems via module-level refs — do not restructure systems around Leva.

### 13.2 — Stats.js

```typescript
const stats = new Stats()
stats.showPanel(0)  // FPS
document.body.appendChild(stats.dom)
stats.dom.style.cssText = 'position:absolute;top:0;left:0;z-index:9999'

// In GameLoop: stats.begin() before update, stats.end() after render
```

### 13.3 — 30-Minute Feel Improvements (Do These)

These are high-leverage, low-effort. Do them in this order if time is available:

1. **Rope thickness pulse on launch** — momentary thickness spike (`0.12`) then back to `0.04` over `0.2s`. Pure feel.
2. **Screen-space flash on hit** — full white overlay `<div>` that fades from `opacity: 0.8` to `0` over `0.15s`. Dead simple.
3. **Tension audio starts muted** — fade in Tone.js drone over the first 3 seconds of play. Less jarring entry.
4. **Warden eye flicker in Exhausted** — random `setInterval` calls that briefly set `wardenLight.intensity` to `0` then back. Sells the droop.
5. **Charge bar screen flash at 100%** — brief white pulse on the HUD bar when fully charged to signal "fire now."

### 13.4 — Pre-Submission Checklist

```
[ ] Remove Stats.js from production build (Vite env check)
[ ] Remove Leva from production build
[ ] Remove Babylon Inspector shortcut (Ctrl+Alt+I)
[ ] Test on Firefox desktop
[ ] Test on iOS Safari
[ ] Test on Android Chrome
[ ] Test on throttled CPU (Chrome DevTools 4× slowdown) — target ≥ 30 FPS
[ ] Verify Rapier WASM served correctly (not inlined by Vite)
[ ] Verify all 6 Howler audio files present in /public/audio/
[ ] Loading screen covers Rapier WASM load time
[ ] Soft restart works without page reload
[ ] Run plays to completion — both win and lose paths tested
[ ] Bundle size check: target < 5MB uncompressed
```

---

## Dependency Map

Build phases in order. Each row lists what the phase needs from prior phases.

| Phase | Depends On |
|---|---|
| 0 — Scaffolding | Nothing |
| 1 — Core Infra | Phase 0 |
| 2 — Scene Geometry | Phase 0, Phase 1 (EventBroker, Store) |
| 3 — Physics | Phase 2 (mesh refs), Phase 1 (GameLoop) |
| 4 — Wall Slide + Launch | Phase 3 (CharacterController, RopeSystem), Phase 1 (Input, EventBroker) |
| 5 — Anchor System | Phase 4 (wall contact, rope node array), Phase 1 (ObjectPool) |
| 6 — Warden AI | Phase 4 (hit detection), Phase 5 (anchor reading), Phase 1 (StateMachine) |
| 7 — Fake-Out | Phase 6 (WardenAI state, health), Phase 4 (hit detection) |
| 8 — Shaders | Phase 3 (RopeSystem, tension value), Phase 2 (mesh materials) |
| 9 — Audio | Phase 1 (EventBroker). No physics dependency — can be built in parallel with Phase 4. |
| 10 — Post-FX | Phase 2 (scene, camera), Phase 8 (tension uniform available) |
| 11 — HUD | Phase 1 (Zustand store). Can be built in parallel with Phase 4+. |
| 12 — Win/Lose | All phases complete |
| 13 — Polish | All phases complete |

---

## Time Budget (Game Jam Reference)

Estimated hours per phase for a single experienced developer:

```
Phase 0  Scaffolding           1h
Phase 1  Core Infra            2h
Phase 2  Scene Geometry        2h
Phase 3  Physics               4h   ← Rapier WASM quirks. Budget buffer here.
Phase 4  Wall Slide + Launch   5h   ← Most iteration time. Feel is everything.
Phase 5  Anchor System         3h
Phase 6  Warden AI             4h
Phase 7  Fake-Out Sequence     2h
Phase 8  Shaders               3h
Phase 9  Audio                 2h
Phase 10 Post-FX               2h
Phase 11 HUD                   2h
Phase 12 Win/Lose              2h
Phase 13 Polish + QA           3h
─────────────────────────────────
Total                         37h
```

If over budget, cut in spec order (Elastic/Sticky anchors → Cunning state → wall veins → Howler SFX). Never cut Phase 4, the fake-out sequence, the emotional lighting, or the Tone.js drone.
