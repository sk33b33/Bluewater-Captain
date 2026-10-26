# Known Issues and Risks

## Open issues
- No game implementation exists; the repo holds specs and docs only.
- Engine and target hardware unconfirmed (D-001 is provisional).
- The cloud container cannot build or run Unreal or Unity, so engine builds/tests must be run by the user or on a configured machine.

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
