# Staged Development Roadmap

The stages below are sequential. Claude Code must stop at the end of each stage and report what is complete, what was tested, and what remains.

## Stage 0 — Discovery and technical plan
**Do not build the full game yet.**
- Inspect repository, installed engine/tooling, and target platform assumptions.
- Compare Unreal Engine 5 and Unity; recommend and document one.
- Define the box-world scale, minimum hardware target, controls, and initial art approach.
- Produce game design, technical design, architecture, asset plan, risk register, and stage acceptance criteria.
- Identify any required SDKs or external tools before relying on them.
**Gate:** user approves the architecture and Stage 1 scope.

## Stage 1 — Playable sailing prototype
**Proposed acceptance criteria (for approval at the Stage 0 gate):**
1. Project builds from README instructions (Node + `npm run build`) and plays in a browser (engine: Three.js, see D-005).
2. One 2 km cell with one simple port, labeled placeholder assets, basic water and sky.
3. One small motorboat: throttle, reverse, steering with visible inertia; chase camera with adjustable sensitivity.
4. Collision with shore/dock/buoys is detected; respawn at last safe point on demand or after grounding.
5. One route with start and finish markers; reaching the finish shows a simple completion message and time.
6. Frame rate meets the Stage 0 target on the agreed minimum hardware (measured, recorded in STATUS.md).
7. Unit tests for vessel movement, collision and route logic pass; manual drive checklist (docs/MANUAL_TESTS.md) completed by the user.
**Exclusions:** missions board, licenses, saves, multiple vessels, weather, waves beyond basic, multiple ports, audio polish, menus beyond start/quit.

- One test sea area, one simple port, one small boat.
- Basic throttle, reverse, steering, camera, collision, and respawn.
- Basic water and sky; placeholder assets are acceptable but labeled.
- One short route with start and finish markers.
**Gate:** player can reliably control the boat and complete the route; build/test instructions work.

## Stage 2 — Port-to-port mission vertical slice
**Status: implemented 2026-10-29, awaiting user testing and approval.** Acceptance criteria used:
1. Mission board lists missions with route, cargo, deadline, reward and risk; selecting one opens a briefing (forecast, vessel, license note, docking rules).
2. Depart, follow buoy gates, enter the destination berth, hold still and aligned for 2 s to dock.
3. Success and failure states: success scores safety / navigation / timing / docking with a plain-language reason for each deduction; failure on hull breach, timeout (2x deadline) or abort.
4. Reward (credits, reputation, XP) and best result per mission persist across a page reload.
5. Mission state is robust: retry, restart, abort and a failed docking attempt (too fast / misaligned / leave the berth) never corrupt state; each run starts fresh.
6. Two real port-to-port missions (Harbor -> Pine Isle, Pine Isle -> Harbor) plus the Stage 1 loop as a training mission.
**Exclusions kept out:** licenses/exams (Stage 3), more vessels (Stage 4), weather (Stage 5), connected multi-port region (Stage 6), fuel, passengers, route planning screen.

- One mission board and mission briefing.
- Departure, navigation objective, destination approach, docking zone, success/failure states.
- Simple reward and results screen.
- Mission state is robust to restart and failed docking.
**Gate:** complete the mission loop repeatedly without breaking state.

## Stage 3 — License and career progression
**Status: implemented 2026-10-29, awaiting user testing and approval.** Acceptance criteria used:
1. Small Craft Permit path: two training tasks (score 50+ each), a written test (4 of 5 correct, free retakes with new shuffled questions), and a practical exam mission (score 70+, at most 2 damaging collisions, 100-credit fee per attempt).
2. Prerequisites enforced from data: a license can require other licenses, reputation, training scores, the written test and credits for the exam fee.
3. Permissions enforced: contracts need the permit; training is open to everyone; vessel use is checked per class, ready for Stage 4.
4. **Gate:** passing the exam awards the license (once), pays the bonus and unlocks contracts and the vessel; failing leaves progression unchanged except attempts and best score, keeps contracts locked and costs another fee to retake.
5. Score feedback: every result explains deductions and shows coaching tips for the weakest categories; exam results list each pass check.
6. Career profile saved (version 2) with licenses, exam and test history; Stage 2 saves migrate (players who already ran contracts keep the permit).
7. Next tier (Coastal Skipper) exists in data with prerequisites (permit + reputation 10) enforced and shown as locked; its exam is not yet playable.
**Exclusions kept out:** playable second exam, new vessels (Stage 4), weather (Stage 5), real-world license content.
- Small Craft Permit training and exam.
- License prerequisites, in-game permissions, score feedback, career profile/save.
- One next-tier license represented in data, even if only the first exam is fully playable.
**Gate:** passing/failing an exam correctly changes progression and permitted vessel access.

