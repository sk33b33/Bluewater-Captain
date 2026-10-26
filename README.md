# Bluewater Captain

A 3D maritime career game that runs in your browser. **Stage 1 prototype**: sail a small boat out of a harbor and complete a marked route. All art is temporary placeholder geometry.

## Run it
Requires [Node.js](https://nodejs.org) 18+.

```
npm install
npm run build      # creates dist/index.html (single self-contained file)
```
Then open `dist/index.html` in Chrome, Edge or Firefox. For a local server instead: `npm start` and open http://localhost:8080.

## Controls
| Input | Action |
|---|---|
| W / Up | Throttle forward |
| S / Down | Slow down, then reverse |
| A, D / Left, Right | Steer (needs some speed) |
| R | Respawn at last checkpoint |
| Mouse drag | Look around |
| Gamepad | Left stick steer, triggers throttle, Y respawn |
| Settings button | Camera sensitivity, low graphics, reduce camera motion |

## Test
```
npm test                                   # 19 unit tests (vessel, collision, route, waves)
node tests/e2e/smoke.cjs                   # optional headless browser smoke test (needs Playwright)
```
Manual checklist: `docs/MANUAL_TESTS.md`.

## Project docs
`CLAUDE.md` (rules), `docs/ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/TECHNICAL_DESIGN.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `assets/ASSET_REGISTER.csv`.
