# SILK — Master Engineering Document
### For: AI Build Session Handoff

> *You are prey. You learned one trick. Use it.*

---

## Document Purpose

This document is the single source of truth for building SILK from scratch. It is written to be handed to a fresh AI session with zero prior context. Everything that session needs — architecture decisions, file naming, phase order, build gates, gameplay mechanics, tuning targets, and AI workflow rules — is in here.

The codebase this project descends from is **BOX BATTLE**, a React 18 / TypeScript / Vite / Zustand 2D arcade game. Many of its core patterns are carried forward directly. SILK diverges in one major dimension: it runs a real-time 3D scene (Babylon.js + Rapier physics) instead of a 2D canvas renderer. Everything that was menu, settings, save slots, and audio configuration in Box Battle is gone. The project boots directly into the game arena.

---

## Non-Negotiables

Read this before touching a single file. Every scope decision defers to this list.

```
NEVER CUT   Wall slide charge + launch         The game is this feeling. Non-negotiable.
NEVER CUT   Warden emotional state lighting    Personality. The one thing judges remember.
NEVER CUT   Fake-out sequence (hit 6 → 7)      The shareable moment. Core to the design.
NEVER CUT   Tone.js silk tension drone         30 min to implement. Enormous feel return.

CUT FIRST   Elastic + Sticky anchors           Ship Standard anchor only if time is short.
CUT SECOND  Warden Cunning state               Stalking + Frenzied is a complete game.
CUT THIRD   Bioluminescent wall veins          Pure visual polish. No gameplay impact.
CUT FOURTH  Howler SFX pack                    Tone.js one-shots alone meet the bar.
```

---

## AI Workflow Rules (Critical — Read Before Writing Code)

These are carried over from Box Battle's `AI_INSTRUCTIONS.txt` and refined for this project. Violating these rules produces broken builds and wasted time.

### 1. Terminal Only

Do not ask the user to manually create or modify files. All file creation and overwriting uses shell heredoc syntax:

```bash
cat << 'EOF' > src/path/to/file.ts
// complete file contents
EOF
```

Always quote the starting heredoc delimiter (`'EOF'` not `EOF`) to prevent shell variable expansion from corrupting TypeScript and GLSL source.

### 2. No Placeholders

Write complete, compilation-safe code. Never use `// ... rest of code here` or stub functions that don't exist. Every function has a body. Every import resolves.

### 3. Phase-Based Stepwise Workflow

Before writing code for any task, outline the phases of work and **wait for confirmation** before outputting code blocks. This is the WAIT protocol. Format:

```
Proposed plan:
Phase A — [description]
Phase B — [description, depends on A]
...
Awaiting your go-ahead.
```

Do not dump all phases at once. Deliver one phase's code, verify it builds and passes its gate, then proceed.

### 4. Verification Checklist After Every Phase

