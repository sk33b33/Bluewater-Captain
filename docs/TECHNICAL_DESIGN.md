# Technical Design — initial decisions required

## Engine selection
During Stage 0, compare Unreal Engine 5 and Unity using:
- Ocean/water quality and performance
- Large vessel physics and collision handling
- World streaming / bounded-region design
- Asset availability and licensing
- Target hardware and expected minimum specs
- Developer familiarity and build workflow

Document the chosen engine and version in `docs/DECISIONS.md`.

## Suggested system boundaries
Keep these systems decoupled:
- Vessel configuration/data
- Vessel movement and handling
- Camera and player input
- Ocean/waves/weather
- Port and berth data
- Mission definitions and objectives
- License progression and exam scoring
- Rewards/economy
- Save/load
- HUD and menus
- Audio
- Asset registry and license records

## Data-driven design
Mission definitions, vessel stats, license requirements, and port metadata should be data-driven where reasonable. Avoid hard-coding every mission in UI code.

## Simulation principles
Start with a controllable, enjoyable approximation. Realistic-looking graphics do not require a fully accurate fluid solver. Use a stable vessel movement model with mass/inertia, acceleration, drag, turning response, and environment forces. Validate it through playtests before adding complexity.

## Performance
- Profile before optimizing.
- Provide graphics scalability.
- Use level of detail, instancing, occlusion, and streaming where appropriate to the selected engine.
- Keep simulation complexity proportional to gameplay relevance.
- Avoid loading the entire world at once.
- Set and measure a target frame rate on target hardware during Stage 0.

## Persistence
Save career progress, credits, reputation, licenses, owned/unlocked vessels, completed missions, settings, and last safe port. Handle versioned save data gracefully.

## Testing
At minimum, test mission state transitions, license prerequisites, rewards, save/load, ship-class restrictions, and mission scoring. Provide repeatable manual tests for driving, wave response, and docking.

## Security and online features
Single-player/offline first. Do not add accounts, remote services, telemetry, or multiplayer without explicit approval.

---

# Stage 0 Outcomes

## 1. Open questions (these materially affect the engine decision)
1. Target platform: Windows PC only, or also console/Mac/mobile?
2. Minimum GPU/CPU/RAM you want to support (e.g. GTX 1060 vs RTX 3060 vs integrated)?
3. Do you already have Unreal or Unity installed, and which versions? Do you prefer C++/Blueprints or C#?
4. Who builds and tests: you locally, or a CI machine? (This cloud container cannot run an engine.)
5. Solo project or team? Any budget for marketplace assets (Fab / Unity Asset Store)?

## 2. Engine comparison

| Criterion | Unreal Engine 5 | Unity 6 LTS |
|---|---|---|
| Ocean/water quality | Water plugin, Niagara, Lumen; best out of box | HDRP Water System; good, needs HDRP setup |
| Large vessel physics | Chaos; custom buoyancy in C++ is typical | PhysX/own; custom buoyancy in C# is easy |
| Bounded streamed world | World Partition, built in | Addressables / additive scenes, manual |
| Asset ecosystem | Fab (many ocean/ship packs; check licenses) | Asset Store (many ocean/ship packs) |
| Min hardware | Higher (mid-range discrete GPU recommended) | Lower, scalable down to mobile/URP |
| Iteration speed / learning | Slower, C++ and large project | Faster, C# |
| Build in this container | Not possible | Not possible |
| Licensing | Royalty after revenue threshold (check current terms) | Runtime/seat terms (check current terms) |

**Recommendation (provisional): Unreal Engine 5**, matching the kit default and the high-fidelity ocean/large-ship goals. **Switch to Unity** if answers to questions 1-3 indicate low-end targets or C# familiarity. Licensing terms change; verify current terms before committing.

## 3. Target hardware and performance assumptions (provisional, to confirm)
- Platform: Windows 10/11 desktop, keyboard/mouse and gamepad.
- Minimum: quad-core CPU, 16 GB RAM, GTX 1060 6 GB / RX 580 class, 1080p, **30 fps** on Low.
- Recommended: RTX 2060 / RX 6600 class, 1080p, **60 fps** on Medium-High.
- Frame budget at 60 fps: 16.6 ms total; vessel simulation <= 1 ms, ocean displacement query <= 0.5 ms.
- These are unmeasured assumptions; measure in Stage 1.

## 4. Architecture outline (engine-agnostic)
Follow the system boundaries listed above. Specific choices:
- **Vessel data:** DataAsset/JSON per vessel (mass, drag, max thrust, rudder rate, license tier).
- **Movement:** 3-DOF surface model (surge, sway, yaw) with simple buoyancy for pitch/roll, force inputs for thrust, rudder, drag, wind, current. Deterministic fixed-step update, unit-testable without rendering.
- **Water height query:** a single interface `GetWaterHeight(x, z, t)` used by buoyancy, so Stage 5 can swap in real waves without touching vessels.
- **Missions/licenses/saves:** data-driven definitions plus a state machine; versioned save schema (Stage 3).
- **World:** cell grid manager (Stage 6 expands beyond one cell).

