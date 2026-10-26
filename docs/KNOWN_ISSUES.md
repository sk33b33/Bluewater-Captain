# Known Issues and Risks

## Open issues
- Frame rate on the user's GTX 770 is unmeasured; the water grid (360x360) and pixel ratio may need tuning.
- Boat, port and islands are crude placeholder primitives; no wake/foam, no audio.
- Touch controls added after Stage 1 on user request; verified only with headless phone emulation (390x844), not on a real phone. Landscape phones hide the stats row. Collision uses simple circles/rects (boat can clip visually into the pier edge).
- Docking is not implemented (Stage 2).
- Engine switched from UE5 to browser (D-005); risks R1, R7, R8 below were written for UE5.

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