After delivering code, list specific manual checks:
- `npm run dev` — confirm browser renders correctly
- `npm run build` — confirm TypeScript compiles with zero errors
- Specific visual or behavioral checks per phase (defined below in each phase's **Gate** section)

### 5. Atomic Commits on Request

When the user asks for a commit, use exactly:
```bash
git add . && git commit -m "type: title" -m "description" && git push
```

Conventional commit types: `feat`, `fix`, `refactor`, `chore`, `style`. Never include this command unless explicitly requested.

### 6. Surgical Patches for Large Files

When modifying large existing files, write a temporary Node.js patch script rather than a full overwrite:

```bash
cat << 'ENDOFSCRIPT' > ./patch.js
import fs from 'fs';
let c = fs.readFileSync('src/core/GameLoop.ts', 'utf8');
c = c.replace('OLD_EXACT_STRING', 'NEW_STRING');
fs.writeFileSync('src/core/GameLoop.ts', c);
ENDOFSCRIPT
node ./patch.js && rm ./patch.js
```

Always append `&& rm ./patch.js` on the same line. Never leave transient scripts in the repo.

### 7. Zsh Compatibility

Development machine is macOS on Zsh. Never use raw unescaped `!` inside shell string variables. Never include `#` comments inside active terminal code blocks — they cause Zsh parsing failures when pasted. Put explanations in surrounding markdown.

### 8. ESM-Only Node Scripts

`package.json` has `"type": "module"`. All Node.js scripts (`scripts/` directory) use `import` syntax, never `require()`.

### 9. Line Diagnostics First

When debugging a stack trace or an error referencing a specific line, run a quick diagnostic before designing a patch:

```bash
node -e "const f = require('fs').readFileSync('src/core/Engine.ts','utf8'); console.log(f.split('\n').slice(42,50).join('\n'))"
```

Never guess what's at a line number. Read it first.

### 10. WASM-Specific Vite Rules

Rapier ships as WASM. Two required `vite.config.ts` settings that will silently break the build if missing:
- `assetsInlineLimit: 0` — do not inline WASM as base64
- `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']` — prevents pre-bundling

---

## Tech Stack

| Concern | Library | Notes |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Same as Box Battle |
| State | Zustand 5 | Babylon loop writes it, React HUD reads it |
| 3D renderer | Babylon.js 7 (`@babylonjs/core`) | WebGL2. Runs everywhere. |
| Physics | Rapier 3D (`@dimforge/rapier3d-compat`) | WASM. Silk rope + character controller |
| GLSL utilities | Lygia (copied, not npm) | `iridescence.glsl`, `fbm.glsl` only |
| Tweening | GSAP 3 | Dramatic sequences, state transitions |
| Reactive audio | Tone.js | Drone, charge sweep, one-shot synth events |
| Discrete SFX | Howler.js | MP3 bank for impact moments (cuttable) |
| Dev tooling | Stats.js + Leva | FPS overlay + live tuning panel — dev only |

---

## Directory Structure & Naming Conventions

```
silk/
├── docs/
│   ├── AI_INSTRUCTIONS.md        ← this document
│   └── all_source_code.txt       ← auto-generated by create_source_context.js
├── public/
│   ├── audio/                    ← Howler MP3 files (spider_screech.mp3 etc.)
│   ├── all_source_code.txt       ← mirrored for SourceView (optional)
│   ├── favicon.svg
│   └── source_code_manifest.json ← auto-generated
├── scripts/
│   ├── create_source_context.js  ← bundles all source into a single AI context file
│   ├── create_source_context.command  ← double-clickable macOS runner
│   └── generate_manifest.js      ← generates source_code_manifest.json
├── src/
│   ├── babylon/
│   │   ├── BabylonScene.tsx      ← React component — owns canvas ref, mounts engine
│   │   ├── SceneManager.ts       ← Engine + Scene + Camera + Lights init
│   │   ├── PostFXPipeline.ts     ← DefaultRenderingPipeline, CA post-process
│   │   └── CameraShake.ts        ← Trauma-based shake system
│   ├── core/
│   │   ├── GameLoop.ts           ← RAF loop with visibility change handling
│   │   ├── EventBroker.ts        ← Typed pub/sub. Defines all GameEvent enum.
│   │   ├── StateMachine.ts       ← Generic StateMachine<S>. IState interface.
│   │   ├── ObjectPool.ts         ← Generic ObjectPool<T>.
│   │   └── Interfaces.ts         ← Shared types: Vector3Like, AnchorData, etc.
│   ├── input/
│   │   └── InputProvider.ts      ← LEFT / RIGHT / HOLD. Keyboard + touch.
│   ├── physics/
│   │   ├── PhysicsManager.ts     ← Rapier init, world, fixed-step accumulator
│   │   ├── RopeSystem.ts         ← 50-node verlet chain. Babylon tube sync.
│   │   └── CharacterController.ts ← Player Rapier body, wall contact detection
│   ├── systems/
│   │   ├── AnchorSystem.ts       ← Placement, drag calc, break logic, pool mgmt
│   │   ├── WallSlideSystem.ts    ← Charge accumulation, launch trigger
│   │   ├── WardenAI.ts           ← State machine, anchor reading, reel logic
│   │   └── ShaderUniforms.ts     ← Writes tension/time/etc. to shader materials
│   ├── entities/
│   │   ├── Player.ts             ← Player state, hit detection sensor, silk coil mesh
│   │   └── Warden.ts             ← Body + legs + eyes + light. GSAP sequences live here.
│   ├── shaders/
│   │   ├── silk.vertex.glsl
│   │   ├── silk.fragment.glsl
│   │   ├── spider.fragment.glsl
│   │   ├── ca.fragment.glsl      ← Chromatic aberration post-process
│   │   └── lygia/
│   │       ├── iridescence.glsl  ← Copied from Lygia — do not use npm package
│   │       └── fbm.glsl
│   ├── audio/
│   │   ├── ToneEngine.ts         ← Reactive oscillators, reactive to GameStore
│   │   └── HowlerBank.ts         ← Discrete MP3 SFX, event-driven
│   ├── store/
│   │   └── useGameStore.ts       ← Zustand. Single source of reactive truth.
│   ├── ui/
│   │   ├── HUD.tsx               ← Tension bar + charge bar + warden health dots
│   │   ├── HUD.css
│   │   ├── LoadingScreen.tsx     ← Shown during Rapier WASM init
│   │   └── LoadingScreen.css
│   ├── App.tsx                   ← Minimal. Mounts BabylonScene + HUD overlay.
│   ├── App.css
│   ├── index.css                 ← Global reset, body/html full-viewport
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── eslint.config.js
```

### Naming Rules

- **Files**: PascalCase for class files (`RopeSystem.ts`), camelCase for store/hooks (`useGameStore.ts`)
- **Classes**: PascalCase (`class WallSlideSystem`)
- **Instances / singletons**: camelCase (`const ropeSystem = new RopeSystem()`)
- **Interfaces**: PascalCase prefixed with `I` only where disambiguation is needed (`IState`). Otherwise just PascalCase (`GameStore`, `AnchorData`)
- **Events (GameEvent enum)**: `SCREAMING_SNAKE_CASE` (`TENSION_CHANGED`, `HIT_WARDEN`)
- **Constants**: `SCREAMING_SNAKE_CASE` (`CHARGE_RATE`, `SNAP_THRESHOLD`)
- **GLSL uniforms**: `u_` prefix (`u_tension`, `u_time`)
- **GLSL varyings**: `v_` prefix (`v_normal`, `v_position`)
- **Shader files**: lowercase with dots (`silk.fragment.glsl`)
- **CSS classes**: kebab-case (`tension-bar`, `warden-health`)

---

## Source Context Tooling

The `create_source_context.js` script bundles all source files into a single `docs/all_source_code.txt` for feeding into AI sessions. This is a first-class workflow tool — adapt it for SILK exactly as it exists in Box Battle.

### Required Changes from Box Battle Version

In `scripts/create_source_context.js`, update the header banner:

```javascript
content += '┌──────────────────────────────────────────────────┐\n';
content += '│                   SILK ENGINE                    │\n';
content += '│           Babylon.js + Rapier + React            │\n';
content += '└──────────────────────────────────────────────────┘\n';
content += ` [SYSTEM] Generated: ${now}\n`;
content += ` [BASELINE]: 3D WebGL2 via Babylon.js. Verlet rope physics via Rapier WASM.\n\n`;
```

Add `'glsl'` to the `allowedExts` array so shader files are included:

```javascript
const allowedExts = ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md', '.txt', '.command', '.glsl'];
```

Add `'docs'` to the `skippedDirs` array in `generateTree()` to prevent the output file from appearing in its own tree.

### package.json predev/prebuild Hooks

```json
"scripts": {
  "predev": "node scripts/generate_manifest.js && node scripts/create_source_context.js",
  "dev": "vite",
  "prebuild": "node scripts/generate_manifest.js && node scripts/create_source_context.js",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

This ensures the context file is always fresh before any dev or build run. Running `npm run dev` at the start of every session produces an up-to-date `docs/all_source_code.txt` that can be dropped directly into a new AI chat.

---

## Configuration Files

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/silk/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 6503,
    strictPort: true,
  },
  assetsInlineLimit: 0,
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react'
            if (id.includes('@babylonjs'))                           return 'vendor-babylon'
            if (id.includes('rapier'))                              return 'vendor-rapier'
            if (id.includes('gsap'))                                return 'vendor-gsap'
            if (id.includes('tone'))                                return 'vendor-tone'
            if (id.includes('howler'))                              return 'vendor-howler'
            if (id.includes('zustand'))                             return 'vendor-zustand'
          }
        }
      }
    },
    chunkSizeWarningLimit: 2000,
  }
})
```

Note: `assetsInlineLimit: 0` and `optimizeDeps.exclude` are not optional. Without them, Rapier WASM will fail silently.

### tsconfig.app.json

```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

---

## Phase Overview

Build in strict order. Each phase has a **Gate** — a set of specific checks that must pass before moving to the next phase. Do not skip gates.

```
Phase 0   Project Initialization      Blank Babylon scene renders in browser
Phase 1   Core Infrastructure         GameLoop / EventBroker / StateMachine / ObjectPool / InputProvider
Phase 2   Zustand Store               Store wired. No gameplay yet.
Phase 3   Scene Construction          Shaft + Warden + Player geometry visible. Camera correct.
Phase 4   Physics Foundation          Rapier initialized. Rope sags under gravity.
Phase 5   Player Character            Player moves left/right. Wall contact detected.
Phase 6   Wall Slide + Launch         The core loop. Player can slingshot. Iterate until it feels right.
Phase 7   Anchor System               Anchors deploy, contact rope, increase charge rate, break.
Phase 8   Warden AI                   All states active. Lighting changes. Legs animate.
Phase 9   Hit Detection & Damage      7 hits to kill. Fake-out fires. Phase 2 activates.
Phase 10  Silk Shader                 Rope color/thickness reacts to tension.
Phase 11  Spider Shader               SSS approximation. Damage dissolve per hit.
Phase 12  Audio Layer                 Tension drone + charge sweep + one-shot events.
Phase 13  Post-Processing             Bloom + vignette + chromatic aberration + camera shake.
Phase 14  HUD Layer                   Tension bar + charge bar + warden health dots.
Phase 15  Win / Lose Flows            Both endings complete. Game is soft-restartable.
Phase 16  Dev Tooling + Final Pass    Leva panel. Stats.js. 30-minute feel improvements.
```

---

## Phase 0 — Project Initialization

**Goal:** Repo initialized. Dependencies installed. Blank Babylon scene renders in browser with no console errors.

### 0.1 — Initialize Repo

```bash
npm create vite@latest silk -- --template react-ts
cd silk
git init && git add . && git commit -m "chore: initial vite scaffold"
```

### 0.2 — Install Dependencies

```bash
npm install @babylonjs/core @babylonjs/materials @babylonjs/loaders
npm install @dimforge/rapier3d-compat
npm install gsap
npm install tone
npm install howler
npm install zustand
npm install framer-motion
npm install stats.js leva
npm install @types/howler @types/stats.js
```

Note: `framer-motion` is included for Warden health dot animations in the HUD. If it adds too much weight, substitute CSS transitions.

### 0.3 — Scaffold Directory Structure

Create all directories up front. This prevents import errors from missing paths during early development:

```bash
mkdir -p src/babylon src/core src/input src/physics src/systems src/entities src/shaders/lygia src/audio src/store src/ui docs public/audio scripts
```

### 0.4 — Copy Lygia Shader Utilities

Download only two files from the Lygia repository and place them at `src/shaders/lygia/`:
- `color/iridescence.glsl`
- `generative/fbm.glsl`

Do not install the Lygia npm package. It requires a build pipeline step that introduces unnecessary complexity.

### 0.5 — Blank Scene Smoke Test

Create `src/babylon/BabylonScene.tsx`:
- React component. Owns a `<canvas>` ref.
- On `useEffect` mount: initialize `Engine`, `Scene`, a `FreeCamera` looking down +Y axis, one `HemisphericLight`.
- Place one `MeshBuilder.CreateBox({ size: 1 })` at origin.
- `engine.runRenderLoop(() => scene.render())`.
- On unmount: `engine.dispose()`.

**Gate:**
```
npm run dev
```
- Box visible in browser at `localhost:6503/silk/`
- DevTools console: zero errors, zero WASM warnings
- FPS counter (Stats.js is not yet wired — estimate from browser tab)

---

## Phase 1 — Core Infrastructure

**Goal:** `GameLoop`, `EventBroker`, `StateMachine`, `ObjectPool`, and `InputProvider` implemented and exported. No gameplay yet. These are the skeleton everything hangs on.

These patterns are ported directly from Box Battle. Do not reinvent them.

### 1.1 — GameLoop (`src/core/GameLoop.ts`)

```typescript
class GameLoop {
  private lastTime: number = 0
  private rafId: number | null = null
  private isRunning: boolean = false

  constructor(
    private onUpdate: (dt: number) => void,
    private onRender: () => void
  ) {
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  stop() {
    this.isRunning = false
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  private loop = (currentTime: number) => {
    if (!this.isRunning) return
    let dt = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime
    if (dt > 0.05) dt = 0.05  // 20fps floor — Rapier explodes on large dt spikes
    this.onUpdate(dt)
    this.onRender()
    this.rafId = requestAnimationFrame(this.loop)
  }

  private handleVisibilityChange = () => {
    if (document.hidden) this.stop()
    else this.start()
  }

  cleanup() {
    this.stop()
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
  }
}

export default GameLoop
```

The `dt` cap of `0.05` (20fps floor) is critical. Without it, Rapier joints snap on tab-switch recovery.

### 1.2 — EventBroker (`src/core/EventBroker.ts`)

Define all event names as a const object first. Add new entries here as new systems need them — never use raw string events.

```typescript
export const GameEvent = {
  TENSION_CHANGED:      'TENSION_CHANGED',
  CHARGE_CHANGED:       'CHARGE_CHANGED',
  HIT_WARDEN:           'HIT_WARDEN',
  ANCHOR_PLACED:        'ANCHOR_PLACED',
  ANCHOR_BROKEN:        'ANCHOR_BROKEN',
  LAUNCH:               'LAUNCH',
  WALL_CONTACT:         'WALL_CONTACT',
  LEASH_SNAP:           'LEASH_SNAP',
  WARDEN_STATE_CHANGED: 'WARDEN_STATE_CHANGED',
  PHASE_CHANGED:        'PHASE_CHANGED',
  WARDEN_LUNGE:         'WARDEN_LUNGE',
  DEBRIS_SPAWNED:       'DEBRIS_SPAWNED',
} as const

export type GameEventName = typeof GameEvent[keyof typeof GameEvent]
```

The broker class: typed `on` / `emit` / `off`. Every `on()` returns an unsubscribe function — required to prevent memory leaks inside the game loop context.

```typescript
type Handler<T> = (payload: T) => void

class EventBroker {
  private listeners: Map<string, Set<Handler<unknown>>> = new Map()

  on<T>(event: GameEventName, handler: Handler<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    const set = this.listeners.get(event)!
    set.add(handler as Handler<unknown>)
    return () => set.delete(handler as Handler<unknown>)
  }

  emit<T>(event: GameEventName, payload?: T): void {
    this.listeners.get(event)?.forEach(h => h(payload as unknown))
  }

  clear() { this.listeners.clear() }
}

export const eventBroker = new EventBroker()
```

Export a singleton instance. All systems import `{ eventBroker }`.

### 1.3 — StateMachine (`src/core/StateMachine.ts`)

Ported from Box Battle. Generic `IState` interface. Guards against self-transitions.

```typescript
export interface IState {
  enter(): void
  update(dt: number): void
  exit(): void
}

export class StateMachine {
  private currentState: IState | null = null

  changeState(newState: IState): void {
    if (newState === this.currentState) return
    this.currentState?.exit()
    this.currentState = newState
    this.currentState.enter()
  }

  update(dt: number): void {
    this.currentState?.update(dt)
  }

  getCurrentState(): IState | null {
    return this.currentState
  }
}
```

### 1.4 — ObjectPool (`src/core/ObjectPool.ts`)

Ported from Box Battle. Used for anchor meshes and particle bursts.

```typescript
export class ObjectPool<T> {
  private pool: T[] = []
  private active: Set<T> = new Set()

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory())
    }
  }

  acquire(): T {
    const obj = this.pool.pop() ?? this.factory()
    this.active.add(obj)
    return obj
  }

  release(obj: T): void {
    if (!this.active.has(obj)) return
    this.active.delete(obj)
    this.reset(obj)
    this.pool.push(obj)
  }

  getActive(): Set<T> { return this.active }

  releaseAll(): void {
    this.active.forEach(obj => this.release(obj))
  }
}
```

Allocate pools at startup: `20` anchor meshes, `200` particle instances. Zero runtime allocation during play.

### 1.5 — InputProvider (`src/input/InputProvider.ts`)

Three logical inputs: `LEFT`, `RIGHT`, `HOLD`. Nothing else. This simplicity is a feature.

```typescript
export type Input = 'LEFT' | 'RIGHT' | 'HOLD'

class InputProvider {
  private current: Record<Input, boolean> = { LEFT: false, RIGHT: false, HOLD: false }
  private previous: Record<Input, boolean> = { LEFT: false, RIGHT: false, HOLD: false }

