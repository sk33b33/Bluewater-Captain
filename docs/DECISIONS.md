# Architecture Decision Log

Record each decision with date, context, options, decision, and consequences.

## D-001 — Engine choice: Unreal Engine 5 (SUPERSEDED by D-005)
- Date: 2026-10-26
- Status: **ACCEPTED by user (2026-10-26): Unreal Engine 5, Windows PC only.** Exact UE version to be pinned at Stage 1 start, once the user's install is known. Remaining open: GPU minimum, C++/Blueprint familiarity, who builds.
- Platform: Windows 10/11 PC only for now; consoles are a possible later port, mobile/Mac/browser out of scope. Engine is free to download (check Epic's current royalty terms).
- Workflow: user builds/tests on their PC. Preferred setup is Claude Code installed locally in the UE project folder so builds/tests can be run from the command line; the cloud session can only write code and docs.
- Context: The repository was empty (no engine project, no Unreal/Unity install). The session runs in a Linux cloud container with Node 22 only; no GPU, no engine editor. Target hardware is not yet stated.
- Options: Unreal Engine 5, Unity (6 LTS), keep-existing (n/a, nothing exists).
- Decision (provisional): **Unreal Engine 5 (latest stable 5.x at Stage 1 start; pin the exact version then)**, using C++ for vessel physics/core systems and Blueprints for content wiring.
- Reasons: built-in Water plugin and Fab ocean/ship content for high-fidelity visuals; World Partition for the bounded streamed world; Chaos physics; Niagara for wake/foam.
- Consequences / costs: heavier minimum hardware (see TECHNICAL_DESIGN §3), large project size, slower iteration than Unity, steeper C++ learning curve, and **this cloud container cannot build or run UE5**. Every "verified" claim in later stages requires the user (or a configured machine) to run the build.
- Switch trigger: choose **Unity** instead if the user (a) targets integrated-GPU / low-end PCs or mobile, (b) knows C# and not C++/Blueprints, or (c) wants faster prototype iteration over top-end water fidelity.

## D-002 — Box world definition (PROPOSED)
- See `docs/GAME_DESIGN.md` "World model". A bounded 8 km x 8 km sea volume, split into 2 km cells, with hard edges hidden by weather/fog and "return to chart" soft boundaries.

## D-003 — Licenses are fictional (ACCEPTED, from kit)
- Game credentials only; not a representation of any real licensing regime.

## D-004 — Fictional vessels by default (ACCEPTED, from kit)
- Titanic / Black Pearl-style ships are Stage 9, rights-dependent. Early content is original.

## D-005 — Browser game with Three.js (ACCEPTED by user, 2026-10-26)
- Context: after choosing UE5, the user disclosed a GTX 770 (2013, 2 GB-class). UE5 is not realistically usable on it, and the cloud session cannot run UE5 at all. User chose the browser option.
- Options considered: UE5 (needs GPU upgrade), Unity (lighter, still a stretch, local install), browser game.
- Decision: **Three.js (WebGL) + plain JavaScript (ES modules), bundled with esbuild into a single `dist/index.html`.** No runtime services, no network dependencies, no accounts.
- Why: runs on the user's GPU at modest settings; the cloud session can build, unit-test, and screenshot it headlessly; the user plays by opening a link or file with nothing to install.
- Consequences: water/ship fidelity is capped well below UE5 (stylized, simple meshes); large vessels and many ports in later stages need LOD and budget discipline; no console path. Simulation is engine-agnostic JS (`src/sim/`), so a later engine port stays possible.
- Hardware target is now: GTX 770-class GPU, 1080p, 30 fps on Low-graphics, 60 fps desired (to be measured on the user's PC).

## D-006 — Stage 2 mission model (ACCEPTED as part of Stage 2 build, 2026-10-29)
- Missions and berths are data (`src/data/missions.js`); the run state machine, docking check and scoring are pure code in `src/sim/mission.js` and fully unit-tested.
- Docking: boat centre inside the berth rectangle, speed <= 1.5 m/s (about 3 kn), within 25 degrees of the pier line (either direction), held 2 s. Leaving or speeding resets the hold, so a failed attempt is simply retried.
- Scoring (dock missions): Safety 30, Navigation 20, Timing 20, Docking 30; non-dock missions: 40/40/20. Each category shows its reason. Grades S/A/B/C/D at 90/80/65/50.
- Failure: hull integrity 0 (damage = 4% per m/s of impact above 1 m/s), time over 2x deadline, or abort. Failed missions pay nothing.
- Persistence: versioned profile `{version:1, credits, reputation, xp, completed}` in localStorage, validated on load; an in-progress mission is not saved (reload returns to the board). Stage 3 will own full career saves and migrate this.
- The harbor mouth waypoint was added after the scripted-captain test showed a straight line from the entrance to the basin cut through the breakwater.

## D-007 — Stage 3 license model (ACCEPTED as part of Stage 3 build, 2026-10-29)
- Licenses are data (`src/data/licenses.js`): prerequisites (licenses, reputation), training tasks with minimum scores, written test, practical exam, permitted vessel classes, unlocks, pass bonus. All rules are pure code in `src/sim/licenses.js` and unit-tested; UI only displays them.
- Mission kinds: `training` (open to all), `contract` (needs the license), `exam` (needs training + written test + fee). Contracts were gated by the Small Craft Permit; this changes Stage 2 behaviour on purpose.
- Exam economics: 100-credit fee charged on departure, not refunded on fail or abort; pays no credits. Training pays enough (about 200+ credits from two runs) to afford the first attempt, and training can be replayed for more.
- Written test: 10-question pool, 5 drawn per attempt with shuffled options, pass 4 of 5, free retake. Questions teach this game's rules and general safe-boating ideas; they are fictional credentials, not legal or safety training.
- Profile v2 adds `licenses`. Migration from v1 grants the Small Craft Permit (flagged `grandfathered`) to anyone who already completed a contract run so they are not locked out of progress they had.
- Cheating note: the profile lives in the browser, so it can be edited. Single-player and offline by design; no server validation.
- Test infrastructure: end-to-end tests now serve the build over local HTTP, because `file://` pages showed inconsistent localStorage across reloads in headless Chromium.

## D-008 — Stage 4 vessel model (ACCEPTED as part of Stage 4 build, 2026-10-29)
- Vessels are data (`src/data/vessels.js`): every number changes handling. Physics gained separate astern thrust, low-speed resistance per vessel, turn authority per vessel, and wind leeway. A steady wind (8 kn from the north-west) is applied as drift (`windage x wind speed`), not as a force, so a stopped boat drifts slowly and predictably instead of accelerating away. Stage 5 will replace the wind source.
- Collision hull is three circles sized from vessel length and radius; damage is scaled by `hullStrength`.
- Mission deadlines are written for the skiff and scaled by `deadlineFactor` per vessel (workboat 1.3, passenger craft 1.1), so a slower boat is not punished for being slower. Scoring is unchanged.
- The Coastal Skipper became earnable in Stage 4 (training trials, written test, workboat exam, fee 250) because the vessel gates need a way to be unlocked. Trials and the exam may use a class you do not hold yet (sailing under instruction) once the license prerequisites are met, never for contracts.
- Each contract lists accepted vessel classes; two new contracts need one specific class.
- The south berth at the harbor pier was removed: starting from it put the boat on a collision course with the pier. All harbor departures and arrivals use the north berth.
- Profile moves to v3 (adds the active vessel; v1 and v2 saves migrate).
- Scripted-captain tests now follow the line between marks (not aim straight at each mark), which made the courses measurable per vessel.

## D-009 — Stage 5 weather, water and performance model (ACCEPTED as part of Stage 5 build, 2026-10-29)
- Weather is a preset id per mission (`src/data/weather.js`); the world changes only by mission, not mid-mission. Gusts and wind veer are deterministic sine sums of time, so tests and replays are reproducible.
- Waves: sum of four sines around the wind direction. Energy follows significant wave height (`sum amp^2 = Hs^2 / 8`), wavelength grows with sea state (never below 14 m so the 7-16 m water grid can resolve it). JS (buoyancy) and the shader use the same set, so boats ride the water you see.
- Sea effect on handling = severity of wave height relative to hull length, ignoring small waves (`calmThreshold`), scaling top speed and steering. It uses one formula for every vessel, so bigger boats cope better without hand-set numbers. Weighted so the worst case still leaves a skiff at about 70% speed.
- Deadlines now scale by vessel factor and by 1 / sea speed factor; calm weather keeps the skiff on the written deadline.
- Quality: three presets plus Auto. Auto starts at Medium and only steps down (2 consecutive 2 s windows below 30 fps, ignoring stalls over 250 ms, 6 s cooldown). It never steps up on its own, to avoid flicker. Old `lowGraphics` settings migrate to Low.
- Wind and wave sources replaced the constant 8 kn wind; the old `WIND` constant remains only for tests and helpers.
- Shore foam and shallow tint come from a 512x512 texture baked once from the obstacle list; this avoids per-pixel geometry maths on weak GPUs.
- Benchmark runs inside the game so the player can measure their own hardware, because headless software rendering here cannot.
- The flat far-water plane is kept at -6 m so wave troughs never expose it (a Stage 2 bug).

## D-010 — Stage 6 world, chart and route model (ACCEPTED as part of Stage 6 build, 2026-10-29)
- **World:** Bluewater Bay is 2 x 2 cells of 2 km (the box world from GAME_DESIGN, at a size that loads whole). Everything stays in memory (about 25 obstacles); streaming is deferred until a larger world needs it. The region edge warns 60 m inside and returns the boat 12 m outside.
- **Chart as a graph:** routes are paths through charted markers, not free drawing. Every leg is pre-validated: its length and clearance come from the real obstacles, and a hull sweep of every leg for every vessel is a unit test. Free-form waypoints were rejected because they could not be verified safe.
- **Ports own their approaches:** each port defines its berth, start pose, fairway marker, inbound waypoints (harbor mouth and basin), slow zone and maximum vessel length. Route search never cuts through another port.
- **Planned missions** name two ports; start, berth, names, default route and deadline are derived. The route the player picks is applied to a copy of the mission (`planMission`), so the base mission is never mutated and retry keeps the chosen route. Training and exams keep fixed courses.
- **Deadlines scale with the route** (`length / 6.8 m/s + 30 s`, then vessel and sea factors), so a longer route is not punished for being longer. Route choice is therefore about risk (narrow passage), the early-arrival bonus (up to +15% credits, from 85% of the deadline down to 50%) and speed-limit zones, not about avoiding timeouts.
- **Port approach limits:** slow zones (10 to 14 kn) cost 0.5 Navigation points per second over the limit, capped at 30% of the category. Port size limits filter which vessels may take a job.
- **Progression:** far contracts require reputation (5 to 10) on top of licenses. Reputation comes from completing jobs, so the bay opens up gradually.
- **Shore texture** now covers the whole region at 1024 x 1024 and is baked only near obstacles; the water mesh follows the camera, snapped to its grid.
- Lesson: a global `canvas {}` style meant for the game view made the chart canvas full-screen. Game canvas rules are now scoped to `#game`.
