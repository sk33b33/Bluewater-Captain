# Bluewater Captain

A 3D maritime career game that runs in your browser. **Stage 7 prototype**: train, earn the Small Craft Permit, the Coastal Skipper and the Large Vessel Endorsement, and take paid contracts between five ports around Bluewater Bay, from a 6 m skiff to a 140 m container ship, planning your own route on a chart. Big ships need the dredged channel, long berths, and gentle hands for the cargo. Each vessel drives differently, and the weather matters: wind gusts, wave height slows and blunts boats (small ones most), and fog limits what you can see. All art is temporary placeholder geometry.

## Run it
Requires [Node.js](https://nodejs.org) 18+.

```
npm install
npm run build      # creates dist/index.html (single self-contained file)
```
Then open `dist/index.html` in Chrome, Edge or Firefox. For a local server instead: `npm start` and open http://localhost:8080.

## Deploy on Vercel
1. Push this repo to GitHub (already done) and import it at vercel.com/new.
2. Leave the defaults: `vercel.json` sets the build command (`npm run build`) and output folder (`dist`). No environment variables are needed.
3. Deploy. Vercel gives you a public link; each push to a branch gets its own preview link.

## Performance
Open **Settings** from the mission board: pick a graphics quality (Auto lowers itself if the game runs slowly), tick **Show performance overlay** for a live frame rate, or press **Run benchmark** to measure Low, Medium and High on your device and get a recommendation.

## Controls
| Input | Action |
|---|---|
| W / Up | Throttle forward |
| S / Down | Slow down, then reverse |
| A, D / Left, Right | Steer (needs some speed) |
| R | Respawn at last checkpoint (costs a few navigation points) |
| Esc / Menu button | Pause: resume, restart or abort the mission, settings |
| Mouse drag | Look around |
| Gamepad | Left stick steer, triggers throttle, Y respawn |
| Touch (phones/tablets) | Left lever: throttle (stays where set; Stop button zeroes it). Bottom-right bar: steer (springs back). Drag the water to look. Respawn button. |
| Settings button | Camera sensitivity, low graphics, reduce camera motion |

## Test
```
npm test                                   # 205 unit tests (vessels and ships, weather, performance tools, ports and routes, shoals, collision, missions, docking, scoring, cargo, licenses, quiz, profile)
node tests/e2e/ships.cjs                   # optional headless ships / terminals / cargo test
node tests/e2e/chart.cjs                   # optional headless chart / route-planning test
node tests/e2e/weather.cjs                 # optional headless weather / quality / benchmark test
node tests/e2e/vessels.cjs                 # optional headless fleet / vessel-choice test
node tests/e2e/license.cjs                 # optional headless end-to-end license path (needs Playwright + npm run build)
node tests/e2e/mission.cjs                 # optional headless end-to-end mission loop
node tests/e2e/touch.cjs                   # optional phone-emulation touch test
```
Manual checklist: `docs/MANUAL_TESTS.md`.

## Project docs
`CLAUDE.md` (rules), `docs/ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/TECHNICAL_DESIGN.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `assets/ASSET_REGISTER.csv`.