## Stage 4 — Vessel variety and handling
**Status: implemented 2026-10-29, awaiting user testing and approval.** Acceptance criteria used:
1. Three vessel classes with different dimensions and measurably different handling: Harbor Skiff (small motorboat), Harbor Workboat, Coastal Cat (coastal passenger craft). Pick-up, top speed, stopping distance, turning circle, coasting, wind drift and hull toughness all differ and are unit-tested with ordering and minimum ratios.
2. Fleet screen with inspection (dimensions, six measured stat bars, license requirement) and selection of the active vessel, saved in the profile.
3. License gates: the workboat and passenger craft need the Coastal Skipper; contracts name the vessels they accept; locked jobs explain what is missing. The Coastal Skipper is now earnable end to end (training trials under instruction, written test, exam in the workboat).
4. Improvements: three-circle hulls sized per vessel, per-vessel damage (tougher hulls), separate astern thrust and low-speed resistance (stopping and coasting), per-vessel turn authority, and a steady wind with per-vessel leeway shown on the HUD.
5. Vessel choice changes play: vessel-specific contracts (Heavy Gear Haul, Passenger Shuttle), deadlines scaled by vessel speed, and a briefing that lets you pick among the vessels a job allows.
**Exclusions kept out:** changing weather and waves (Stage 5), tugs/ferries/cargo ships (Stage 7), fuel, vessel purchase or rental economy, passenger comfort scoring.
- Add at least three vessel classes with meaningful differences in handling and dimensions.
- Ship selection/inspection and license gates.
- Improve collision, stopping distance, turning, and wind response.
**Gate:** vessel choice materially changes the gameplay and license restrictions work.

## Stage 5 — Water, waves, and weather upgrade
**Status: implemented 2026-10-29, awaiting user testing and approval.** Acceptance criteria used:
1. Water: four directional wave components raised by the weather (wave height from sea state, direction downwind, nothing too short to resolve), analytic normals, crest whitecaps, shoreline foam and shallow-water tint from a baked shore-distance texture, and a boat wake.
2. Weather: five data-driven presets (Calm, Fresh breeze, Moderate sea, Rough sea, Fog bank) with gusting, veering wind, sea state, cloud and visibility; each mission names its weather; briefings show the forecast.
3. Gameplay: sea state slows and blunts steering in proportion to wave height against hull length (small boats suffer most, calm water costs nothing); wind gusts change leeway drift; deadlines scale with vessel and sea; fog limits how far you can see. All constants are in one tunable block (`SEA_TUNING`).
4. Scalability: Low / Medium / High presets plus Auto (starts Medium, only ever steps down after sustained slow frames), selectable in Settings; each preset changes render resolution, water mesh density, wave count, foam and wake.
5. Profiling: optional on-screen FPS / 1% low / frame time / draw calls overlay and a built-in benchmark that measures all three presets in a rough sea and recommends one. Real numbers must come from the player's own machine.
**Exclusions kept out:** rain, lightning, tides/currents, weather that changes mid-mission, sound, shadows, reflections of scenery.
- Upgrade visual ocean, directional waves, wake/foam as budget allows, wind, sea states, fog/visibility.
- Connect sea conditions to handling in a readable, tunable way.
- Add graphics scalability and profile performance.
**Gate:** visuals and simulation are stable at target settings and weather affects gameplay.

