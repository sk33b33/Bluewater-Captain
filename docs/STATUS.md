# Project Status

## Current stage
Stage 4 — Vessel variety and handling. **Implemented; awaiting your hands-on testing and approval (stage gate).** Stages 1 to 3 remain open for tuning feedback.

## What was built (Stage 4)
- **Three vessels** with real differences: Harbor Skiff (6.5 m, quick, tight turns, wind-sensitive), Harbor Workboat (11 m, heavy, tough, slow to turn and stop, shrugs off wind), Coastal Cat (15 m passenger craft, long stopping distance, widest turns, most windage).
- **Fleet screen** (board > Fleet): dimensions, six stat bars measured from the boat model, license requirement, and a button to choose your active vessel (saved).
- **Vessel gates:** workboat and Coastal Cat need the Coastal Skipper. Locked jobs say what is missing.
- **Coastal Skipper is earnable now:** Workboat Sea Trials and Passenger Craft Sea Trials (open once you hold the permit and reputation 10), written test (8-question pool), and a workboat exam to Pine Isle (fee 250).
- **Vessel choice matters:** Heavy Gear Haul needs the workboat, Pine Isle Passenger Shuttle needs the Coastal Cat; the two supply contracts accept any vessel you hold, picked on the briefing. Deadlines scale with the vessel.
- **Handling improvements:** per-vessel astern thrust and coasting, turn authority, a three-circle hull and damage by hull strength, and a steady 8-knot north-westerly wind with per-vessel drift. The HUD shows wind speed and which way it pushes your bow.
- **Visuals:** a distinct placeholder model for each vessel built from its real size; camera distance follows the vessel.
- Profile v3 stores the active vessel; Stage 2 and 3 saves migrate.

## Verified (cloud container, headless Chromium with software rendering)
- `npm test`: 101/101 pass. New: vessel definitions valid; each reaches its top speed; stopping distance, coasting, turning circle and acceleration ordered with minimum ratios; wind direction/drift/windage ordering; hull circles scale and a bigger hull hits a wall a smaller one clears; damage per hit by hull strength; deadline scaling; fleet selection gates; contract vessel rules and `chooseVessel`; Coastal Skipper path end to end; profile v3 round trip and v2 migration; fleet stat rows match independent measurement. A scripted captain completes **every mission with every vessel it allows**, wind on, with a clean hull (one run each).
- Browser end-to-end tests (headless Chromium over local HTTP): `vessels.cjs` (fleet, gates, vessel choice on the briefing, deadline scaling, wind HUD, driving the workboat and Coastal Cat, persistence), `license.cjs`, `mission.cjs` and `touch.cjs` each passed after the final changes. The vessel test passed twice, once with a HUD timing race fixed in the test itself; they are slow and not part of `npm test`.
- Screenshots reviewed by eye.

## NOT verified
- Frame rate on any real GPU; how each vessel *feels* by hand. The handling numbers, deadline factors, wind strength and fees are my estimates. A scripted captain proves the missions are possible, not that they are fun.
- Real phone behaviour of the fleet screen and the bigger vessels' camera; Firefox/Safari; gamepad.
- Failing missions through real hull damage with each vessel in the browser (unit tests cover damage by strength).
- The Stage 4 manual checklist has not been run by a human.

## Next action (needs the user)
Drive each vessel, ideally on your phone: skiff, then earn the Coastal Skipper (or tell me to give you a test profile) and try the workboat and Coastal Cat. Tell me whether the vessels feel different enough, whether the wind is too strong or too weak, and what is hard. Then approve Stage 5 (water, waves, weather) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stage 1: Implemented 2026-10-26; touch controls added after user test; gate not formally passed.
- Stage 2: Implemented 2026-10-29; gate not formally passed.
- Stage 3: Implemented 2026-10-29; gate not formally passed.
- Stage 4: Implemented 2026-10-29; gate not yet passed.
