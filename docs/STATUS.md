# Project Status

## Current stage
Stage 7 — Larger commercial vessels. **Implemented; awaiting your hands-on testing and approval (stage gate).** Stages 1 to 6 remain open for tuning feedback.

## What was built (Stage 7)
- **Two ships**: the 90 m Coastal Freighter and the 140 m Feeder Carrier (container prototype). They take about a minute to reach speed, 70 to 90 m to stop from 12 kn, turn in a 40 to 55 m circle and coast for hundreds of metres. Waves barely touch them but the container stack catches the wind.
- **Deep-water terminals**: Cape Quay gained a 220 m deep-water berth and quay, and a new port, Driftwood Terminal, sits in the sheltered south-east bay. Gantry cranes and container stacks line the quays.
- **Shoals and draft**: shallow areas (pale green on the water and the chart) that ships cannot cross; a dredged channel joins the terminals. A warning tells you when you are near the shallows, and a grounding damages the hull. The skiff, workboat and Cat sail straight over them.
- **Port limits**: ships get the deep berth, small craft the old pier; Driftwood only takes vessels of 30 m and up; the harbors and marina refuse ships. A long ship must fit inside its berth.
- **Cargo jobs**: four deep-water contracts (freighter and container). A new Cargo score and HUD readout tracks the load; hard turns at speed shift it. Plan turns early.
- **Large Vessel Endorsement**: Coastal Skipper plus reputation 30, sea trials in each ship, a written test and a freighter exam (fee 800, at most 1 collision). Container jobs also need reputation 45.
- **Scale cues**: a fleet size chart draws every vessel to the same scale with a 100 m reference; the chart shows shoals and closed legs; draft-aware route planning keeps ships in the channel.

## Verified (cloud container, headless Chromium with software rendering)
- `npm test`: 205/205 pass in about 4 seconds. New: ships are an order of magnitude heavier (pick-up, stopping, turning, ordering); sea and wind effects; ships reach top speed and stop; hull circles leave no gaps on a 140 m ship; shoals block exactly the vessels that need more water; a ship runs aground where the skiff does not; the channel is clear for the biggest ship; port variants and size limits both ways; berth fit and docking tolerance; cargo strain (counting, warning once, only on cargo jobs); cargo scoring weights and explanation; the Large Vessel Endorsement path and gates; route planning for ships (only deep legs, alternatives in both directions, hand-built routes rejected across shoals); `planMission` picks the right start and berth; **a hull sweep along every ship route with shoals active**; and the scripted captain on every ship route plus the exam and trials, with cargo unshifted and a clean hull on all but a small scrape on one route.
- Browser tests (headless Chromium over local HTTP): new `ships.cjs` (fleet, scale chart, harbors refuse ships, briefing advice, chart for a ship, planning, ship starts at the deep berth, HUD cargo and slow zone, cargo strain, grounding on a shoal, finishing at Driftwood, small craft still use the small pier, the endorsement path and trials) plus `chart`, `weather`, `vessels`, `license`, `mission`, `touch` updated for the bigger board. All seven suites passed against the final build.
- Screenshots of the ships, quays, cranes, channel, shoals, chart and result screen reviewed by eye. A real bug found this way (ships starting at the small pier because the mission instance was built without the vessel) was fixed.

## NOT verified
- **Frame rate with ships, cranes and the larger scene on real GPUs.** The container ship and quays use instanced and merged meshes (a few draw calls each), but this is untested on your hardware. Please run **Settings, Run benchmark** again.
- How the ships *feel*. The thrust, turning, stopping, cargo limits (0.55 and 0.4 m/s^2), deadline factors (1.3 and 1.4) and exam fee are my estimates. A scripted captain proves the jobs are possible, not that they are fun. Ship jobs are long: about 10 minutes for the scripted captain on a 3.6 km route.
- Real phone behaviour with a 140 m ship (camera distance, controls) and Firefox/Safari.
- The Stage 7 manual checklist has not been run by a human.

## Next action (needs the user)
1. Run the benchmark again and send me the three rows.
2. Ask for a test profile with the endorsement (or earn it), take the freighter and the Feeder Carrier down the channel, and tell me whether they feel big and heavy but fair, whether the cargo strain is too strict, and whether the jobs are too long.
3. Then approve Stage 8 (content, career depth and polish) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stages 1 to 6: Implemented 2026-10-26 to 2026-10-29; gates not formally passed.
- Stage 7: Implemented 2026-10-31; gate not yet passed.