  isDown(input: Input): boolean           { return this.current[input] }
  wasJustPressed(input: Input): boolean   { return this.current[input] && !this.previous[input] }
  wasJustReleased(input: Input): boolean  { return !this.current[input] && this.previous[input] }

  update(): void {
    // Keyboard bindings
    // Set current state from keyboard — keys registered in init()
  }

  postUpdate(): void {
    Object.assign(this.previous, this.current)
  }

  // Call update() at start of each fixed step.
  // Call postUpdate() at end of each fixed step.
  // wasJustPressed/Released are only valid between update() and postUpdate().
}

export const inputProvider = new InputProvider()
```

Keyboard mappings: `A`/`←` = LEFT, `D`/`→` = RIGHT, `Space`/`S`/`↓` = HOLD.

Touch zones: Left 33% of screen = LEFT, Right 33% = RIGHT, Center 33% = HOLD. Implement with `pointerdown`/`pointerup` listeners. Use `touchAction: 'none'` on the canvas element to prevent scroll interference.

`wasJustReleased(HOLD)` while on wall is the launch trigger. The timing of this single event drives the entire core loop.

**Gate:**
```
npm run build
```
- Zero TypeScript errors
- Console log from `BabylonScene.tsx` confirms `inputProvider.wasJustPressed('HOLD')` fires on spacebar press

---

## Phase 2 — Zustand Store

**Goal:** Game state store defined. Babylon systems will write it every frame. React HUD will read it reactively.

`src/store/useGameStore.ts`:

```typescript
import { create } from 'zustand'

export type WardenState = 'Stalking' | 'Frenzied' | 'Cunning' | 'Exhausted'
export type GamePhase = 'Loading' | 'Playing' | 'Fakeout' | 'Phase2' | 'Dead' | 'Win'

export interface AnchorData {
  id: string
  position: { x: number; y: number; z: number }
  dragValue: number
  pullsRemaining: number
}

interface GameStore {
  tension: number
  charge: number
  wardenHealth: number
  wardenState: WardenState
  phase: GamePhase
  anchors: AnchorData[]
  isInputEnabled: boolean

  setTension: (v: number) => void
  setCharge: (v: number) => void
  damageWarden: () => void
  setWardenState: (s: WardenState) => void
  setPhase: (p: GamePhase) => void
  placeAnchor: (a: AnchorData) => void
  removeAnchor: (id: string) => void
  setInputEnabled: (v: boolean) => void
  resetGame: () => void
}

const initialState = {
  tension: 0,
  charge: 0,
  wardenHealth: 7,
  wardenState: 'Stalking' as WardenState,
  phase: 'Loading' as GamePhase,
  anchors: [],
  isInputEnabled: false,
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setTension: (v) => set({ tension: Math.max(0, Math.min(1, v)) }),
  setCharge:  (v) => set({ charge: Math.max(0, Math.min(1, v)) }),

  damageWarden: () => {
    const h = get().wardenHealth - 1
    set({ wardenHealth: Math.max(0, h) })
  },

  setWardenState: (s) => set({ wardenState: s }),
  setPhase:       (p) => set({ phase: p }),

  placeAnchor: (a) => set((state) => ({
    anchors: [...state.anchors, a].slice(-4)  // max 4 anchors active
  })),

  removeAnchor: (id) => set((state) => ({
    anchors: state.anchors.filter(a => a.id !== id)
  })),

  setInputEnabled: (v) => set({ isInputEnabled: v }),

  resetGame: () => set({ ...initialState, phase: 'Playing', isInputEnabled: true }),
}))
```

**Critical rule:** Babylon systems call `useGameStore.getState().setTension(v)` directly (not the React hook). The React hook `useGameStore(s => s.tension)` is only used inside React components. This is the bridge that keeps Babylon and React decoupled.

**Gate:**
```
npm run build
```
Zero TypeScript errors. Store imports correctly in a test console log.

---

## Phase 3 — Scene Construction

**Goal:** The shaft exists. Warden and player meshes are visible. Camera is positioned correctly. No physics yet — pure geometry.

### 3.1 — Shaft Walls

Two tall `MeshBuilder.CreateBox` panels:
- Dimensions: `width: 2, height: 40, depth: 2`
- Left wall at `x: -4`, right wall at `x: 4`
- Playing space between walls: `6 units`
- Material: dark near-black. `StandardMaterial` with `diffuseColor: Color3(0.05, 0.04, 0.08)` (deep purple-grey)
- `wall.checkCollisions = false` — Rapier handles all collision

Fog:
```typescript
scene.fogMode = Scene.FOGMODE_LINEAR
scene.fogStart = 18
scene.fogEnd = 38
scene.fogColor = new Color3(0.03, 0.02, 0.05)
```

Background web strands (visual only):
```typescript
// 8–10 CreateLines instances with random points between walls
// Semi-transparent white line material (alpha: 0.15)
// Static — never update after creation
```

Bioluminescent wall veins (cut if time is tight):
```typescript
// AnimatedSine opacity on thin tube meshes embedded in walls
// Opacity cycles: Math.sin(time * 0.8 + phaseOffset) * 0.15 + 0.05
```

### 3.2 — Warden Mesh (`src/entities/Warden.ts`)

All procedural — no texture files.

```typescript
// Body
const body = MeshBuilder.CreateSphere('wardenBody', { diameter: 1.2, segments: 10 }, scene)
body.position.y = 35

// Eyes — self-illuminating emissive material
const eyeMat = new StandardMaterial('eyeMat', scene)
eyeMat.emissiveColor = new Color3(0.6, 0.8, 1.0)
const eye1 = MeshBuilder.CreateSphere('eye1', { diameter: 0.15 }, scene)
const eye2 = MeshBuilder.CreateSphere('eye2', { diameter: 0.15 }, scene)
eye1.parent = body
eye2.parent = body
eye1.position = new Vector3(-0.22, 0.1, -0.45)
eye2.position = new Vector3( 0.22, 0.1, -0.45)

// Emotional state point light — this is the Warden's personality
const wardenLight = new PointLight('wardenLight', Vector3.Zero(), scene)
wardenLight.parent = body
wardenLight.diffuse = new Color3(0.2, 0.4, 1.0)  // cold blue — Stalking default
wardenLight.intensity = 1.2

// 8 legs — cylinders parented to body, arranged radially
const legs: Mesh[] = []
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2
  const leg = MeshBuilder.CreateCylinder(`leg${i}`, { diameter: 0.08, height: 1.4 }, scene)
  leg.parent = body
  leg.position = new Vector3(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5)
  leg.rotation.z = angle + Math.PI / 2
  legs.push(leg)
}
```

Store `legs`, `body`, and `wardenLight` as class properties on `Warden` — animation and AI systems need direct access.

### 3.3 — Player Mesh (`src/entities/Player.ts`)

```typescript
const playerMesh = MeshBuilder.CreateCapsule('player', { height: 0.6, radius: 0.18, tessellation: 8 }, scene)
playerMesh.position.y = 2
```

Silk coil wrapping (visual only for now):
```typescript
// 3–4 CreateTube instances with coiled path around the capsule
// Static in Phase 3 — shader will animate tension in Phase 10
```

### 3.4 — Camera

`ArcRotateCamera` locked to look up the shaft, following the player:

```typescript
const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.2, 8, Vector3.Zero(), scene)
camera.lowerRadiusLimit = 8
camera.upperRadiusLimit = 8
camera.lowerBetaLimit = Math.PI / 2.2
camera.upperBetaLimit = Math.PI / 2.2
```

Each frame in the render loop:
```typescript
// Smooth camera Y follow — lerp toward player
const targetY = playerMesh.position.y + 2
camera.target.y += (targetY - camera.target.y) * 0.08
```

This `0.08` lerp factor creates a slight lag that makes the shaft feel tall. Tune upward if it feels unresponsive.

**Gate:**
```
npm run dev
```
- Shaft walls visible and dark
- Warden blob at top with 8 visible legs and two eye glows
- Faint point light illuminating walls around Warden position
- Player capsule at bottom
- Camera looking up the shaft
- Fog visible in upper shaft section

---

## Phase 4 — Physics Foundation

**Goal:** Rapier initialized and stepping. Silk rope simulating between player and a fixed top point. Rope visibly sags under gravity.

### 4.1 — Rapier Init (`src/physics/PhysicsManager.ts`)

```typescript
import RAPIER from '@dimforge/rapier3d-compat'

export class PhysicsManager {
  public world!: RAPIER.World
  private accumulator = 0
  private readonly fixedStep = 1 / 60

  async init(): Promise<void> {
    await RAPIER.init()
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = this.fixedStep
  }

  step(dt: number): void {
    this.accumulator += dt
    if (this.accumulator > 0.25) this.accumulator = 0.25  // spiral of death guard
    while (this.accumulator >= this.fixedStep) {
      this.world.step()
      this.accumulator -= this.fixedStep
    }
  }
}

export const physicsManager = new PhysicsManager()
```

Await `physicsManager.init()` in `BabylonScene.tsx` before calling `GameLoop.start()`. The `LoadingScreen` component displays during this async init.

### 4.2 — Rope System (`src/physics/RopeSystem.ts`)

The most complex physics object in the project. Build carefully and test at each sub-step.

**Rapier side — 50-node verlet chain:**

```typescript
const NODE_COUNT = 50
const ropeNodes: RAPIER.RigidBody[] = []

// First node: kinematic — anchored to Warden position
const wardenNodeDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(0, 35, 0)
ropeNodes[0] = world.createRigidBody(wardenNodeDesc)

// Interior nodes: dynamic, low mass
for (let i = 1; i < NODE_COUNT - 1; i++) {
  const t = i / (NODE_COUNT - 1)
  const nodeDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 35 - t * 33, 0)
    .setAdditionalMass(0.02)
    .setLinearDamping(2.0)
  ropeNodes[i] = world.createRigidBody(nodeDesc)
  world.createCollider(RAPIER.ColliderDesc.ball(0.04), ropeNodes[i])
}

// Last node: kinematic — anchored to Player position
const playerNodeDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
  .setTranslation(0, 2, 0)
ropeNodes[NODE_COUNT - 1] = world.createRigidBody(playerNodeDesc)

// Spherical joints connecting consecutive nodes
for (let i = 0; i < NODE_COUNT - 1; i++) {
  const joint = RAPIER.JointData.spherical(
    { x: 0, y: -0.33, z: 0 },  // anchor on body A — segment rest length
    { x: 0, y:  0.33, z: 0 }   // anchor on body B
  )
  world.createImpulseJoint(joint, ropeNodes[i], ropeNodes[i + 1], true)
}
```

**Babylon side — tube mesh:**

```typescript
// Initial path
const ropePath: Vector3[] = ropeNodes.map(n => {
  const t = n.translation()
  return new Vector3(t.x, t.y, t.z)
})

