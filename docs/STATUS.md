# Project Status

## Current stage
Stage 6 — Multiple ports and route planning. **Implemented; awaiting your hands-on testing and approval (stage gate).** Stages 1 to 5 remain open for tuning feedback.

## What was built (Stage 6)
- **Bluewater Bay:** the world grew from one 2 km cell to a 4 x 4 km region with four ports: Bluewater Harbor (west), Pine Isle Landing, Cape Quay (east coast) and Southgate Marina (south coast), plus islands, Anvil Reef, Tern Island, Long Spit and the Seal Rocks. Each port has a coloured beacon on its pier. The region edge turns you back.
- **Chart screen** (Board > Chart, or "Plan route on the chart" in a job briefing): a map with land, ports, markers, charted legs, and your route in gold.
- **Route planning:** for each job the chart suggests the shortest route and real alternatives. You can pick one or build your own by adding legs from a list or by clicking markers on the map. Distance, estimated time, deadline and hazards are shown, and an unfinished route cannot be used.
- **The planned route is the mission:** gate buoys, objectives, distance-to-go on the HUD, the deadline (longer routes get longer deadlines), and the results screen all follow the route you chose.
- **Port approach limits:** each port has a slow zone (10 to 14 kn) with a HUD readout and a warning; going over costs Navigation points and the results explain it. Each port also has a maximum vessel length (Southgate Marina takes up to 12 m).
- **Nine contracts** across all four ports. Far jobs need reputation 5 to 10; some need a specific vessel; arriving well inside the deadline pays up to +15% credits.
- **The Seal Rocks gap:** a deliberate narrow shortcut (about 30 m wide) on the way to Cape Quay.

## Verified (cloud container, headless Chromium with software rendering)
- `npm test`: 168/168 pass in about 3 seconds. New: port berths and start poses are clear of obstacles; slow zones; chart markers in open water; every leg's clearance and a hull sweep along every leg for every vessel; gate buoys clear of land; route search (every port pair is connected, busy pairs have alternatives, shortest first, bounded detour, never through another port); whole-trip route length; waypoints; narrow-passage reporting and vessel passability; deadlines and time estimates; hand-built route validation; `planMission`; speed-limit counting, scoring and warnings; early-arrival bonus; reputation and port-size access rules; chart projection and marker picking; the scripted captain on **every suggested route with every allowed vessel (37 combinations)**, all on time and with score at least 60.
- Browser tests: new `chart.cjs` (reputation lock, chart view, briefing route, planning, suggested and hand-built routes by list and by clicking the map, confirm, sailing the planned route, HUD distance-to-go and slow-zone readout and warning, penalty explained in the results, route named in the results, vessel limits at the marina, region edge) plus the earlier `weather`, `vessels`, `license`, `mission` and `touch` suites, which were updated for the larger board. All six suites passed against the final build.
- Screenshots of the chart on desktop and a 390 px phone, Cape Quay docking and the south coast reviewed by eye. A real bug found this way (the chart canvas inherited the game canvas's full-screen style) was fixed.

## NOT verified
- **Frame rate with the larger world on real GPUs** (more land and water to draw). Static scenery is a few dozen boxes, so I expect little change, but I have not measured it. Run the Stage 5 benchmark again.
- **How the long routes feel to play.** Cape jobs take 6 to 10 minutes. Deadlines, rewards, slow-zone strictness and the +15% bonus are my estimates.
- Whether clicking markers on the chart feels good with a mouse or a finger (verified with synthetic clicks and taps only).
- Real phone behaviour of the chart; Firefox/Safari.
- The Stage 6 manual checklist has not been run by a human.

## Next action (needs the user)
Open a long contract (for example Cape Quay Parcel Run once you have reputation 5), plan a route on the chart, sail it, and tell me whether the chart is clear, the distances and deadlines feel right, and whether the slow zones are annoying or fair. Then approve Stage 7 (larger commercial vessels) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stages 1 to 5: Implemented 2026-10-26 to 2026-10-29; gates not formally passed.
- Stage 6: Implemented 2026-10-29; gate not yet passed.
