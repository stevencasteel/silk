# SILK — Game Jam Build Spec

> *You are prey. You learned one trick. Use it.*

---

## Concept

A single-screen arcade game. A giant spider has wrapped you in silk and is dragging you up a dark shaft toward her nest. You fight back using her own material against her — wall slides build tension in the silk leash, anchors redirect it, and a perfectly timed release launches you at her like a slingshot stone. Hit her enough times and she's done. Except she isn't.

**Theme fit:** Mind of its own — the Warden is sentient, adaptive, and reads your behavior. She is not a system. She is an opponent.

**Target length:** 4–7 minutes per run. 7 hits to kill, with a fake-out after hit 6.

---

## Core Loop

```
Swing into position
    → Fire anchor(s) into wall
        → Hit wall, initiate slide
            → Hold slide to build tension charge
                → Release at peak → launch at Warden
                    → Hit = damage + knockback + stun window
                        → Warden recovers, new behavioral state, repeat
```

---

## Controls

Three inputs. Nothing else.

| Input | Action |
|---|---|
| Left | Swing left on silk pendulum |
| Right | Swing right on silk pendulum |
| Hold | Press into nearest wall → initiate slide + charge buildup |
| Release hold | Launch if charge threshold met / detach if not |
| Tap (no hold) | Quick-release fling — short lunge, burns small tension |

**Mobile:** Left/right touch zones + center hold zone. Same three inputs.

---

## The Warden — Behavioral States

The spider has a state machine with four states. She reads your anchor placement and adapts.

| State | Behavior | Trigger |
|---|---|---|
| **Stalking** | Default. Steady reel-in. Watches your anchor pattern. | Game start / post-hit recovery |
| **Frenzied** | Fast reel. Breaks anchors aggressively. Drops debris. | Taking 2 hits in quick succession |
| **Cunning** | Slows reel. Routes around your anchor web deliberately. Goes quiet. | Player has clean anchor setup |
| **Exhausted** | Slow. Vulnerable. Legs droop. | After failed lunge or taking a hit |

**Fake-out:** After hit 6 she goes fully limp, cocooned. Legs slowly uncurl. Silk snaps off her. Phase 2 — Frenzied permanently, one final hit ends it.

---

## Anchors

Player fires anchors from current position into shaft walls. They hook the silk leash as it passes, creating redirect points that multiply tension buildup rate during wall slides.

| Type | Properties | Notes |
|---|---|---|
| **Standard** | Medium drag. Breaks after 3 Warden pulls. | Starting anchor |
| **Elastic** | Stores tension. Snaps back on break — can redirect Warden or boost player. | Unlocked mid-run |
| **Sticky** | High drag. Slows Warden but also slows player if they drift through it. | Risk/reward placement |

Hard-to-hit anchor spots (narrow ledges, moving geometry) give higher drag multipliers. Placement skill is the depth layer.

---

## The Silk Rope

The centerpiece mechanic and the centerpiece visual. A physical verlet chain of ~50 nodes rendered as a 3D tube with real volume. Properties:

- **Taut** — bright white/blue, thin, humming pitch in Tone.js
- **Slack** — soft blue-grey, drooping, low drone
- **Near snap** — red core bleeds through iridescent surface, chromatic aberration on screen edges, pitch climbs
- **Post-snap** — run ends. Silk explosion particle burst.

---

## Rendering Stack

**Primary renderer:** Babylon.js with WebGL2  
No WebGPU dependency. Runs on all modern browsers including iOS Safari, Firefox, and older hardware. Chrome not required.

```
Babylon.js (WebGL2 mode)
    Scene graph, camera, lights, material system
    Built-in inspector for development
    Havok physics for secondary collisions (included free with Babylon)

Rapier.js (WASM)
    Primary silk rope simulation
    Verlet constraint chain, stiffness + damping configurable
    Character controller for wall slide detection
    Continuous collision detection for launch phase
```

---

## Shader Stack

**Lygia** — GLSL shader utility library. Imported as functions into Babylon material shaders.

Key shaders:

