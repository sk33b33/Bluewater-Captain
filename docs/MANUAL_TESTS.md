# Stage 1 Manual Test Checklist

Run `npm install && npm run build`, then open `dist/index.html` (or `npm start` and open http://localhost:8080). Record results in `docs/STATUS.md`.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Page loads | Start card with controls; boat visible behind it | |
| 2 | Press Enter | Card closes; HUD live | |
| 3 | Hold W | Speed builds gradually (not instantly), up to about 27 kn | |
| 4 | Release W | Boat coasts and slows, doesn't stop instantly | |
| 5 | Hold S while stopped | Slow reverse, throttle bar turns red | |
| 6 | A/D at speed | Boat turns; slight sideways slide in sharp turns | |
| 7 | A/D while stopped | Little or no turning | |
| 8 | Drive into the pier / breakwater / a buoy / an island | Boat stops or bounces, "Collision" warning, does not pass through | |
| 9 | Press R mid-route | Boat returns to last checkpoint (or harbor start), stationary | |
| 10 | Stay pushed against land 4+ s | Auto-respawn "Grounded" message | |
| 11 | Sail toward the map edge | "Leaving the chart area" warning, then auto-return | |
| 12 | Sail through all 5 gates in order | Timer starts at gate 1; "Route complete" with time and collision count | |
| 13 | Press Enter on result | Run restarts from harbor, timer reset | |
| 14 | Settings: sensitivity, low graphics, reduce motion | Each takes effect; persists after reload | |
| 15 | Frame rate (browser dev tools / any FPS counter) | Record fps on Low and normal graphics | |


# Stage 2 Manual Test Checklist

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Start, open mission board | Three missions listed with route, cargo, deadline, reward, risk; credits/rep/XP at top | |
| 2 | Pick Pine Isle Supply Run | Briefing with facts and docking rules; Back returns to board | |
| 3 | Depart | Boat starts in the harbor berth; yellow beam on the first gate; timer waits until you move | |
| 4 | Sail the three gates | "Checkpoint" messages; beam moves to the next gate | |
| 5 | Arrive at Pine Isle | Green berth beside the pier, destination beam, docking panel appears | |
| 6 | Enter the berth too fast | Speed chip shows a cross and hint says to slow down; hold bar stays empty | |
| 7 | Reverse to brake, line up, hold 2 s | All three chips tick, bar fills, results screen opens | |
| 8 | Read results | Four categories with plain reasons; reward, rep, XP; grade | |
| 9 | Reload the page | Credits and best grade are still there | |
| 10 | Replay the same mission | Fresh timer, hull 100%, no leftovers from the last run | |
| 11 | Crash hard into the pier | Hull % drops; keep crashing: "Hull breached" failed screen, no payment | |
| 12 | Menu > Restart mission | Back at the start, progress cleared | |
| 13 | Menu > Abort mission | "Mission aborted" screen; Retry works; Mission board works | |
| 14 | Island Produce Return | Starts at Pine Isle facing west, ends in the harbor berth; route goes through the harbor mouth | |
| 15 | Let the clock pass the deadline | Timer turns red, Timing loses points; at double the deadline the mission fails | |
| 16 | Phone: all of the above with touch controls | Docking panel readable, nothing hidden behind controls | |
| 17 | Board > Reset progress (click twice) | Credits, rep, XP and best grades return to zero | |


# Stage 3 Manual Test Checklist

Start from a fresh profile (Mission board > Reset progress, click twice) to see the whole path.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Board on a fresh profile | Training open; both contracts and the exam show Locked with the reason | |
| 2 | Open a locked contract | Briefing says it is locked, Depart disabled, "Open licenses" button works | |
| 3 | Licenses screen | Small Craft Permit Available with unmet checks; Coastal Skipper Locked (needs permit + reputation 10) | |
| 4 | Practical exam button | Disabled with the missing items listed | |
| 5 | Take written test, answer badly | "Not yet", what to review with correct answers; retake gives different questions/order | |
| 6 | Pass the written test | Check mark appears on the Licenses screen | |
| 7 | Run Coastal Training Loop and Harbor Docking Drill | Credits arrive; training checks turn green at score 50+ | |
| 8 | Results screens | Tips appear for weak categories; clean run shows none | |
| 9 | Start the exam | Briefing shows fee 100, pass mark 70, collision limit 2; Depart charges the fee | |
| 10 | Pause during the exam | No Restart button; abort label mentions the fee | |
| 11 | Abort the exam | "Exam failed", fee not refunded, license not awarded, contracts still locked | |
| 12 | Retake and crash 3 times (or score under 70) | "Exam not passed" with the failed check marked, retake offered | |
| 13 | Retake and pass | "Exam passed", bonus, unlock text; contracts unlock; exam card now says already held | |
| 14 | Reload the page | License still held; a contract starts | |
| 15 | Phone: licenses, quiz and results screens | Readable, buttons reachable, nothing cut off | |
| 16 | Coastal Skipper after earning the permit | Still locked until reputation reaches 10; no exam available | |


# Stage 4 Manual Test Checklist

If you do not want to grind the Coastal Skipper, ask for a test profile with both licenses.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Board > Fleet | Three vessels with dimensions, six stat bars, license state; skiff is active | |
| 2 | Compare cards | Workboat: tougher, slower to stop and turn, less wind drift. Cat: longest to stop, widest turns, most wind drift | |
| 3 | Workboat/Cat with only the permit | "Locked", Use button disabled, text says Coastal Skipper | |
| 4 | Board with only the permit | Heavy Gear Haul and Passenger Shuttle show Locked with the reason | |
| 5 | Drive the skiff on Harbor Docking Drill | Quick, tight turns; wind nudges it sideways when slow | |
| 6 | Reach reputation 10, then Workboat Sea Trials | Opens; workboat feels heavy; braking needs lots of room | |
| 7 | Passenger Craft Sea Trials | Cat swings wide, takes long to stop, drifts in the wind | |
| 8 | Coastal Skipper on Licenses | Requirements tick off; written test (pool of 8); exam fee 250 | |
| 9 | Coastal Skipper exam in the workboat | Briefing says workboat only; passing awards the license and unlocks both vessels | |
| 10 | Fleet after the Skipper | Use buttons enabled; selecting a vessel changes the model and the board's Vessel line | |
| 11 | Supply Run briefing | A vessel dropdown with three vessels; the deadline changes with the choice | |
| 12 | Heavy Gear Haul / Passenger Shuttle | Assigned vessel shown, no dropdown | |
| 13 | HUD during a mission | Wind speed and an arrow; arrow turns as you turn | |
| 14 | Dock with each vessel | Possible with all three; the Cat is hardest | |
| 15 | Bump the pier with the workboat and the skiff | Workboat loses less hull per hit | |
| 16 | Reload | Active vessel and licenses are kept | |
| 17 | Phone: fleet screen and a mission with the Cat | Readable; controls and camera usable | |


# Stage 5 Manual Test Checklist

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Board > Settings > tick "Show performance overlay" | Small readout with fps, 1% low, ms, preset, draw calls | |
| 2 | Settings > Run benchmark | About 20 s on its own: Low, Medium, High; then a table and a recommendation. **Write the three rows down** | |
| 3 | Apply the recommendation | Quality changes and you return to the board | |
| 4 | Settings quality: Low, Medium, High | Low is clearly lighter (lower resolution, no foam or wake); High looks richest | |
| 5 | Quality: Auto, then play on a slow machine | If it runs under 30 fps for a few seconds, a message says graphics were lowered | |
| 6 | Briefing for a contract | Forecast line, what the sea does to your vessel, a tip; deadline matches the vessel and sea | |
| 7 | Play Supply Run (fresh breeze) in the skiff, then the workboat | Wind gusts; the skiff is slowed more by the waves than the workboat | |
| 8 | Heavy Gear Haul (moderate sea) | Bigger waves, whitecaps, noticeably slower and heavier steering | |
| 9 | Island Produce Return (fog) | You cannot see far; compass arrow and distance still work; HUD shows visibility | |
| 10 | Compare calm (training) with rough | Water colour, sky and light change; waves are taller and longer | |
| 11 | Drive fast, look behind | White wake trail on Medium/High; none on Low | |
| 12 | Sail near the pier or an island | Light foam along the shore and lighter shallow water | |
| 13 | Dock in a gusty breeze | Wind pushes you around while slow; still possible | |
| 14 | Fleet screen | New "Speed lost in a rough sea" bar; skiff worst, passenger craft best | |
| 15 | Phone: settings, overlay, a mission in rough weather | Readable; frame rate acceptable on Low | |