// Create tube with updatable: true — critical for per-frame rebuild
let ropeMesh = MeshBuilder.CreateTube('rope', {
  path: ropePath,
  radius: 0.04,
  tessellation: 6,
  updatable: true,
}, scene)
```

Each frame in `RopeSystem.update()`:
```typescript
// 1. Update kinematic node positions
const wardenT = wardenBody.position  // from Warden entity
const playerT = playerMesh.position  // from Player entity
ropeNodes[0].setNextKinematicTranslation(wardenT)
ropeNodes[NODE_COUNT - 1].setNextKinematicTranslation(playerT)

// 2. Read all node positions
const newPath: Vector3[] = ropeNodes.map(n => {
  const t = n.translation()
  return new Vector3(t.x, t.y, t.z)
})

// 3. Rebuild tube mesh (updatable mode — no new mesh allocation)
ropeMesh = MeshBuilder.CreateTube('rope', {
  path: newPath,
  radius: this.computeRopeRadius(),  // 0.04 base, grows with tension
  tessellation: 6,
  updatable: true,
  instance: ropeMesh,
}, scene)

// 4. Compute tension value
this.tensionValue = this.computeTension()
useGameStore.getState().setTension(this.tensionValue)
```

**Tension computation:**
```typescript
private computeTension(): number {
  const REST_LENGTH = 33  // initial total rope length
  let totalLength = 0
  for (let i = 0; i < NODE_COUNT - 1; i++) {
    const a = ropeNodes[i].translation()
    const b = ropeNodes[i + 1].translation()
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    totalLength += Math.sqrt(dx*dx + dy*dy + dz*dz)
  }
  return Math.min(totalLength / REST_LENGTH, 1.2)  // allow brief overshoot before snap
}
```

Emit `TENSION_CHANGED` via `eventBroker` when tension crosses 0.1 thresholds. This is what drives the audio drone pitch.

If `tensionValue >= SNAP_THRESHOLD (0.95)`: emit `LEASH_SNAP` and trigger the lose sequence.

**Gate:**
```
npm run dev
```
- Rope visibly sags in a curve between two fixed points
- Rope nodes respond to gravity (swings slightly when one end is moved)
- Console logs tension value increasing when rope is stretched
- No physics explosions (nodes do not fly off to infinity)

---

## Phase 5 — Player Character Controller

**Goal:** Player moves left/right on pendulum swing. Wall contact is detected. The rope constrains swing radius naturally.

### 5.1 — Rapier Character Controller (`src/physics/CharacterController.ts`)

```typescript
const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(0, 2, 0)
  .setAdditionalMass(1.0)
  .setLinearDamping(0.5)
playerBody = world.createRigidBody(playerBodyDesc)
playerCollider = world.createCollider(
  RAPIER.ColliderDesc.capsule(0.3, 0.18).setRestitution(0.1).setFriction(0.8),
  playerBody
)

// Sensor collider for hit detection (larger than physics collider)
hitSensor = world.createCollider(
  RAPIER.ColliderDesc.ball(0.35).setSensor(true),
  playerBody
)
```

Character controller for wall detection:
```typescript
const controller = world.createCharacterController(0.01)
controller.setUp({ x: 0, y: 1, z: 0 })
controller.setApplyImpulsesToDynamicBodies(true)
```

Each physics step:
```typescript
isOnWallLeft  = false
isOnWallRight = false

// Check contact events
world.contactsWith(playerCollider, (otherCollider) => {
  const manifold = world.contactPair(playerCollider, otherCollider, false)
  if (!manifold) return
  const normal = manifold.localNormal1()
  if (normal.x > 0.7)  isOnWallLeft  = true
  if (normal.x < -0.7) isOnWallRight = true
})

isOnWall = isOnWallLeft || isOnWallRight
```

Expose as public state: `isOnWall`, `isOnWallLeft`, `isOnWallRight`, `wallNormal`.

### 5.2 — Pendulum Swing Forces

In `CharacterController.update(dt)`:

```typescript
const LATERAL_FORCE = 8.0
const LATERAL_DAMPING = 0.92

if (!isOnWall) {
  if (inputProvider.isDown('LEFT'))  playerBody.applyImpulse({ x: -LATERAL_FORCE * dt, y: 0, z: 0 }, true)
  if (inputProvider.isDown('RIGHT')) playerBody.applyImpulse({ x:  LATERAL_FORCE * dt, y: 0, z: 0 }, true)

  // Damping on no input — slight swing persistence
  if (!inputProvider.isDown('LEFT') && !inputProvider.isDown('RIGHT')) {
    const vel = playerBody.linvel()
    playerBody.setLinvel({ x: vel.x * LATERAL_DAMPING, y: vel.y, z: vel.z }, true)
  }
}
```

The rope naturally constrains swing radius via Rapier joint stiffness. Do not manually clamp position.

### 5.3 — Babylon Mesh Sync

Each frame after `physicsManager.step()`:
```typescript
const pt = playerBody.translation()
playerMesh.position.set(pt.x, pt.y, pt.z)

const pr = playerBody.rotation()
playerMesh.rotationQuaternion = new Quaternion(pr.x, pr.y, pr.z, pr.w)
```

**Gate:**
```
npm run dev
```
- Player capsule swings left/right with A/D or arrow keys
- Rope constrains swing — player cannot move past walls
- Wall contact correctly detected (console log `isOnWall: true`)
- No rope explosion on normal play

---

## Phase 6 — Wall Slide + Launch

**This is the core of the game.** Budget the most iteration time here. The slingshot launch must feel viscerally satisfying — weighty, punchy, with clear telegraphing. Do not proceed to Phase 7 until the launch feels correct.

### 6.1 — WallSlideSystem (`src/systems/WallSlideSystem.ts`)

```typescript
const CHARGE_RATE = 0.6        // tune via Leva
const LAUNCH_THRESHOLD = 0.4   // minimum charge for a full launch
const FLING_THRESHOLD = 0.05   // minimum for a quick fling
const LAUNCH_BASE_FORCE = 15.0
const LAUNCH_CHARGE_SCALE = 25.0
const SNAP_HOLD_TIME = 0.08    // max time between press+release to register as tap-fling

class WallSlideSystem {
  private charge = 0
  private holdTimer = 0
  private wasHolding = false