```glsl
// Silk — iridescence shifts blue→white→gold by view angle + tension uniform
#include "lygia/color/iridescence.glsl"
#include "lygia/generative/fbm.glsl"

// Spider body — cheap subsurface scattering approximation
float sss = pow(max(dot(-lightDir, viewDir), 0.0), 4.0) * thickness;
vec3 result = baseColor + sss * skinColor;
// ~3 extra math ops per pixel. Negligible cost.

// Damage dissolve — silk wrapping spreads across spider surface per hit
// Noise-driven dissolve threshold driven by hitCount uniform

// Tension visualization — silk color shifts as tension float uniform changes
// Slack (0.0) → cool blue. Taut (1.0) → bright white. Critical (>0.9) → red core bleeds in
```

---

## Animation Stack

**GSAP** — choreographed sequences for dramatic moments.

```typescript
// Fake-out death sequence
gsap.timeline()
  .to(warden.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.4, ease: "back.in" })
  .to(wardenLegs, { rotation: Math.PI, stagger: 0.04, duration: 0.3 })
  .call(() => triggerSilkSnapParticles())
  .pause(0.8)
  .call(() => playWardenScreech())
  .to(warden.scale, { x: 2.2, y: 2.2, z: 2.2, duration: 0.15, ease: "elastic.out(1, 0.3)" })
  .to(wardenLegs, { rotation: 0, stagger: 0.02, duration: 0.2 })
```

Used for: hit reactions, phase transitions, fake-out, game over, win sequence.

**Procedural squash/stretch** — on the Warden mesh directly, every frame, driven by velocity:
```typescript
// Stretch toward movement direction, squash perpendicular
warden.scaling.x = 1 + velocity.x * stretchFactor
warden.scaling.y = 1 - Math.abs(velocity.x) * squashFactor
```

---

## Audio Stack

**Tone.js** — synthesized reactive audio. No files.

```
Silk tension drone        Sine oscillator, pitch mapped to tension float (80hz slack → 400hz critical)
Charge buildup            Rising filter sweep on sawtooth during wall slide
Launch burst              Percussive noise hit on release
Wall impact               Short sine thud, pitch varies by wall material
Spider chittering         Fast staccato FM synthesis, rate increases in Frenzied state
Spider exhausted          Low formant drone, slight pitch wobble
```

**Howler.js** — sampled SFX from ElevenLabs.

```
spider_screech.mp3        Warden taking a hit
fakeout_sting.mp3         The moment her leg uncurls
anchor_deploy.mp3         Satisfying thwack on anchor placement
anchor_break.mp3          Snap + debris sound
silk_snap.mp3             Run-ending leash break
victory.mp3               Post-final-hit silence then release
```

The split: Tone for living continuous sound reacting to game state, Howler for discrete dramatic moments.

---

## Post-Processing Stack

Via Babylon's built-in pipeline — no extra library needed:

```
Bloom                     Silk threads and spider eyes glow
Vignette                  Closes in as tension rises toward snap
Chromatic aberration      Activates above 90% tension threshold
Camera shake              On hit, on anchor break, on Warden lunge
FOV pulse                 Subtle breathe tied to Warden emotional state
```

---

## State Management

**Zustand** — shared state between Babylon scene and React UI layer.

```typescript
interface GameStore {
  tension: number           // 0.0 - 1.0, drives audio + shader uniforms
  charge: number            // 0.0 - 1.0, wall slide buildup
  wardenHealth: number      // 0 - 7
  wardenState: WardenState  // Stalking | Frenzied | Cunning | Exhausted
  phase: GamePhase          // Playing | Fakeout | Phase2 | Dead | Win
  anchors: Anchor[]
}
```

Babylon writes it every frame. React HUD reads it reactively. No prop drilling, no context providers.

---

## Visual Design — All Procedural, No Assets

```
Shaft             Dark extruded box geometry. Slight fog increasing with height.
                  Background web strands — static line geometry implying previous victims.
                  Bioluminescent vein patterns on walls — animated sine wave opacity.

Warden            Sphere blob body + 8 cylinder legs. No texture.
                  Point light attached to body — pulses with emotional state color.
                  Stalking: cold blue. Frenzied: hot red. Cunning: dim green. Exhausted: dim white.
                  Legs animate via rotation keyframes — skitter in Cunning, flail on hit, droop in Exhausted.

Player            Small capsule. Silk wrapping visible as tube geometry coiled around it.

Silk rope         3D tube along verlet chain. 50 segments. Lygia iridescence shader.
                  Thickness varies with tension — thins when slack, swells when taut.

Anchors           Spike geometry ejecting from wall. Deploy animation via GSAP scale punch.

Particles         Silk strand burst on hit, anchor break debris, snap explosion.
```

