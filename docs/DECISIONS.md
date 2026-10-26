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
