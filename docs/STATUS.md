# Project Status

## Current stage
Stage 1 — Playable sailing prototype. **Implemented; awaiting your hands-on testing and approval (stage gate).**

## What was built
Browser game (Three.js, D-005): one 2 km sea cell, a walled harbor with pier, three islands, a 5-gate route (~2 km), one placeholder motorboat with inertia, steering and sideways slip, animated waves with buoyancy, sky, collisions, respawn, grounding/out-of-bounds auto-return, chase camera, HUD, settings, keyboard + gamepad.

## Verified (in the cloud container)
- `npm test`: 19/19 unit tests pass, including an autopilot that completes the whole route with no collisions in under 300 s.
- `npm run build`: produces `dist/index.html` (482 KB).
- Headless Chromium (software rendering): page loads with no console errors, start screen shows, Enter/click starts, W accelerates the boat. Screenshots were reviewed by eye.

## NOT verified
- Frame rate on a GTX 770 or any real GPU (software rendering here cannot measure it).
- Real keyboard/mouse/gamepad feel; handling tuning; camera comfort.
- Firefox/Edge/Safari; touch devices (not supported in Stage 1).
- The manual checklist in `docs/MANUAL_TESTS.md` has not been run by a human.

## Next action (needs the user)
Play it, run `docs/MANUAL_TESTS.md`, report fps and anything that feels wrong. Then approve Stage 2 (mission board, briefing, docking, results) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stage 1: Implemented 2026-10-26; gate not yet passed.