  update(dt: number) {
    const { isOnWall } = charController
    const store = useGameStore.getState()
    if (!store.isInputEnabled) return

    const holdDown = inputProvider.isDown('HOLD')
    const justReleased = inputProvider.wasJustReleased('HOLD')

    if (isOnWall && holdDown) {
      // Accelerating charge rate — slow at first, faster near end
      // This creates urgency and communicates the snap threshold naturally
      const accelerationCurve = 1.0 + this.charge * 0.8
      const dragMultiplier = anchorSystem.calculateDragMultiplier()
      this.charge += CHARGE_RATE * accelerationCurve * dragMultiplier * dt
      this.charge = Math.min(this.charge, 1.0)
      this.holdTimer += dt
      this.wasHolding = true
      store.setCharge(this.charge)
      eventBroker.emit(GameEvent.CHARGE_CHANGED, this.charge)

    } else if (justReleased) {
      if (isOnWall || this.wasHolding) {
        if (this.holdTimer < SNAP_HOLD_TIME && this.charge < LAUNCH_THRESHOLD) {
          this.triggerQuickFling()
        } else if (this.charge >= LAUNCH_THRESHOLD) {
          this.triggerLaunch(this.charge)
        }
      }
      this.charge = 0
      this.holdTimer = 0
      this.wasHolding = false
      store.setCharge(0)

    } else if (!holdDown) {
      this.wasHolding = false
      this.holdTimer = 0
    }
  }
```

**Charge rate improvements over the original spec:**
The `accelerationCurve = 1.0 + this.charge * 0.8` makes charge build slowly at first and accelerate as it fills. This mirrors the physical sensation of silk under increasing tension. The snap threshold becomes self-communicating — the player feels the rate accelerate, knows they're close.

### 6.2 — Launch

```typescript
  private triggerLaunch(chargeAmount: number) {
    const wardenPos = wardenEntity.getPosition()
    const playerPos = playerBody.translation()

    const dx = wardenPos.x - playerPos.x
    const dy = wardenPos.y - playerPos.y
    const dist = Math.sqrt(dx*dx + dy*dy) || 1
    const dirX = dx / dist
    const dirY = dy / dist

    const force = LAUNCH_BASE_FORCE + chargeAmount * LAUNCH_CHARGE_SCALE

    // 2-frame hitstop before launch — body builder moment
    setTimeout(() => {
      playerBody.applyImpulse({ x: dirX * force, y: dirY * force, z: 0 }, true)
      ropeSystem.detachPlayerEnd(0.3)   // brief free-flight window
    }, 33)

    useGameStore.getState().setInputEnabled(false)
    eventBroker.emit(GameEvent.LAUNCH, { charge: chargeAmount })
    cameraShake.addTrauma(chargeAmount * 0.4)

    // Re-enable input after brief flight window
    setTimeout(() => {
      ropeSystem.reattachPlayerEnd()
      useGameStore.getState().setInputEnabled(true)
    }, 500)
  }
```

**Quick fling:**
```typescript
  private triggerQuickFling() {
    const wardenPos = wardenEntity.getPosition()
    const playerPos = playerBody.translation()
    // ...normalize direction...
    playerBody.applyImpulse({ x: dirX * 6, y: dirY * 6, z: 0 }, true)
    // Burns tiny tension — signal this costs something
    const t = useGameStore.getState().tension
    useGameStore.getState().setTension(Math.min(t + 0.05, 1.0))
  }
```

### 6.3 — Hit Detection on Launch

During the launch window (`isInputEnabled === false` after launch):
```typescript
// Each physics step
world.intersectionsWith(hitSensor, (otherCollider) => {
  if (otherCollider === wardenHitSensor) {
    eventBroker.emit(GameEvent.HIT_WARDEN, {})
    useGameStore.getState().damageWarden()
    cameraShake.addTrauma(0.6)
    // Brief input lockout — stun window
    setTimeout(() => useGameStore.getState().setInputEnabled(true), 400)
  }
})
```

On `HIT_WARDEN`: Warden receives knockback impulse. `GSAP.to(wardenBody.position, { y: '-=3', duration: 0.3, ease: 'back.out(1.7)' })`.

**Gate:**
```
npm run dev
```
Verification sequence:
1. Swing left into wall, hold spacebar — charge bar fills
2. Release — player launches toward Warden
3. Contact with Warden mesh registers (console log `HIT_WARDEN`)
4. Warden briefly knocked back
5. Player returns to pendulum state
6. Repeat — loop is playable

Do not proceed until this sequence feels satisfying. Tune `LAUNCH_BASE_FORCE`, `LAUNCH_CHARGE_SCALE`, and `LATERAL_FORCE` until the launch has genuine weight and the hit registers with impact.

---

## Phase 7 — Anchor System

**Goal:** Player places anchors that redirect silk and increase charge buildup rate. Anchors break after Warden pulls.

### 7.1 — AnchorSystem (`src/systems/AnchorSystem.ts`)

Anchor placement fires mid-air (while not on wall) when `inputProvider.wasJustPressed('HOLD')`:

```typescript
placeAnchor(): void {
  if (charController.isOnWall) return
  if (useGameStore.getState().anchors.length >= 4) this.removeOldestAnchor()

  const ray = new RAPIER.Ray(
    playerBody.translation(),
    this.getNearestWallDirection()  // ±X toward whichever wall is closer
  )
  const hit = physicsManager.world.castRay(ray, 10, true)
  if (!hit) return

  const hitPoint = ray.pointAt(hit.timeOfImpact)
  const anchorId = `anchor_${Date.now()}`

  // Acquire from pool
  const anchorMesh = anchorPool.acquire()
  anchorMesh.position.set(hitPoint.x, hitPoint.y, hitPoint.z)
  anchorMesh.setEnabled(true)

  // Deploy animation
  gsap.from(anchorMesh.scaling, { x: 0, y: 0, z: 0, duration: 0.12, ease: 'back.out(2)' })

  const pullsRemaining = wardenAI.currentState === 'Frenzied' ? 1 : 3

  useGameStore.getState().placeAnchor({
    id: anchorId,
    position: hitPoint,
    dragValue: this.computeDragValue(hit),
    pullsRemaining,
  })

  this.anchorMeshMap.set(anchorId, anchorMesh)
  eventBroker.emit(GameEvent.ANCHOR_PLACED, { anchorId })
}
```

**Drag value computation:**
```typescript
private computeDragValue(hit: RAPIER.RayColliderHit): number {
  let base = 0.3
  // Hard-to-reach spots (steep wall angles, near shaft ceiling) give bonus drag
  const normal = hit.normal
  const steepness = Math.abs(normal.y)
  if (steepness > 0.45) base += 0.25  // overhanging geometry bonus
  return base
}
```

**calculateDragMultiplier (called by WallSlideSystem):**
```typescript
calculateDragMultiplier(): number {
  const anchors = useGameStore.getState().anchors
  const ropeNodePositions = ropeSystem.getNodePositions()
  const activeAnchors = anchors.filter(a => this.isContactingRope(a, ropeNodePositions))
  return 1.0 + activeAnchors.reduce((sum, a) => sum + a.dragValue, 0)
}
```

### 7.2 — Anchor Break

Called from `WardenAI.update()` each time the Warden reels in past an anchor position:
```typescript
breakAnchor(anchorId: string): void {
  useGameStore.getState().removeAnchor(anchorId)
  const mesh = this.anchorMeshMap.get(anchorId)
  if (!mesh) return
  gsap.to(mesh.scaling, { x: 0, y: 0, z: 0, duration: 0.15, ease: 'power2.in', onComplete: () => {
    anchorPool.release(mesh)
  }})
  this.anchorMeshMap.delete(anchorId)
  eventBroker.emit(GameEvent.ANCHOR_BROKEN, { anchorId })
}
```

**Gate:**
```
npm run dev
```
- Mid-air spacebar press fires anchor to nearest wall
- Anchor deploy animation plays (scale punch)
- Charge builds measurably faster with 2+ anchors placed
- Anchors disappear (with break animation) after Warden reel-in passes them
- Max 4 anchors — 5th placement removes oldest

---

## Phase 8 — Warden AI

**Goal:** The Warden has four behavioral states. She reads anchor placement. Her lighting changes with emotional state. Legs animate per state.

### 8.1 — WardenAI (`src/systems/WardenAI.ts`)

Use `StateMachine` from Phase 1. Define state classes:

```
StalkingtState   Default. Steady reel. Reads anchor pattern every 3s.
FrenziedState    Fast reel. Drops debris. Breaks anchors aggressively.
CunningState     Slow reel. Routes around anchor web. Dims. (Cut if pressed)
ExhaustedState   Very slow. Vulnerable. Legs droop. 2× charge rate for player.
```

**Reel-in mechanics:**

The "leash shortening" is implemented by moving the Warden body toward the top of the shaft at the given reel speed, while the rope's top kinematic node follows the Warden body position each frame. This naturally tightens the rope.

```typescript
update(dt: number) {
  this.stateMachine.update(dt)

  // Move Warden upward at reel speed (she's pulling player up)
  // Note: Warden moves UP — she's at top of shaft, pulling you toward her nest
  wardenBody.position.y = Math.min(wardenBody.position.y + this.reelSpeed * dt, SHAFT_TOP - 1)

  // Squash/stretch procedural
  const vel = wardenRigidBody.linvel()
  wardenMesh.scaling.x = 1 + vel.x * STRETCH_FACTOR
  wardenMesh.scaling.y = 1 - Math.abs(vel.x) * SQUASH_FACTOR
  wardenMesh.scaling.z = 1 - Math.abs(vel.z) * SQUASH_FACTOR
  // Lerp back toward 1
  wardenMesh.scaling.x += (1 - wardenMesh.scaling.x) * 0.15
  wardenMesh.scaling.y += (1 - wardenMesh.scaling.y) * 0.15

  // Check lose condition
  if (playerMesh.position.y >= wardenBody.position.y - 1.5) {
    eventBroker.emit(GameEvent.LEASH_SNAP, {})  // treat as lose
  }
}
```

### 8.2 — Emotional State Lighting

```typescript
const wardenLightColors: Record<WardenState, Color3> = {
  Stalking:  new Color3(0.2, 0.4, 1.0),
  Frenzied:  new Color3(1.0, 0.15, 0.1),
  Cunning:   new Color3(0.1, 0.6, 0.15),
  Exhausted: new Color3(0.7, 0.7, 0.7),
}
const wardenLightIntensity: Record<WardenState, number> = {
  Stalking: 1.2, Frenzied: 2.0, Cunning: 0.4, Exhausted: 0.5
}

// Called on every state transition
private applyEmotionalLighting(state: WardenState) {
  gsap.to(wardenLight, {
    intensity: wardenLightIntensity[state],
    duration: 0.6,
    ease: 'power2.out',
  })
  // Color3 GSAP tween — needs a proxy object
  const c = wardenLightColors[state]
  gsap.to(wardenLight.diffuse, { r: c.r, g: c.g, b: c.b, duration: 0.6 })
  useGameStore.getState().setWardenState(state)
  eventBroker.emit(GameEvent.WARDEN_STATE_CHANGED, state)
}
```

### 8.3 — Leg Animation

```typescript
updateLegs(dt: number, time: number) {
  const state = this.currentStateName

  if (state === 'Cunning') {
    // Skitter — rapid small oscillations
    legs.forEach((leg, i) => {
      const phase = (i / 8) * Math.PI * 2
      leg.rotation.z = Math.sin(time * 8 + phase) * 0.15
    })
  } else if (state === 'Stalking' || state === 'Frenzied') {
    // Slow patrol creep
    legs.forEach((leg, i) => {
      const phase = (i / 8) * Math.PI * 2
      const speed = state === 'Frenzied' ? 3.0 : 1.2
      leg.rotation.z = Math.sin(time * speed + phase) * 0.08
    })
  } else if (state === 'Exhausted') {
    // Droop — lerp toward hanging
    legs.forEach(leg => {
      leg.rotation.x += (Math.PI * 0.35 - leg.rotation.x) * 0.05
    })
  }
}
```

On hit (subscribe to `HIT_WARDEN`):
```typescript
gsap.timeline()
  .to(legs.map(l => l.rotation), { z: 'random(-1.2, 1.2)', duration: 0.1, stagger: 0.01 })
  .to(legs.map(l => l.rotation), { z: 0, duration: 0.4, ease: 'elastic.out(1, 0.4)', stagger: 0.02 })
```

**Gate:**
```
npm run dev
```
- Play for 30 seconds — Warden should cycle through states based on game events
- Each state shows distinct light color
- Legs animate differently in each state
- Warden is visibly reeling in (player being pulled upward)
- Anchor threat assessment triggers Cunning state when 3+ anchors are placed

---

## Phase 9 — Hit Detection & Damage Flow

**Goal:** 7 hits to kill. After hit 6, fake-out fires. Phase 2 begins. Hit 7 triggers win.

### 9.1 — Hit Flow

Subscribe to `HIT_WARDEN` in a central `GameDirector` (a thin coordinator class, not a full system):

```typescript
// Subscribe in BabylonScene.tsx useEffect
const unsubHit = eventBroker.on(GameEvent.HIT_WARDEN, () => {
  const { wardenHealth, phase } = useGameStore.getState()

  if (phase === 'Fakeout') return  // sequence in progress

  if (wardenHealth === 1 && phase !== 'Phase2') {
    // About to take the 6th hit — intercept for fake-out
    wardenEntity.triggerFakeOut()
    return
  }

  useGameStore.getState().damageWarden()
  wardenAI.onHitReceived()  // triggers state transition in WardenAI

  if (wardenHealth - 1 <= 0) {
    triggerWin()
  }
})
```

### 9.2 — Fake-Out Sequence (`src/entities/Warden.ts`)

```typescript
triggerFakeOut(): void {
  useGameStore.getState().setPhase('Fakeout')
  useGameStore.getState().setInputEnabled(false)

  gsap.timeline()
    .to(wardenMesh.scaling, { x: 0.1, y: 0.1, z: 0.1, duration: 0.4, ease: 'back.in(2)' })
    .to(legs.map(l => l.rotation), { x: Math.PI, stagger: 0.04, duration: 0.3 }, '<')
    .call(() => {
      wardenLight.intensity = 0
    })
    .call(() => howlerBank.play('fakeout_sting'))
    .to({}, { duration: 0.8 })   // silence — hold this beat. The silence is the moment.
    .call(() => howlerBank.play('spider_screech'))
    .to(wardenMesh.scaling, { x: 2.2, y: 2.2, z: 2.2, duration: 0.15, ease: 'elastic.out(1, 0.3)' })
    .to(legs.map(l => l.rotation), { x: 0, stagger: 0.02, duration: 0.2 }, '<')
    .call(() => {
      ropeSystem.reattachWithSlack(1.5)  // longer rope for phase 2 tension
      useGameStore.getState().setPhase('Phase2')
      useGameStore.getState().setWardenState('Frenzied')
      wardenAI.lockToFrenzied()           // state machine locked — no transitions out
      useGameStore.getState().setInputEnabled(true)
    })
}
```

**The 0.8s silence is the moment.** Do not shorten it. That beat of nothing — legs drooping, light extinguished — is what makes the scream and resurrection land.

### 9.3 — Phase 2

In `WardenAI.lockToFrenzied()`:
```typescript
lockToFrenzied(): void {
  this.stateMachine.changeState(this.frenziedState)
  this.frenziedState.reelSpeed = 1.8  // faster than normal Frenzied
  this.isLocked = true  // prevents all state transitions
}
```

**Gate:**
```
npm run dev
```
Complete a full playthrough:
1. Land 6 hits
2. Fake-out fires — Warden collapses, silence, then screams back at 2.2× scale
3. Phase 2 begins — Warden noticeably faster and red
4. Land 7th hit — win condition fires (placeholder OK for now)
5. Confirm soft-restart resets health to 7 and phase to Playing

---

## Phase 10 — Silk Shader

**Goal:** Rope changes color and thickness with tension. View angle creates iridescent shimmer.

### 10.1 — Lygia Prerequisite

Confirm `src/shaders/lygia/iridescence.glsl` and `fbm.glsl` are present. The silk shader `#includes` them inline using a Vite plugin or by inlining them directly into the GLSL source at build time. Use the inline approach: copy the function bodies directly into `silk.fragment.glsl` rather than using `#include` (Babylon's shader system does not resolve file-relative includes automatically).

### 10.2 — Silk Fragment Shader (`src/shaders/silk.fragment.glsl`)

```glsl
precision highp float;

uniform float u_tension;
uniform float u_time;
uniform vec3  u_viewDir;

varying vec3 vNormal;
varying vec3 vPosition;

// [inline fbm function body here]
// [inline iridescence function body here]

void main() {
  float iriAngle = dot(normalize(vNormal), normalize(u_viewDir));
  vec3 iriColor = iridescence(iriAngle + fbm(vPosition.xy * 4.0 + u_time * 0.3) * 0.2);

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

### 10.3 — ShaderUniforms System (`src/systems/ShaderUniforms.ts`)

```typescript
// Registered in GameLoop — called every frame
class ShaderUniforms {
  update(_dt: number) {
    const { tension } = useGameStore.getState()
    const time = performance.now() / 1000
    const viewDir = scene.activeCamera!.getForwardRay().direction

    silkMaterial.setFloat('u_tension', tension)
    silkMaterial.setFloat('u_time', time)
    silkMaterial.setVector3('u_viewDir', viewDir)

    spiderMaterial.setFloat('u_hitCount', 7 - useGameStore.getState().wardenHealth)
    spiderMaterial.setVector3('u_lightDir', wardenLight.getAbsolutePosition().normalize())
    spiderMaterial.setVector3('u_viewDir', viewDir)
  }
}
```

**Rope thickness in tension:**
```typescript
// In RopeSystem.update(), after computing tensionValue:
const ropeRadius = 0.04 + this.tensionValue * 0.04
// Pass to MeshBuilder.CreateTube radius parameter on updatable rebuild
```

**Gate:**
```
npm run dev
```
- Rope is cool blue when slack
- Rope brightens to white as charge builds
- Above ~85% tension, red bleed visible in rope core
- Iridescent shimmer visible when swinging (view angle changes)

---

## Phase 11 — Spider Body Shader

**Goal:** Spider has subtle subsurface scattering approximation. Silk dissolve spreads per hit.

### 11.1 — Spider Fragment Shader (`src/shaders/spider.fragment.glsl`)

```glsl
precision highp float;

uniform vec3  u_lightDir;
uniform vec3  u_viewDir;
uniform float u_hitCount;  // 0–7 (inverted: health decreases, this increases)

varying vec3 vNormal;
varying vec3 vPosition;

// [inline fbm function body here]

void main() {
  vec3 skinColor = vec3(0.05, 0.02, 0.08);

  // Cheap subsurface scattering: transmittance from back-lighting
  float sssStrength = pow(max(dot(-normalize(u_lightDir), normalize(u_viewDir)), 0.0), 4.0) * 0.3;
  vec3 sssColor = vec3(0.4, 0.2, 0.5);
  vec3 result = skinColor + sssStrength * sssColor;

  // Damage dissolve — silk wrapping spreads per hit
  float dissolveThreshold = u_hitCount / 7.0;
  float noise = fbm(vPosition * 3.0 + u_hitCount * 0.4);
  if (noise < dissolveThreshold) {
    result = mix(result, vec3(0.8, 0.9, 1.0), 0.7);  // silk wrap color
  }

  gl_FragColor = vec4(result, 1.0);
}
```

**Gate:**
```
npm run dev
```
- Spider body has a faint purple inner glow when Warden light is behind it
- After 3+ hits, visible silk pattern spreading across spider body

---

## Phase 12 — Audio Layer

**Goal:** Tone.js reactive drone is live. Events trigger one-shot audio. All audio starts after first user interaction (browser requirement).

### 12.1 — ToneEngine (`src/audio/ToneEngine.ts`)

```typescript
import * as Tone from 'tone'

export class ToneEngine {
  private tensionOsc!: Tone.Oscillator
  private chargeSaw!: Tone.Oscillator
  private chargeSweep!: Tone.Filter
  private chargeEnv!: Tone.AmplitudeEnvelope
  private launchSynth!: Tone.NoiseSynth
  private wallSynth!: Tone.Synth
  private chitterSynth!: Tone.FMSynth
  private isInitialized = false

