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