---

## Architecture — Mapping From Box Battle

Your existing Box Battle systems map directly:

| Box Battle | Silk |
|---|---|
| `StateMachine` | Warden behavioral states |
| `EventBroker` | Tension events, hit events, state transitions |
| `ObjectPool<T>` | Anchor pool, particle pool |
| `GameLoop` | Main loop, delta time |
| `InputProvider` | Left / Right / Hold — three inputs |
| `World` | Shaft scene, player, warden, anchor list |
| `SoundSynth` | Replaced by Tone.js but same concept |
| `SaveManager` | High score, best run time |
| Zustand store | Expanded with tension, charge, warden state |

New systems needed:

```
RopeSystem          Rapier verlet chain + Babylon tube mesh sync
AnchorSystem        Placement, drag calculation, break threshold
WallSlideSystem     Contact detection, charge accumulation, release detection
WardenAI            State machine + anchor-reading behavior + phase 2 logic
ShaderUniforms      Tension float → silk shader + post-processing uniforms each frame
```

---

## Dev Tooling

```
Stats.js            FPS + frame time overlay. Always on during dev. Remove before submission.
Leva                Live tuning panel. Expose: tension thresholds, charge rate, warden speed,
                    rope stiffness, squash/stretch factor. Tune feel without restarting.
                    Remove before submission.
Babylon Inspector   Built-in scene debugger. Toggle with Ctrl+Alt+I during dev.
Chrome DevTools     CPU/GPU throttle to 4x slowdown periodically — test on simulated old hardware.
```

---

## npm Install

```bash
npm install babylonjs @babylonjs/core @babylonjs/materials
npm install @dimforge/rapier3d-compat
npm install gsap
npm install tone
npm install howler
npm install zustand
npm install @lygia/glsl
npm install stats.js leva
npm install @types/howler @types/stats.js
```

---

## Bundle Estimate

```
Babylon.js          ~2.5MB
Rapier (WASM)       ~1.2MB
Tone.js             ~300KB
GSAP                ~200KB
Howler.js           ~100KB
Zustand             ~15KB
Lygia (just used)   ~50KB
Stats + Leva        ~200KB (dev only, stripped from build)
─────────────────────────
Total               ~4.4MB production build
```

Load time: 3–4 seconds on average connection. Use a loading screen — silk threads slowly forming, spider silhouette emerging in background. The load screen is part of the experience.

---

## Compatibility

```
Chrome / Edge desktop      Full support — primary target
Firefox desktop            Full support via WebGL2
Safari desktop             Full support via WebGL2
Chrome mobile              Full support
iOS Safari                 Full support via WebGL2
Android browser            Full support via WebGL2
```

No browser warning needed. No Chrome dependency. WebGL2 covers everyone.

---

## Win / Lose

**Win** — hit the Warden 7 times (6 + fake-out). Final hit: slow motion, silk engulfs her completely, she falls past you down the shaft, you're left hanging in silence. The silk slowly goes slack.

**Lose** — leash snaps (tension held too long without anchors) or leash goes slack (Warden escapes shaft top). Both have distinct visual/audio signatures.

---

## What Not To Cut

If time gets tight, cut in this order — but never cut these:

```
KEEP AT ALL COSTS     Wall slide charge + launch (the whole game is this feeling)
KEEP AT ALL COSTS     Warden emotional state lighting (personality = judges remember it)
KEEP AT ALL COSTS     Fake-out (the moment everyone will clip and share)
KEEP AT ALL COSTS     Silk tension audio drone (Tone.js pitch shift — 30 minutes to implement, enormous feel)

CUT IF NEEDED         Elastic and Sticky anchors (ship Standard only)
CUT IF NEEDED         Cunning state (Stalking + Frenzied is enough)
CUT IF NEEDED         Bioluminescent wall veins
CUT IF NEEDED         Howler SFX (Tone.js alone is sufficient)
```
