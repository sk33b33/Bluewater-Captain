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
- The Coastal Skipper has no exam, training or written test yet; it can never be earned in this stage by design.
- Profile is editable in browser storage (no server, no anti-cheat).
- Wrong-answer review in the written test names the correct option; there is no explanation audio/graphics and the pool is only 10 questions, so repeat players will see repeats.
- End-to-end browser tests are slow under software rendering; they passed once each after the stability fixes, so occasional timeouts are still possible.

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