  async init(): Promise<void> {
    await Tone.start()
    this.isInitialized = true

    // Tension drone — sine oscillator, pitch mapped to tension
    this.tensionOsc = new Tone.Oscillator({ type: 'sine', frequency: 80 }).toDestination()
    this.tensionOsc.volume.value = -24
    // Fade in slowly at game start — less jarring
    this.tensionOsc.volume.rampTo(-18, 3)
    this.tensionOsc.start()

    // Charge sweep — sawtooth through bandpass filter
    this.chargeSaw = new Tone.Oscillator({ type: 'sawtooth', frequency: 110 })
    this.chargeSweep = new Tone.Filter({ type: 'bandpass', frequency: 400, rolloff: -24 })
    this.chargeEnv = new Tone.AmplitudeEnvelope({ attack: 0.05, decay: 0, sustain: 1.0, release: 0.1 })
    this.chargeSaw.connect(this.chargeSweep).connect(this.chargeEnv).toDestination()
    this.chargeSaw.start()
    this.chargeEnv.triggerRelease()

    // Launch burst — noise hit on release
    this.launchSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0 }
    }).toDestination()
    this.launchSynth.volume.value = -10

    // Wall impact thud
    this.wallSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0 }
    }).toDestination()
    this.wallSynth.volume.value = -14

    // Spider chitter — FM synthesis, rate increases in Frenzied
    this.chitterSynth = new Tone.FMSynth({
      harmonicity: 8,
      modulationIndex: 2,
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0 },
    }).toDestination()
    this.chitterSynth.volume.value = -20

    this.subscribeToEvents()
  }

  private subscribeToEvents(): void {
    eventBroker.on(GameEvent.TENSION_CHANGED, (t: number) => this.setTension(t))
    eventBroker.on(GameEvent.CHARGE_CHANGED,  (c: number) => this.setCharge(c))
    eventBroker.on(GameEvent.LAUNCH,          ()          => this.playLaunch())
    eventBroker.on(GameEvent.WALL_CONTACT,    ()          => this.playWallThud())
    eventBroker.on(GameEvent.WARDEN_STATE_CHANGED, (s: WardenState) => this.onWardenState(s))
  }

  setTension(t: number): void {
    if (!this.isInitialized) return
    this.tensionOsc.frequency.rampTo(80 + t * 320, 0.05)   // 80hz → 400hz
    this.tensionOsc.volume.rampTo(-18 + t * 8, 0.05)       // louder near snap
  }

  setCharge(c: number): void {
    if (!this.isInitialized) return
    if (c > 0.05) {
      this.chargeEnv.triggerAttack()
      this.chargeSweep.frequency.rampTo(200 + c * 1600, 0.02)
    } else {
      this.chargeEnv.triggerRelease()
    }
  }

  playLaunch(): void {
    this.launchSynth.triggerAttackRelease('8n')
  }

  playWallThud(): void {
    this.wallSynth.triggerAttackRelease(80 + Math.random() * 40, '16n')
  }

  onWardenState(state: WardenState): void {
    if (state === 'Frenzied') {
      // Rapid chittering loop — schedule repeating trigger
    } else {
      // Stop chitter loop
    }
  }
}

export const toneEngine = new ToneEngine()
```

### 12.2 — HowlerBank (`src/audio/HowlerBank.ts`)

```typescript
import { Howl } from 'howler'

const bank: Record<string, Howl> = {
  spider_screech: new Howl({ src: ['/audio/spider_screech.mp3'] }),
  fakeout_sting:  new Howl({ src: ['/audio/fakeout_sting.mp3'] }),
  anchor_deploy:  new Howl({ src: ['/audio/anchor_deploy.mp3'] }),
  anchor_break:   new Howl({ src: ['/audio/anchor_break.mp3'] }),
  silk_snap:      new Howl({ src: ['/audio/silk_snap.mp3'] }),
  victory:        new Howl({ src: ['/audio/victory.mp3'] }),
}

export const howlerBank = {
  play: (id: keyof typeof bank) => bank[id]?.play(),
}
```

Subscribe to events:
```typescript
eventBroker.on(GameEvent.ANCHOR_PLACED,  () => howlerBank.play('anchor_deploy'))
eventBroker.on(GameEvent.ANCHOR_BROKEN,  () => howlerBank.play('anchor_break'))
eventBroker.on(GameEvent.LEASH_SNAP,     () => howlerBank.play('silk_snap'))
```

`spider_screech`, `fakeout_sting`, and `victory` are called directly from `Warden.ts` and the win sequence.

**Fallback plan:** If ElevenLabs files are not available, skip `HowlerBank` entirely. `ToneEngine` one-shots cover all critical events. Cut `howler` from imports.

**Gate:**
```
npm run dev
```
- Click anywhere to initialize audio (browser autoplay requirement)
- Tension drone pitch rises as you build charge against wall
- Charge sweep activates while holding wall
- Launch burst fires on release
- On `HIT_WARDEN`: screech plays
- No audio context errors in DevTools

---

## Phase 13 — Post-Processing

**Goal:** Bloom on silk and eyes. Vignette tightens with tension. Chromatic aberration at critical tension. Camera shake on impact events.

### 13.1 — DefaultRenderingPipeline (`src/babylon/PostFXPipeline.ts`)

```typescript
import { DefaultRenderingPipeline } from '@babylonjs/core'

