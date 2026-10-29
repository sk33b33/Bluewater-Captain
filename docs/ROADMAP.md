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
- Small Craft Permit training and exam.
- License prerequisites, in-game permissions, score feedback, career profile/save.
- One next-tier license represented in data, even if only the first exam is fully playable.
**Gate:** passing/failing an exam correctly changes progression and permitted vessel access.

## Stage 4 — Vessel variety and handling
- Add at least three vessel classes with meaningful differences in handling and dimensions.
- Ship selection/inspection and license gates.
- Improve collision, stopping distance, turning, and wind response.
**Gate:** vessel choice materially changes the gameplay and license restrictions work.

## Stage 5 — Water, waves, and weather upgrade
- Upgrade visual ocean, directional waves, wake/foam as budget allows, wind, sea states, fog/visibility.
- Connect sea conditions to handling in a readable, tunable way.
- Add graphics scalability and profile performance.
**Gate:** visuals and simulation are stable at target settings and weather affects gameplay.

## Stage 6 — Multiple ports and route planning
- Add a small connected region with multiple ports.
- Chart/route planning, navigation markers, route distance, port approach limits.
- Mission selection and port-to-port progression.
**Gate:** player can choose and complete different routes with clear objectives.

## Stage 7 — Larger commercial vessels
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