## Stage 6 — Multiple ports and route planning
**Status: implemented 2026-10-29, awaiting user testing and approval.** Acceptance criteria used:
1. A connected region: Bluewater Bay, a bounded 4 km x 4 km box (2 x 2 cells) with four ports (Bluewater Harbor, Pine Isle Landing, Cape Quay, Southgate Marina), islands, reefs, a spit and coasts. The whole region is loaded at once (no streaming needed at this size).
2. Navigation chart: 17 markers and charted legs with computed lengths and clearances; one narrow passage (the Seal Rocks gap) as a deliberate shortcut hazard.
3. Route planning: for every port pair the planner offers the shortest route and distinct alternatives; the player can pick a suggestion or build a route marker by marker (list or clicking the chart); incomplete or invalid routes cannot be confirmed; distance, estimated time, deadline and hazards are shown.
4. The planned route is what the mission sails (gates, objectives, distance-to-go, deadline); the results name the route.
5. Port approach limits: slow zones around every berth with a HUD readout, a warning, and a Navigation penalty; vessel size limits per port (Southgate takes up to 12 m).
6. Port-to-port progression: nine contracts across all four ports; far jobs need reputation 5 to 10; some need a specific vessel; arriving well inside the deadline pays up to +15%.
**Gate:** choose and complete different routes with clear objectives. Verified by a scripted captain on every suggested route with every allowed vessel (37 combinations) plus browser tests.
**Exclusions kept out:** world streaming, tides and currents, channel draft limits and large vessels (Stage 7), more mission types and a changing economy (Stage 8).
- Add a small connected region with multiple ports.
- Chart/route planning, navigation markers, route distance, port approach limits.
- Mission selection and port-to-port progression.
**Gate:** player can choose and complete different routes with clear objectives.

## Stage 7 — Larger commercial vessels
**Status: implemented 2026-10-31, awaiting user testing and approval.** Acceptance criteria used:
1. Two commercial vessels, a 90 m Coastal Freighter and a 140 m Feeder Carrier (container prototype), with handling an order of magnitude heavier than the small craft: 50 to 60 s to reach speed, 70 to 90 m to stop from 12 kn, 40 to 55 m turning circles, long coasting, huge windage on the container stack. (The workboat covers the roadmap's tug/ferry/workboat line; a separate tug or ferry is backlog.)
2. Port channel constraints: shoal areas only deep-draft ships cannot cross (draft plus 1 m must fit the shoal depth), a dredged channel to two deep-water terminals, shown as pale shallows on the water, the chart and with a warning; groundings damage the hull.
3. Berth constraints: Cape Quay gets a 220 m deep-water berth and a new Driftwood Terminal; ports show each vessel the berth that fits it, commercial terminals refuse small craft, and small harbors refuse ships. A long ship must fit inside the berth (its centre stays clear of the ends); docking accuracy is judged against the berth.
4. Cargo objectives: cargo jobs have a Cargo score (20 points) that falls when hard turns at speed shift the load or the hull is damaged, with a HUD readout and warnings.
5. A gated path: Large Vessel Endorsement (needs the Coastal Skipper and reputation 30; sea trials in each ship, written test, freighter exam), four deep-water contracts (container jobs also need reputation 45).
6. Ship detail and scale cues: distinct freighter and container models (instanced container stacks), quay gantry cranes and container stacks, and a fleet size chart drawing every vessel to the same scale next to a 100 m reference.
7. The chart and route planner are draft-aware: closed legs are drawn dotted red, a ship's route options stay in the channel, and routes are checked for shoals.
**Gate:** large-vessel missions are playable and differentiated. Verified by a scripted captain on every ship route, a hull sweep with shoals active along every ship route, and browser tests.
**Exclusions kept out:** tug assistance, a ferry, tides and changing depth, harbor pilots, multi-berth traffic.
- Cargo ships, ferry/tug or workboat, and a container carrier prototype.
- Port channel constraints, larger turning radius, draft/berth constraints, cargo objectives.
- Improve ship detail and scale cues.
**Gate:** large-vessel missions are playable and differentiated.

## Stage 8 — Content, career depth, and polish
- More mission types, port variety, sound design, UI polish, tutorials, accessibility.
- Economy, repairs/upgrades, reputation, repeatable career loop.
- Performance, QA, save compatibility, and bug fixing.
**Gate:** release candidate scope is stable and documented.

## Stage 9 — Special vessel content and release preparation
- Add original legendary/heritage vessels first.
- Add Titanic, Black Pearl, or other recognizable ships only after rights/IP review and required permissions.
- Build packaging, platform-specific settings, credits, attribution, asset licenses, and release checklist.
**Gate:** all distributed assets have verified rights and the release build passes smoke tests.

## Rule for every stage
Before implementation: restate the stage goal, exclusions, and acceptance criteria. After implementation: run available tests/build, record exact outcomes, update `docs/STATUS.md`, and stop for user approval.