export function initPostFX(scene: Scene, camera: Camera): void {
  const pipeline = new DefaultRenderingPipeline('main', true, scene, [camera])

  pipeline.bloomEnabled = true
  pipeline.bloomThreshold = 0.55
  pipeline.bloomWeight = 0.35
  pipeline.bloomKernel = 64

  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.vignetteEnabled = true
  pipeline.imageProcessing.vignetteWeight = 1.5
  pipeline.imageProcessing.vignetteCameraFov = 0.5
}
```

Each frame from `ShaderUniforms.update()`:
```typescript
pipeline.imageProcessing.vignetteWeight = 1.5 + tension * 2.5
```

### 13.2 — Chromatic Aberration PostProcess

Babylon's `DefaultRenderingPipeline` does not have built-in CA. Use a custom `PostProcess`:

```typescript
const caPass = new PostProcess('ca', './shaders/ca', ['u_strength'], null, 1.0, camera)
caPass.onApply = (effect) => {
  const tension = useGameStore.getState().tension
  const strength = Math.max(0, (tension - 0.9) / 0.1) * 0.008
  effect.setFloat('u_strength', strength)
}
```

`ca.fragment.glsl`:
```glsl
precision highp float;
uniform float u_strength;
uniform sampler2D textureSampler;
varying vec2 vUV;

void main() {
  vec2 dir = vUV - vec2(0.5);
  float r = texture2D(textureSampler, vUV + dir * u_strength).r;
  float g = texture2D(textureSampler, vUV).g;
  float b = texture2D(textureSampler, vUV - dir * u_strength).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
```

### 13.3 — Camera Shake (`src/babylon/CameraShake.ts`)

```typescript
export class CameraShake {
  private trauma = 0
  private readonly shakePower = 2

  addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount)
  }

  update(dt: number): void {
    const shake = Math.pow(this.trauma, this.shakePower)
    if (shake > 0.001) {
      camera.position.x += (Math.random() * 2 - 1) * shake * 0.15
      camera.position.y += (Math.random() * 2 - 1) * shake * 0.08
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.2)
  }
}
```

Subscribe:
```typescript
eventBroker.on(GameEvent.HIT_WARDEN,    () => cameraShake.addTrauma(0.6))
eventBroker.on(GameEvent.ANCHOR_BROKEN, () => cameraShake.addTrauma(0.3))
eventBroker.on(GameEvent.LAUNCH,        (e: { charge: number }) => cameraShake.addTrauma(e.charge * 0.4))
```

FOV pulse with Warden emotional state:
```typescript
const fovByState: Record<WardenState, number> = {
  Stalking: 75, Frenzied: 85, Cunning: 70, Exhausted: 72
}
eventBroker.on(GameEvent.WARDEN_STATE_CHANGED, (state: WardenState) => {
  gsap.to(camera, { fov: fovByState[state] * (Math.PI / 180), duration: 0.8 })
})
```

**Gate:**
```
npm run dev
```
- Bloom visible on rope tube and Warden eye meshes
- Vignette perceptibly darker in corners near 90%+ tension
- CA flicker visible at 90%+ tension
- Camera jolts on hits and anchor breaks

---

## Phase 14 — React HUD Layer

**Goal:** Minimal React overlay over the Babylon canvas. Three elements only: tension indicator, charge bar, warden health dots.

### 14.1 — App.tsx (Minimal)

```tsx
// src/App.tsx
import BabylonScene from '@/babylon/BabylonScene'
import HUD from '@/ui/HUD'
import LoadingScreen from '@/ui/LoadingScreen'
import { useGameStore } from '@/store/useGameStore'
import './App.css'

export default function App() {
  const phase = useGameStore(s => s.phase)

  return (
    <div className="app-root">
      <BabylonScene />
      {phase === 'Loading' && <LoadingScreen />}
      {phase !== 'Loading' && <HUD />}
    </div>
  )
}
```

`App.css`:
```css
.app-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}
```

### 14.2 — HUD (`src/ui/HUD.tsx`)

```tsx
import { useGameStore } from '@/store/useGameStore'
import './HUD.css'

