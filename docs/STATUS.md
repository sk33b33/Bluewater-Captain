# Project Status

## Current stage
Stage 8 — Content, career depth and polish. **Implemented (reduced scope, see ROADMAP); awaiting your hands-on testing and approval (stage gate).** Stages 1 to 7 remain open for tuning feedback.

## What was built (Stage 8)
- **Hull wear and repairs:** damage now carries from job to job, per vessel. Repair on the Fleet screen (cost scales with vessel size); a broke player with a wreck gets a free patch to 50 percent. A hull wrecked on a job is towed in at 20 percent.
- **Upgrades:** engine tune-up, hull plating and rudder kit for every vessel, bought on the Fleet screen; they change the physics.
- **Career loop:** ranks (Deckhand to Commodore) shown on the board, and two rotating featured contracts at +35 percent that change as you finish jobs.
- **Content:** two heavy-weather contracts (Storm Gear Haul for the workboat, Storm Cargo to Driftwood for the freighter).
- **Tutorial hints:** seven one-time contextual hints; the basic ones stop after four jobs.
- **Accessibility:** text and panel size (three levels) and high contrast, both remembered.
- **Compatibility:** profile v4; v1 to v3 profiles and backups load; older mid-mission saves resume.
- **Fixed on the way:** hints used the run clock, which only starts once you move; they now use a play clock.

## Gap-closing pass (2026-11-03)
Added mid-mission save and Resume, a progress backup file, procedural sound with volume and mute, edge-detected gamepad input, and a phone-layout audit with CSS fixes. See D-012 and the README. Verified by unit tests and headless Chromium (`extras.cjs`, `mobile.cjs`); not heard, not tried on a real pad or phone.

## Verified (cloud container, headless Chromium with software rendering)
- `npm test`: 245/245 pass in about 4 seconds. New: ships are an order of magnitude heavier (pick-up, stopping, turning, ordering); sea and wind effects; ships reach top speed and stop; hull circles leave no gaps on a 140 m ship; shoals block exactly the vessels that need more water; a ship runs aground where the skiff does not; the channel is clear for the biggest ship; port variants and size limits both ways; berth fit and docking tolerance; cargo strain (counting, warning once, only on cargo jobs); cargo scoring weights and explanation; the Large Vessel Endorsement path and gates; route planning for ships (only deep legs, alternatives in both directions, hand-built routes rejected across shoals); `planMission` picks the right start and berth; **a hull sweep along every ship route with shoals active**; and the scripted captain on every ship route plus the exam and trials, with cargo unshifted and a clean hull on all but a small scrape on one route.
- Browser tests (headless Chromium over local HTTP): new `ships.cjs` (fleet, scale chart, harbors refuse ships, briefing advice, chart for a ship, planning, ship starts at the deep berth, HUD cargo and slow zone, cargo strain, grounding on a shoal, finishing at Driftwood, small craft still use the small pier, the endorsement path and trials) plus `chart`, `weather`, `vessels`, `license`, `mission`, `touch` updated for the bigger board. All seven suites passed against the final build.
- Screenshots of the ships, quays, cranes, channel, shoals, chart and result screen reviewed by eye. A real bug found this way (ships starting at the small pier because the mission instance was built without the vessel) was fixed.

## Stage 8 verification
- `npm test`: 245/245. New (`tests/career.test.js`, 19 tests): ranks, cost scaling, repairs (partial, none when whole), the free patch, upgrade purchase and physics, plating reducing damage, hull carry-over without double punishment, saves with and without `hull0`, profile v4 migration and bad data, backups, featured rotation, storm jobs completable by the scripted captain (also with every upgrade fitted), hint triggers.
- Browser: new `career.cjs` (rank, featured badge and no stacking on restart, storm labels, fleet repairs and upgrades persisting, the free patch, worn hull in the briefing, HUD and run, hint appears and is remembered, abort keeps damage, accessibility settings persist). `mobile`, `ships`, `chart`, `weather`, `vessels`, `license`, `mission`, `touch`, `extras` also pass against the final build (counts updated for the two new jobs).

## NOT verified
- **Frame rate with ships, cranes and the larger scene on real GPUs.** The container ship and quays use instanced and merged meshes (a few draw calls each), but this is untested on your hardware. Please run **Settings, Run benchmark** again.
- How the ships *feel*. The thrust, turning, stopping, cargo limits (0.55 and 0.4 m/s^2), deadline factors (1.3 and 1.4) and exam fee are my estimates. A scripted captain proves the jobs are possible, not that they are fun. Ship jobs are long: about 10 minutes for the scripted captain on a 3.6 km route.
- Real phone behaviour with a 140 m ship (camera distance, controls) and Firefox/Safari.
- The Stage 7 manual checklist has not been run by a human.

## Next action (needs the user)
0. Stage 8 numbers are guesses: repair prices, upgrade prices, the +35 percent bonus, and whether hull carry-over feels fair or nagging. Please play a few jobs and tell me.
1. Run the benchmark again and send me the three rows.
2. Ask for a test profile with the endorsement (or earn it), take the freighter and the Feeder Carrier down the channel, and tell me whether they feel big and heavy but fair, whether the cargo strain is too strict, and whether the jobs are too long.
3. Then approve Stage 9 (special vessel content and release preparation) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stages 1 to 6: Implemented 2026-10-26 to 2026-10-29; gates not formally passed.
- Stage 7: Implemented 2026-10-31; gate not yet passed.
- Stage 8: Implemented 2026-11-03 (reduced scope); gate not yet passed.
