# Project Status

## Current stage
Stage 3 — License and career progression. **Implemented; awaiting your hands-on testing and approval (stage gate).** Stages 1 and 2 remain open for tuning feedback.

## What was built (Stage 3)
- **Licenses screen** (from the mission board): Small Craft Permit (Tier 1, fully playable) and Coastal Skipper (Tier 2, in data and locked behind the permit + reputation 10; exam not yet playable). Each shows its requirements with check marks, what it permits and unlocks.
- **Training:** Coastal Training Loop and the new Harbor Docking Drill (score 50+ each).
- **Written test:** 5 random questions from a pool of 10, shuffled answers, pass 4 of 5, free retakes, a review of what you missed.
- **Practical exam:** fee 100 credits, a harbor circuit with two marks and a docking finish. Pass mark 70, at most 2 damaging collisions. Aborting or failing keeps the fee and counts as an attempt.
- **Gating:** contracts (Supply Run, Produce Return) now need the permit; training is open. Locked missions explain why and link to the Licenses screen. Vessel permissions are checked per class for Stage 4.
- **Feedback:** results show coaching tips for the weakest categories; exam results list each pass check and what unlocked.
- **Profile v2:** licenses, written and exam history saved; Stage 2 saves migrate automatically.
- Housekeeping: arrow/space keys are no longer captured while a menu is open (needed for the quiz); gate buoys for single-waypoint missions are placed correctly.

## Verified (cloud container, headless Chromium with software rendering)
- `npm test`: 66/66 pass. New: license requirements and ordering, training thresholds, fee/attempt accounting, pass and fail outcomes (the stage gate), no double bonus, vessel permissions, quiz draw/shuffle/scoring, coaching tips, profile save/load, v1 -> v2 migration, hostile data; a scripted captain completes all five missions (including the exam) and meets the exam pass mark.
- `tests/e2e/license.cjs`: fresh profile -> locked contracts -> written test fail then pass -> training -> exam abort (fee lost, no license) -> exam pass (license, bonus, contracts unlock) -> reload keeps the license -> contract starts.
- `tests/e2e/mission.cjs` (Stage 2 loop, starting with the permit) and `tests/e2e/touch.cjs` (phone controls) pass.
- Screenshots of the licenses, quiz and exam-result screens reviewed by eye.

## NOT verified
- Frame rate on any real GPU; how the exam *feels*: the 70-point pass mark, 2-collision limit, 180 s deadline and 100-credit fee are my estimates (a scripted captain passes, a human may find it easier or harder).
- Real phone behaviour of the new screens (quiz on a small screen was not screenshotted), Firefox/Safari, gamepad.
- Failing the exam through real collisions in the browser (unit tests cover the logic; the browser test fails it by aborting).
- The Stage 3 manual checklist has not been run by a human.
- End-to-end tests are slow (minutes) under software rendering and are not part of `npm test`. Earlier runs were flaky because of `file://` storage and fixed waits; I fixed both causes (local HTTP server, wait for the game to register each waypoint) and each suite passed once afterwards, so flakiness is not ruled out.

## Next action (needs the user)
Play the path: take a training run, the written test, the exam, then a contract. Report whether the exam is too hard or easy, whether the fee/credits balance feels fair, and anything confusing. Then approve Stage 4 (more vessel classes) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stage 1: Implemented 2026-10-26; touch controls added after user test; gate not formally passed.
- Stage 2: Implemented 2026-10-29; gate not formally passed.
- Stage 3: Implemented 2026-10-29; gate not yet passed.