export default function HUD() {
  const tension      = useGameStore(s => s.tension)
  const charge       = useGameStore(s => s.charge)
  const wardenHealth = useGameStore(s => s.wardenHealth)
  const phase        = useGameStore(s => s.phase)

  return (
    <div className="hud-overlay">
      <WardenHealth health={wardenHealth} phase={phase} />
      <div className="hud-bottom">
        <TensionBar tension={tension} />
        <ChargeBar charge={charge} />
      </div>
    </div>
  )
}
```

**Tension Bar:**
```tsx
function TensionBar({ tension }: { tension: number }) {
  const isCritical = tension > 0.85
  return (
    <div className="tension-bar-track">
      <div
        className={`tension-bar-fill ${isCritical ? 'tension-critical' : ''}`}
        style={{ height: `${tension * 100}%` }}
      />
    </div>
  )
}
```

CSS for tension color gradient: `background: linear-gradient(to top, #3a6fdb 0%, #e8f0ff 60%, #c92a2a 100%)` on the track. The fill clips it from the bottom.

`tension-critical` class adds: `animation: pulse 0.3s ease-in-out infinite alternate`.

**Charge Bar:**
```tsx
function ChargeBar({ charge }: { charge: number }) {
  const isFull = charge >= 0.98
  return (
    <div className="charge-bar-track">
      <div
        className={`charge-bar-fill ${isFull ? 'charge-full' : ''}`}
        style={{ width: `${charge * 100}%` }}
      />
    </div>
  )
}
```

`charge-full` class: `animation: charge-pulse 0.2s ease-in-out infinite alternate` — brief white flash to signal "fire now."

**Warden Health Dots:**
```tsx
function WardenHealth({ health, phase }: { health: number; phase: GamePhase }) {
  return (
    <div className="warden-health">
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          className={`health-dot ${i < health ? 'health-dot-active' : 'health-dot-dead'} ${phase === 'Phase2' && i === 0 && health === 1 ? 'health-dot-phase2' : ''}`}
        />
      ))}
    </div>
  )
}
```

`health-dot-phase2`: red glow pulsing — signals the final hit window.

### 14.3 — LoadingScreen (`src/ui/LoadingScreen.tsx`)

```tsx
export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-silk-threads">
        {/* 8 SVG lines animating in from edges toward center */}
      </div>
      <div className="loading-spider-silhouette" />
      <p className="loading-text">SPINNING</p>
    </div>
  )
}
```

Set `phase` to `Playing` after Rapier init completes (in `BabylonScene.tsx` `useEffect`):
```typescript
await physicsManager.init()
useGameStore.getState().setPhase('Playing')
useGameStore.getState().setInputEnabled(true)
```

**Gate:**
```
npm run dev
```
- Loading screen shows on initial load (Rapier WASM init takes ~1-2 seconds)
- HUD elements appear after loading
- Tension bar fills as rope tightens (test by blocking free swing with mouse/debug)
- Charge bar pulses at 100%
- Warden health dots decrement on hits
- No prop drilling — all HUD reads from Zustand

---

## Phase 15 — Win / Lose Flows

**Goal:** Both endings play in full. Soft restart works without page reload.

### 15.1 — Win Sequence (Hit 7)

```typescript
function triggerWin(): void {
  useGameStore.getState().setPhase('Win')
  useGameStore.getState().setInputEnabled(false)
  gameLoop.stop()  // pause physics

  howlerBank.play('victory')  // silence then release

  gsap.timeline()
    .call(() => triggerSilkEngulfParticles(wardenEntity.getPosition()))
    .to(wardenMesh.scaling, { x: 0, y: 0, z: 0, duration: 1.2, ease: 'power3.in' })
    .to(wardenBody.position, { y: -50, duration: 2.0, ease: 'power2.in' })
    .call(() => ropeSystem.goSlack())
    .to({}, { duration: 1.5 })
    .call(() => showEndOverlay('Win'))
}
```

### 15.2 — Lose Sequence A — Leash Snap

```typescript
eventBroker.on(GameEvent.LEASH_SNAP, () => {
  if (useGameStore.getState().phase === 'Dead') return
  useGameStore.getState().setPhase('Dead')
  howlerBank.play('silk_snap')
  triggerSilkExplosionParticles(playerMesh.position)
  showEndOverlay('Dead')
})
```

Visual: full-screen white flash `<div>` that fades `opacity: 0.8 → 0` over `0.5s`. Then overlay text: *"The silk broke. She wins."*

### 15.3 — Lose Sequence B — Warden Escapes

Triggered in `WardenAI.update()` when player position exceeds shaft ceiling:
```typescript
if (playerMesh.position.y >= SHAFT_TOP_Y) {
  eventBroker.emit(GameEvent.LEASH_SNAP, {})  // share the lose flow
  showEndOverlay('Escaped')  // distinct message: "She's gone. You hang in silence."
}
```

### 15.4 — End Overlay + Soft Restart

```tsx
function EndOverlay({ result }: { result: 'Win' | 'Dead' | 'Escaped' }) {
  const messages = {
    Win:     { title: 'SHE FALLS', sub: 'You hang in silence.' },
    Dead:    { title: 'THE SILK BROKE', sub: 'She wins.' },
    Escaped: { title: "SHE'S GONE", sub: 'You hang in silence.' },
  }
  const m = messages[result]

  return (
    <div className="end-overlay">
      <h1 className="end-title">{m.title}</h1>
      <p className="end-sub">{m.sub}</p>
      <button className="end-restart" onClick={handleRestart}>RUN AGAIN</button>
    </div>
  )
}
```

`handleRestart()`:
```typescript
function handleRestart(): void {
  // Reset all Rapier bodies to spawn positions
  ropeSystem.reset()
  charController.reset()
  wardenEntity.reset()

  // Reset Zustand store
  useGameStore.getState().resetGame()

  // Restart game loop
  gameLoop.start()
}
```

Do not reload the page. Full soft reset. The `resetGame()` action in the store restores all initial values.

**Gate:**
```
npm run dev
```
- Win condition: play 7 hits → sequence plays → overlay appears → "Run Again" restarts cleanly
- Lose condition A: intentionally hold charge to 100% without anchors → snap → overlay
- Lose condition B: let Warden reel you to top → escape lose overlay
- After restart: health is 7, phase is Playing, all anchors cleared, Warden at top

---

## Phase 16 — Dev Tooling + Final Feel Pass

**Goal:** Leva panel exposed. Stats.js running. 30-minute feel improvements applied. Pre-submission checklist verified.

### 16.1 — Stats.js

```typescript
import Stats from 'stats.js'
const stats = new Stats()
stats.showPanel(0)  // 0: fps, 1: ms, 2: mb
document.body.appendChild(stats.dom)
stats.dom.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;'

// In GameLoop — wrap update/render
stats.begin()
onUpdate(dt)
onRender()
stats.end()
```

Strip from production: `if (import.meta.env.DEV) { /* Stats.js init */ }`

### 16.2 — Leva Tuning Panel

```typescript
import { useControls } from 'leva'

// In a dev-only React component rendered above HUD
export function TuningPanel() {
  const controls = useControls({
    chargeRate:      { value: 0.6,   min: 0.1,  max: 3.0,  step: 0.05 },
    launchBaseForce: { value: 15.0,  min: 5,    max: 40,   step: 1.0  },
    launchChargeScale: { value: 25.0, min: 10,  max: 60,   step: 1.0  },
    ropeStiffness:   { value: 800,   min: 100,  max: 2000, step: 50   },
    wardenReelSpeed: { value: 0.4,   min: 0.05, max: 2.0,  step: 0.05 },
    stretchFactor:   { value: 0.08,  min: 0,    max: 0.3,  step: 0.01 },
    snapThreshold:   { value: 0.95,  min: 0.7,  max: 1.0,  step: 0.01 },
    lateralForce:    { value: 8.0,   min: 2,    max: 20,   step: 0.5  },
  })
  // Expose via module-level refs read by each system
  Object.assign(tuningRefs, controls)
  return null
}
```

Pass tuning values into systems via module-level refs — do not restructure systems to accept props.

Strip from production: wrap import in `import.meta.env.DEV` guard.

### 16.3 — 30-Minute Feel Improvements (High ROI, Do These)

In this order. Each is 20–30 minutes. Each has outsized return.

1. **Rope thickness spike on launch** — momentary thickness jump to `0.12` then back to `0.04` over `0.2s` via lerp in `RopeSystem.update()`. Pure tactile feel.

2. **Screen flash on hit** — `<div className="hit-flash" />` with CSS: `position: fixed; inset: 0; background: white; pointer-events: none`. Fade `opacity: 0.8 → 0` over `0.15s` on `HIT_WARDEN` event. The cheapest high-impact effect.

3. **Tension drone fade-in at game start** — `tensionOsc.volume.value = -60` at `Playing` phase start, ramp to `-18` over `3s`. Less jarring entry. The sound emerging from silence as you start swinging communicates the mechanical stakes.

4. **Warden eye flicker in Exhausted state** — random interval: `setInterval(() => { wardenLight.intensity = 0; setTimeout(() => { wardenLight.intensity = 0.5 }, 80) }, 400 + Math.random() * 600)`. Clear the interval on state exit.

5. **Charge bar shake at 100%** — CSS `animation: shake 0.1s ease infinite` on `charge-full` class. Signals "fire NOW" with increasing urgency.

6. **2-frame hitstop on Warden contact** — freeze physics for 2 frames (`physicsManager.frozen = true` for 33ms) on `HIT_WARDEN`. Box Battle used `Camera.hitStopTimer` for this. Apply same pattern. Makes every hit register with physical weight.

### 16.4 — Pre-Submission / Pre-Deploy Checklist

```
[ ] Strip Stats.js from production (import.meta.env.DEV guard)
[ ] Strip Leva panel from production
[ ] Remove Babylon Inspector shortcut (Ctrl+Alt+I) — or move behind DEV guard
[ ] Test on Firefox desktop — WebGL2 path
[ ] Test on Safari desktop — WebGL2 path
[ ] Test on Chrome mobile
[ ] Test on iOS Safari
[ ] Test on CPU throttle 4× (Chrome DevTools) — target ≥ 30 FPS
[ ] Verify Rapier WASM is NOT inlined (assetsInlineLimit: 0 in vite.config.ts)
[ ] Verify /public/audio/ directory present with all 6 MP3 files (or confirm Howler disabled)
[ ] Loading screen covers Rapier WASM load time — no blank frame before load
[ ] Soft restart works: 3 consecutive restarts without page reload
[ ] Full win path playable end-to-end
[ ] Full lose (snap) path fires correctly
[ ] Full lose (escape) path fires correctly
[ ] Fake-out sequence fires on hit 6, not earlier or later
[ ] Phase 2 Warden is visibly faster and red
[ ] No console errors on any tested browser
[ ] npm run build — zero TypeScript errors, zero WASM warnings
[ ] Bundle size < 5MB uncompressed (check /dist after build)
```

---

## System Dependency Map

Build phases in strict order. A phase cannot be tested until all listed dependencies are complete.

| Phase | Depends On |
|---|---|
| 0 — Init | Nothing |
| 1 — Core Infra | Phase 0 |
| 2 — Store | Phase 1 (GameEvent types, WardenState type) |
| 3 — Scene | Phase 0, Phase 2 (store import), Phase 1 (EventBroker) |
| 4 — Physics | Phase 3 (mesh refs), Phase 1 (GameLoop), Phase 2 (Store) |
| 5 — Player Controller | Phase 4 (Rapier world, RopeSystem), Phase 1 (InputProvider) |
| 6 — Wall Slide + Launch | Phase 5 (isOnWall, charController), Phase 1 (Input, EventBroker, Store) |
| 7 — Anchor System | Phase 6 (wall contact, rope node array), Phase 1 (ObjectPool) |
| 8 — Warden AI | Phase 6 (hit detection), Phase 7 (anchor reading), Phase 3 (leg meshes, wardenLight), Phase 1 (StateMachine) |
| 9 — Hit + Fake-Out | Phase 8 (WardenAI states), Phase 6 (HIT_WARDEN event) |
| 10 — Silk Shader | Phase 4 (RopeSystem, tension value), Phase 3 (rope mesh ref) |
| 11 — Spider Shader | Phase 3 (Warden mesh), Phase 9 (hitCount uniform) |
| 12 — Audio | Phase 1 (EventBroker). Can be built in parallel with Phase 6+. |
| 13 — Post-FX | Phase 3 (scene, camera), Phase 10 (tension uniform available) |
| 14 — HUD | Phase 2 (Zustand store). Can be built in parallel with Phase 6+. |
| 15 — Win/Lose | All phases complete |
| 16 — Dev Tooling | All phases complete |

---

## Gameplay Design Reference

This section is the mechanical specification. Refer here when implementing systems — these are the tuning targets, not suggestions.

### Core Loop

```
Swing into position
  → Fire anchor(s) into wall
    → Hit wall, hold — initiate slide + charge buildup (accelerating rate)
      → Release at charge peak → slingshot launch toward Warden
        → Hit = damage + knockback + stun window + hitstop frame
          → Warden recovers, new behavioral state, reel resumes
```

### Controls (Three Inputs Only)

| Input | Keyboard | Touch Zone | Action |
|---|---|---|---|
| LEFT | A / ← | Left 33% | Swing left |
| RIGHT | D / → | Right 33% | Swing right |
| HOLD | Space / S / ↓ | Center 33% | Wall: charge + hold slide. Mid-air: fire anchor. |
| Release HOLD | — | — | Launch if charge ≥ 0.4. Quick fling if tap (< 80ms). |

### Warden States

| State | Reel Speed | Key Behavior |
|---|---|---|
| Stalking | 0.4 u/s | Default. Reads anchor pattern every 3s. 2 quick hits → Frenzied. |
| Frenzied | 1.2 u/s | Drops debris every 2s. Anchor break threshold = 1 pull. After 8s or hit → Exhausted. |
| Cunning | 0.2 u/s | Routes around anchor web. Dims. Player launch while active → Exhausted. *(Cut if pressed)* |
| Exhausted | 0.15 u/s | Droop. Player charge builds 2× faster. Duration 3s → Stalking. |

### Anchor Types (Start with Standard only)

| Type | Drag Value | Break Threshold | Notes |
|---|---|---|---|
| Standard | +0.3 | 3 Warden pulls (1 in Frenzied) | The only type needed for a complete game |
| Elastic | +0.4 | 2 pulls, then snaps back | Unlock mid-run. Boost player on break. |
| Sticky | +0.5 | 4 pulls, but slows player if drifted through | High risk/reward placement game |

### Tension Thresholds

| Value | State | Visual | Audio | Behavior |
|---|---|---|---|---|
| 0.0–0.3 | Slack | Blue-grey rope, drooping | Low drone (80hz) | Normal swing |
| 0.3–0.7 | Taut | Bright white rope | Mid drone | Anchors more valuable |
| 0.7–0.85 | Warning | White rope, thicker | High drone (270hz+) | Snap approaching |
| 0.85–0.95 | Critical | Red core bleeds in | Near-max drone, CA activates | Snap imminent |
| ≥ 0.95 | SNAP | Flash + burst | Silk snap SFX | Run ends |

### Win Condition
7 hits. Hit 6 triggers fake-out (Warden fake-dies, silence, resurrects at 2.2× scale, Phase 2 begins). Hit 7 ends the run.

### Lose Conditions
- Tension hits 0.95+ (leash snaps)
- Player position Y reaches Warden nest position (pulled too far up)

### Emotional State Lighting (Non-Negotiable)
```
Stalking:   Cold blue  (0.2, 0.4, 1.0)  — watchful. Calculating.
Frenzied:   Hot red    (1.0, 0.15, 0.1) — rage. The shaft feels dangerous.
Cunning:    Dim green  (0.1, 0.6, 0.15) — unnerving quiet.
Exhausted:  Faded white(0.7, 0.7, 0.7)  — flickering. Vulnerability window.
```

---

## npm Install Reference

```bash
npm install @babylonjs/core @babylonjs/materials @babylonjs/loaders
npm install @dimforge/rapier3d-compat
npm install gsap
npm install tone
npm install howler
npm install zustand
npm install framer-motion
npm install stats.js leva
npm install @types/howler @types/stats.js
```

DevDependencies (already included by Vite scaffold):
```bash
npm install -D @vitejs/plugin-react typescript @types/react @types/react-dom vite
```

---

## Expected Bundle Size

```
@babylonjs/core     ~2.5 MB
Rapier WASM         ~1.2 MB
Tone.js             ~300 KB
GSAP                ~200 KB
Howler.js           ~100 KB
React + ReactDOM    ~150 KB
Zustand             ~15 KB
Lygia (inlined)     ~10 KB (2 functions only)
Stats + Leva        ~200 KB (dev only — stripped from build)
───────────────────────────
Total               ~4.5 MB production build
```

Target: under 5MB uncompressed. Check after `npm run build` with `du -sh dist/`.

---

*End of SILK Master Engineering Document. v1.0 — Steven Casteel / 2026*
