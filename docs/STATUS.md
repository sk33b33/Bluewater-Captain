# Project Status

## Current stage
Stage 2 — Port-to-port mission vertical slice. **Implemented; awaiting your hands-on testing and approval (stage gate).** Stage 1 remains open for tuning feedback.

## What was built (Stage 2)
- Mission board with 3 missions: Pine Isle Supply Run, Island Produce Return (the two port-to-port runs, each ends with docking) and the Coastal Training Loop (Stage 1 course).
- Briefing screen, depart, buoy gates, destination berth marker, docking guidance panel (position / speed / angle chips, hold bar), hull integrity, deadline timer.
- Results screen with per-category scoring and reasons, rewards, best grade; failure screen (hull breach, timeout, abort); pause menu (resume / restart / abort / settings).
- Career profile (credits, reputation, XP, best results) saved in the browser and validated on load.
- Second port: Pine Isle Landing pier and berth.
- Fixed a rendering bug where wave troughs showed pale patches (the flat far-water plane poked through).

## Verified (cloud container, headless Chromium with software rendering)
- `npm test`: 43/43 pass. Includes a scripted captain that completes all three missions within their deadlines with collisions on, docking at both ports, and repeat runs with fresh state; scoring, failure, respawn, docking-hold reset and profile corruption cases.
- `tests/e2e/mission.cjs`: 23/23 checks pass: board, briefing, depart, waypoints to docking, dock hold to result, credits awarded, reload persistence, repeat attempt with fresh state, pause/resume, restart, abort -> failed screen pays nothing, retry after failure, training mission completes. Boat positions are teleported in that test.
- `tests/e2e/touch.cjs`: phone emulation, touch drags still steer and throttle after the menu changes.
- Screenshots reviewed by eye on desktop and a 390x844 phone.

## NOT verified
- Frame rate on any real GPU (software rendering here cannot measure it).
- How docking *feels* for a human: the 1.5 m/s / 25 degree / 2 s tolerances and the boat's coasting are my estimates; the scripted captain only proves it is possible.
- Real phone behaviour, Firefox/Safari, gamepad.
- Hull-breach failure through real collisions in the browser (covered by unit tests only).
- The manual checklist in `docs/MANUAL_TESTS.md` has not been run by a human.

## Next action (needs the user)
Play the three missions (ideally on your phone via Vercel), run the Stage 2 checklist, report what feels wrong (docking difficulty, deadlines, rewards, controls). Then approve Stage 3 (licenses and career) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stage 1: Implemented 2026-10-26; touch controls added after user test; gate not formally passed.
- Stage 2: Implemented 2026-10-29; gate not yet passed.