## 5. Asset strategy
- Stage 1: engine-supplied primitives and clearly labeled placeholders (prefix `PLACEHOLDER_`).
- Original or properly licensed assets only. Every external asset logged in `assets/ASSET_REGISTER_TEMPLATE.csv` (rename to `ASSET_REGISTER.csv`) with license proof before commit.
- No Titanic/Black Pearl likenesses until Stage 9 legal review.

## 6. Stage 0 acceptance criteria (status)
- [x] Repository inspected and findings recorded (empty repo, no engine).
- [x] Engine comparison and provisional recommendation (D-001).
- [x] Box world defined (GAME_DESIGN).
- [x] Hardware targets proposed (§3), flagged as unconfirmed.
- [x] Risk register (KNOWN_ISSUES) and asset strategy (§5).
- [x] Stage 1 scope and acceptance criteria (ROADMAP).
- [ ] **User approval of architecture and Stage 1 scope (pending).**


---

# Stage 1 Update: browser architecture (supersedes UE5 sections above, see D-005)

- **Stack:** Three.js r160 (WebGL), vanilla JS ES modules, esbuild bundle, Node `node:test` for unit tests. Only dependencies: `three`, `esbuild` (dev).
- **Layout:** `src/sim/` (pure simulation: `vessel.js`, `waves.js`, `world.js`, `route.js`; no DOM/WebGL), `src/render/` (water/sky shaders, placeholder meshes), `src/ui/` (HUD), `src/input.js`, `src/main.js` (loop, camera, settings). `scripts/build.mjs` produces `dist/index.html`.
- **Loop:** fixed 60 Hz simulation step with accumulator, render every frame.
- **Water:** shader displaces a 2600 m grid with a 3-wave sum; `getWaterHeight(x, z, t)` in `waves.js` uses the same wave constants for buoyancy. Stage 5 can replace this behind the same function.
- **Collision:** hull = two circles; obstacles are circles/rects; push-out plus speed-into-surface removal.
- **Hardware assumptions:** GTX 770-class GPU, 1080p. "Low graphics" option renders at 0.75 pixel ratio. Frame rate on the user's machine is not yet measured.
- **Tests:** `npm test` (19 unit tests, incl. an autopilot that completes the route); `tests/e2e/smoke.cjs` (headless Chromium load/drive check).


---

# Stage 5 Update: weather, water and performance

- **Weather:** `src/data/weather.js` (presets), `src/sim/weather.js` (gusts, veer, sea effect, deadlines, forecast text), `src/sim/waves.js` (`waveSet(weather)`), `src/render/atmosphere.js` (sky, fog, light). Everything is a pure function of preset, vessel and clock.
- **Water:** `src/render/water.js` evaluates the same four waves as `getWaterHeight`; foam and shallow tint use a 512x512 shore-distance texture baked once (`src/sim/shore.js`, `src/render/shore.js`); wake particles are bookkept in `src/sim/wake.js` and drawn by `src/render/wake.js`.
- **Quality:** `src/data/quality.js` presets drive render resolution (`min(devicePixelRatio x scale, cap)`), water grid (160/240/360), wave count (3/4/4), foam, and wake capacity (0/120/320). Switching rebuilds only what changed.
- **Performance tooling:** `src/sim/perf.js` has frame statistics (fps, p95, p99, 1% low), the auto-quality governor and the benchmark recommendation. The in-game overlay and benchmark use them.
- **Budget (unmeasured on real hardware):** target 30 fps minimum and 60 fps desired on a GTX 770-class GPU at 1080p; Low is designed to render at 0.6x resolution with no foam or wake to give weak cards the best chance.
- **Tests:** unit tests for all of the above plus `tests/e2e/weather.cjs`.


---

# Stage 6 Update: region, ports, chart and routes

- **World:** `src/sim/world.js` defines the region (`REGION`), edge handling and all obstacles. Ports live in `src/data/ports.js` (berths, start poses, fairway markers, inbound waypoints, slow zones, vessel limits, beacons). The chart (`src/data/charts.js`) is a graph of markers and legs.
- **Routes:** `src/sim/routes.js` builds the graph with measured clearances, finds simple paths (shortest plus distinct alternatives, bounded detour, never through another port), converts a path to waypoints, validates hand-built paths, estimates time and sets deadlines. `planMission` applies a route to a copy of a planned mission.
- **Missions:** planned missions name `fromPort` and `toPort`; start pose, berth, names, default route and deadline are derived at load.
- **UI:** `src/ui/chart.js` draws the chart on a 2D canvas (projection and marker picking are pure and tested) and handles the route-building controls. Game canvas styles are scoped to `#game`.
- **Rendering:** the shore-distance texture covers the region at 1024 x 1024 (baked only near obstacles); the water mesh follows the camera, snapped to its grid.
- **Scale:** about 25 obstacles and a few dozen scenery boxes; no streaming. Collision stays O(obstacles x hull circles) per tick.
- **Tests:** `tests/routes.test.js` (geometry, graph, planner, limits, bonus, scripted captain on every route and vessel) and `tests/e2e/chart.cjs`.
