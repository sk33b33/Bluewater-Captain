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
