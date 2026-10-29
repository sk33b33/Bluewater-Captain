# Project Status

## Current stage
Stage 5 — Water, waves, and weather. **Implemented; awaiting your hands-on testing and approval (stage gate).** Stages 1 to 4 remain open for tuning feedback.

## What was built (Stage 5)
- **Weather presets** (Calm, Fresh breeze, Moderate sea, Rough sea, Fog bank). Each mission has one: training and exams are mostly calm, Supply Run is a fresh breeze, Heavy Gear Haul and the Skipper exam are a moderate sea, and Island Produce Return runs in fog. The briefing shows the forecast, what the sea does to the chosen vessel, and a tip.
- **Wind** now gusts and veers; the HUD shows wind speed and direction, sea height and, in fog, visibility.
- **Sea effect on handling:** waves slow the boat and blunt steering, scaled by wave height against hull length. A skiff loses most, a passenger craft least; calm water costs nothing. Deadlines grow with the vessel and the sea. The fleet screen has a new "speed lost in a rough sea" bar.
- **Water:** four directional waves raised by the wind, crest whitecaps in bigger seas, shoreline foam and shallow-water tint, a boat wake, sky/light/fog that follow cloud and visibility.
- **Graphics quality** in Settings: Auto, Low, Medium, High. Auto starts on Medium and lowers itself if the game runs slowly (with a message). Presets change render resolution, water density, wave count, foam and wake.
- **Performance tools:** an optional FPS overlay (fps, 1% low, frame ms, draw calls, preset) and **Run benchmark** (Settings, from the mission board): measures Low, Medium and High in a rough sea in about 20 seconds and recommends one.

## Verified (cloud container, headless Chromium with software rendering)
- `npm test`: 131/131 pass. New: weather presets complete and escalating; wind deterministic and inside its gust/veer bounds; wave energy matches the preset and the measured field's height spread matches (within 20%); waves travel downwind and are longer in bigger seas; sea effect ordering across vessels and sea states (calm costs nothing, never uncontrollable); top speed and turning under sea equal the formula; deadlines grow with sea; quality presets descend in cost; frame statistics and percentiles; the auto-quality governor (sustained slowness lowers once, then cools down; stalls and single slow windows are ignored); benchmark recommendation rules; shore distance and the baked texture; wake particles (none when slow, ageing, capacity cap, determinism). A scripted captain still completes every mission with every allowed vessel in that mission's weather.
- Browser tests (headless Chromium over local HTTP): `weather.cjs` (settings and quality switching, FPS overlay, briefing forecast and sea text, deadline following vessel and sea, weather applied in play, HUD wind/sea/visibility, wake on Medium and off on Low, fog distance, weather reset at the board, benchmark runs all three presets and produces a recommendation, settings persist), plus `vessels.cjs`, `license.cjs`, `mission.cjs`, `touch.cjs`. All five suites passed against the final build (the vessel suite after its deadline expectations were updated for the new weather-scaled deadlines).
- In software rendering the benchmark measured Low 27 fps, Medium 19 fps and High 10 fps: the presets really do change the cost, but those absolute numbers say nothing about a real GPU.
- Screenshots of calm, moderate, rough and foggy conditions reviewed by eye.

## NOT verified
- **Frame rate on any real GPU, including your GTX 770.** The presets were chosen to be gentle on old cards (Low renders at 0.6x resolution with no foam or wake), but this is a guess until you run the benchmark. This is the most important open item.
- How the sea effect *feels* by hand: the constants (speed loss 18% and steering loss 15% per unit of severity, calm threshold 0.3), the gust sizes and the wave heights are my estimates.
- Phone behaviour of the new settings, benchmark and bigger waves; Firefox/Safari; the Auto governor on real hardware (only its logic is unit-tested, and it behaves sensibly in software rendering).
- The Stage 5 manual checklist has not been run by a human.

## Next action (needs the user)
1. Open the game, go to the mission board, **Settings, tick the performance overlay and run the benchmark**, and send me the three rows it shows (and your GPU if you know it).
2. Play a few missions in different weather and tell me whether the sea effect is too harsh or too mild.
3. Then approve Stage 6 (multiple ports and route planning) or request tuning.

## Stage completion log
- Stage 0: Done 2026-10-26 (engine changed to browser per D-005).
- Stage 1: Implemented 2026-10-26; touch controls added after user test; gate not formally passed.
- Stage 2: Implemented 2026-10-29; gate not formally passed.
- Stage 3: Implemented 2026-10-29; gate not formally passed.
- Stage 4: Implemented 2026-10-29; gate not formally passed.
- Stage 5: Implemented 2026-10-29; gate not yet passed.
