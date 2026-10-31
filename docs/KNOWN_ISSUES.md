# Known Issues and Risks

## Open issues
- Frame rate on the user's GTX 770 is unmeasured; the water grid (360x360) and pixel ratio may need tuning.
- Boat, port and islands are crude placeholder primitives; no wake/foam, no audio.
- Touch controls added after Stage 1 on user request; verified only with headless phone emulation (390x844), not on a real phone. Landscape phones hide the stats row. Collision uses simple circles/rects (boat can clip visually into the pier edge).
- Docking tolerances (1.5 m/s, 25 degrees, 2 s hold) and mission deadlines/rewards are unplayed estimates; expect tuning. The boat coasts a long time at low speed, so players must reverse to brake.
- An in-progress mission is not saved: reloading the page returns to the mission board (credits and best results are kept).
- Profile lives in browser storage only: clearing site data or switching browser/device loses it.
- Wave undersampling: the 7 m water grid can shimmer on the shortest (18 m) wave; revisit in Stage 5.
- Mission start positions are teleports (no tug/undocking sequence); the boat starts inside a berth.
- Engine switched from UE5 to browser (D-005); risks R1, R7, R8 below were written for UE5.

- Stage 3 estimates: exam pass mark, collision limit, deadline, fee and training rewards are unplayed. A player short of credits must replay training to afford a retake (intended, but could feel grindy).
- Reaching the Coastal Skipper takes a long grind: permit, reputation 10 (about two contracts), two trials, the written test and a 250-credit exam. The pacing is a guess.
- Profile is editable in browser storage (no server, no anti-cheat).
- Wrong-answer review in the written test names the correct option; there is no explanation audio/graphics and the pool is only 10 questions, so repeat players will see repeats.
- End-to-end browser tests are slow under software rendering; they passed once each after the stability fixes, so occasional timeouts are still possible.

- Stage 4 estimates: vessel stats, deadline factors (1.3 and 1.1), wind strength (8 kn) and the 250-credit Skipper fee are untested by a human. The Coastal Cat may be frustrating in the harbor basin, which is only about 150 m wide.
- Wind gusts and veers but still acts only as drift: it does not turn the bow (no weathervaning) and does not push a moving boat off course beyond leeway.
- Docking speed is measured through the water, so a strong drift can carry a boat that reads as "still" out of the berth; the hold resets when it leaves.
- Each vessel is one fixed placeholder model; the workboat's crane and the cat's windows are boxes.
- No vessel purchase or rental: licenses unlock vessels for free.
- Passenger Shuttle and Heavy Gear Haul score the same way as other jobs; there is no passenger comfort or cargo-shift scoring yet.

- Stage 5 estimates: sea-effect constants, gust sizes, wave heights and the Auto thresholds (30 fps, 2 s windows) are untested on real hardware. On a GTX 770 the High preset may be too heavy and Medium may be borderline; run the benchmark.
- Foam is a procedural noise effect, not simulated: it can look like soft white patches up close, especially near piers in rough seas.
- No rain, lightning, tides or currents; weather is fixed for the whole mission. No scenery reflections or shadows in the water.
- Auto quality only steps down; switching back to a higher preset is manual.
- The benchmark takes over the screen for about 20 seconds and moves the boat on its own; Esc cancels.
- The headless performance numbers are from software rendering and mean nothing for real GPUs.

- Stage 6 estimates: route deadlines (route length / 6.8 m/s + 30 s), slow-zone penalties, the early bonus and reputation gates are unplayed. Long jobs (3 to 4 km) take 6 to 10 minutes and may feel long; there is no pause-and-save mid-mission.
- Routes are paths through charted markers only; you cannot place your own waypoints, and every leg is a straight line.
- Only one hazard type is modelled on the chart (narrow passage). No tides, currents, shoals with depth, or traffic.
- The harbor mouth and basin are fixed approach waypoints for the home port, so the last stretch into Bluewater Harbor is not up to the player.
- Chart clicking is verified with synthetic input only; markers close together on the map (for example H, A, G near the harbor) may be fiddly on a phone. The list under "Your route" is the reliable alternative.
- The whole 4 km region is always loaded; far scenery fades only through fog.
- The gap at the Seal Rocks is only about 30 m wide, which is tight for the passenger craft; route search allows it because the hull sweep passes, but it is hard to hit by hand.

- Stage 7 estimates: ship thrust, turning and stopping, cargo limits, deadlines (factors 1.3 and 1.4), the 800-credit exam fee and the reputation gates (30 and 45) are unplayed. Ship jobs are long (a 3.6 km route is about 10 to 12 minutes for the scripted captain).
- No tug assistance, ferry or pilot: berthing a 140 m ship is entirely on the player. Tugs are backlog for Stage 8.
- Depths are fixed (no tides, no draft change with cargo load). Shoals are drawn as a coarse texture (about 4.5 m per texel), so the visible edge is approximate while the collision edge is exact.
- The shoal warning is a message plus colour; there is no depth sounder or under-keel readout.
- A 140 m ship's model is placeholder boxes; the instanced container stacks are palette colours only.
- Ships cannot use the old Cape pier, the harbor, Pine Isle or the marina, so they only have two deep-water ports to sail between.
- Docking accuracy at a terminal is scored against a 40 m offset, which is forgiving by design; the scripted captain typically gets only 8 to 9 of 25 docking points because it stops well short of the berth centre, so a careful player can do much better.
- The chart is busier with the extra deep-water markers; near the harbor several markers overlap on a phone-sized map (use the list under "Your route").

## Risk register
| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R1 | Ocean/ship fidelity exceeds the target GPU budget | Med | High | Set frame-time budget in Stage 0 (TECHNICAL_DESIGN §3); quality tiers; profile at Stage 1 and Stage 5 |
| R2 | Realistic handling is not fun | Med | High | Arcade-leaning baseline in Stage 1; tune with playtests before adding depth |
| R3 | Box world scope creep | Med | Med | Fixed 8 km bound and 2 km cell grid; Stage 1 uses a single cell |
| R4 | Cannot verify builds from this environment | High | Med | Ship build/run instructions and a manual test checklist; user runs and reports results |
| R5 | Famous ships (Titanic, Black Pearl) infringe IP | High if shipped | High | Original fictional equivalents until legal review in Stage 9 |
| R6 | Untracked third-party asset licenses | Med | High | `assets/ASSET_REGISTER_TEMPLATE.csv` must be filled before any asset is committed |
| R7 | Engine lock-in on wrong choice | Low-Med | High | Keep vessel data (JSON/DataAsset) and design docs engine-agnostic; decide before Stage 1 code |
| R8 | UE5 C++ skill gap | Unknown | Med | Ask in Stage 0; Blueprint-first fallback or switch to Unity |
