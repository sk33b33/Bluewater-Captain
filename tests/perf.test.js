import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, QUALITY_ORDER, getQuality, lowerQuality, pixelRatioFor, AUTO_START } from '../src/data/quality.js';
import { createFrameStats, createGovernor, recommendQuality } from '../src/sim/perf.js';
import { distanceToObstacle, distanceToShore, bakeShore } from '../src/sim/shore.js';
import { createWake, stepWake, aliveCount, WAKE_LIFETIME } from '../src/sim/wake.js';
import { staticObstacles, LAND, ISLANDS } from '../src/sim/world.js';

// ---- quality presets
test('quality presets descend in cost: resolution, grid, waves, foam, wake', () => {
  const [lo, md, hi] = QUALITY_ORDER.map((id) => QUALITY[id]);
  for (const k of ['scale', 'grid', 'waves', 'foam', 'wake']) assert.ok(lo[k] <= md[k] && md[k] <= hi[k], k);
  assert.ok(lo.scale < hi.scale && lo.grid < hi.grid);
  assert.equal(lo.foam, 0); assert.equal(lo.wake, 0);
  assert.equal(getQuality('nope').id, AUTO_START);
  assert.equal(lowerQuality('high'), 'medium'); assert.equal(lowerQuality('medium'), 'low'); assert.equal(lowerQuality('low'), null);
});

test('render resolution: capped, and a 1080p desktop at Low renders well below native', () => {
  assert.equal(pixelRatioFor(QUALITY.low, 1), 0.6);
  assert.ok(pixelRatioFor(QUALITY.high, 3) <= QUALITY.high.cap);
  assert.ok(pixelRatioFor(QUALITY.low, 3) <= QUALITY.low.cap, 'retina phones stay capped on Low');
  for (const id of QUALITY_ORDER) assert.ok(pixelRatioFor(QUALITY[id], 1) > 0);
});

// ---- frame stats
test('frame stats: fps, percentiles and the 1% low', () => {
  const s = createFrameStats(300);
  for (let i = 0; i < 99; i++) s.push(16.67);
  s.push(100); // one hitch
  const r = s.summary();
  assert.ok(Math.abs(r.fps - 1000 / ((99 * 16.67 + 100) / 100)) < 0.01);
  assert.equal(r.p99Ms, 100);
  assert.ok(Math.abs(r.low1Fps - 10) < 0.01);
  assert.ok(r.p95Ms < 20);
  assert.equal(createFrameStats().summary().fps, 0);
});

test('frame stats keep only the most recent samples', () => {
  const s = createFrameStats(10);
  for (let i = 0; i < 50; i++) s.push(100);
  for (let i = 0; i < 10; i++) s.push(10);
  assert.equal(s.count, 10);
  assert.ok(Math.abs(s.summary().fps - 100) < 0.01);
});

// ---- governor
function run(gov, ms, frames) { let out = []; for (let i = 0; i < frames; i++) { const a = gov.feed(ms); if (a) out.push(i); } return out; }

test('governor: sustained slow frames drop quality once, then waits out the cooldown', () => {
  const g = createGovernor({ targetFps: 30, windowMs: 2000, strikes: 2, cooldownMs: 6000 });
  const fired = run(g, 50, 200); // 20 fps for 10 s
  assert.equal(fired.length, 1, 'exactly one drop in 10 s');
  const t = fired[0] * 50;
  assert.ok(t >= 3900 && t <= 4200, `fired after two 2 s windows (${t} ms)`);
});

test('governor: fast frames never drop; one slow window alone is forgiven', () => {
  const g = createGovernor();
  assert.deepEqual(run(g, 16.7, 2000), []);
  const h = createGovernor();
  assert.deepEqual([...run(h, 50, 40), ...run(h, 16.7, 200)], [], 'a single slow window then recovery');
});

test('governor: ignores stalls (hidden tab, loading) and respects the threshold', () => {
  const g = createGovernor();
  assert.deepEqual(run(g, 1000, 100), [], 'frames over 250 ms are not counted');
  const ok = createGovernor({ targetFps: 30 });
  assert.deepEqual(run(ok, 1000 / 31, 600), [], '31 fps is acceptable');
  const bad = createGovernor({ targetFps: 30 });
  assert.ok(run(bad, 1000 / 29, 600).length >= 1, '29 fps is not');
});

test('governor can be reset', () => {
  const g = createGovernor();
  run(g, 50, 60);
  g.reset();
  assert.deepEqual(run(g, 16.7, 400), []);
});

// ---- benchmark recommendation
test('recommendation: the highest preset that is comfortable, else playable, else the lowest', () => {
  assert.equal(recommendQuality({ low: { avgFps: 120, low1Fps: 90 }, medium: { avgFps: 90, low1Fps: 60 }, high: { avgFps: 70, low1Fps: 45 } }), 'high');
  assert.equal(recommendQuality({ low: { avgFps: 90, low1Fps: 60 }, medium: { avgFps: 55, low1Fps: 35 }, high: { avgFps: 31, low1Fps: 20 } }), 'medium');
  assert.equal(recommendQuality({ low: { avgFps: 60, low1Fps: 40 }, medium: { avgFps: 38, low1Fps: 20 }, high: { avgFps: 20, low1Fps: 10 } }), 'low', 'comfortable Low beats merely playable Medium');
  assert.equal(recommendQuality({ low: { avgFps: 45, low1Fps: 25 }, medium: { avgFps: 36, low1Fps: 20 }, high: { avgFps: 20, low1Fps: 10 } }), 'medium', 'nothing comfortable: best playable');
  assert.equal(recommendQuality({ low: { avgFps: 22, low1Fps: 12 }, medium: { avgFps: 14, low1Fps: 8 }, high: { avgFps: 7, low1Fps: 4 } }), 'low');
  assert.equal(recommendQuality({}), 'low');
});

// ---- shore distance
test('distance to shore: zero on and inside land, grows with distance, circles and rects agree', () => {
  const land = LAND[0]; // west coast: x from -1300 to -800
  assert.equal(distanceToObstacle(-1000, 0, land), 0);
  assert.equal(distanceToObstacle(-800, 0, land), 0);
  assert.ok(Math.abs(distanceToObstacle(-700, 0, land) - 100) < 1e-9);
  const isl = ISLANDS[0];
  assert.equal(distanceToObstacle(isl.cx, isl.cz, isl), 0);
  assert.ok(Math.abs(distanceToObstacle(isl.cx + isl.r + 25, isl.cz, isl) - 25) < 1e-9);
  const obs = staticObstacles();
  assert.equal(distanceToShore(0, 0, obs) > 100, true, 'open water is far from everything');
  assert.ok(distanceToShore(isl.cx + isl.r + 3, isl.cz, obs) <= 3 + 1e-9);
});

test('baked shore texture: right size, black on land, white in open water, smooth ramp between', () => {
  const t = bakeShore(staticObstacles(), { originX: -1300, originZ: -1300, extent: 2600, size: 128 });
  assert.equal(t.data.length, 128 * 128 * 4);
  const px = (x, z) => { const i = Math.floor(((x + 1300) / 2600) * 128), j = Math.floor(((z + 1300) / 2600) * 128); return t.data[(j * 128 + i) * 4]; };
  assert.equal(px(-1100, 0), 0, 'inside the west coast');
  assert.equal(px(0, 0), 255, 'open water beyond 80 m');
  const ramp = [-760, -740, -720, -690].map((x) => px(x, -600)); // moving away from the coast at z=-600
  for (let i = 1; i < ramp.length; i++) assert.ok(ramp[i] >= ramp[i - 1], `ramp ${ramp}`);
});

// ---- wake
const stern = (over = {}) => ({ sx: 0, sz: 0, heading: 0, speed: 8, beam: 3, active: true, ...over });

test('wake: nothing when slow or switched off; foam appears and ages out', () => {
  const w = createWake(100);
  for (let i = 0; i < 120; i++) stepWake(w, 1 / 60, stern({ speed: 0.5 }));
  assert.equal(aliveCount(w), 0, 'a drifting boat leaves no wake');
  for (let i = 0; i < 120; i++) stepWake(w, 1 / 60, stern({ active: false }));
  assert.equal(aliveCount(w), 0, 'wake off');
  for (let i = 0; i < 120; i++) stepWake(w, 1 / 60, stern());
  assert.ok(aliveCount(w) > 20, 'moving boat leaves foam');
  for (let i = 0; i < 60 * (WAKE_LIFETIME + 1); i++) stepWake(w, 1 / 60, stern({ speed: 0 }));
  assert.equal(aliveCount(w), 0, 'foam fades away');
});

test('wake: faster boats drop more foam; capacity is a hard cap; size grows with age', () => {
  const count = (speed) => { const w = createWake(500); for (let i = 0; i < 60; i++) stepWake(w, 1 / 60, stern({ speed })); return aliveCount(w); };
  assert.ok(count(10) > count(3) * 1.5);
  const w = createWake(40);
  for (let i = 0; i < 600; i++) stepWake(w, 1 / 60, stern({ speed: 12 }));
  assert.ok(aliveCount(w) <= 40);
  const g = createWake(10);
  stepWake(g, 0.5, stern());
  const first = g.size[0];
  stepWake(g, 1, stern({ speed: 0 }));
  assert.ok(g.size[0] > first, 'foam spreads');
  assert.equal(aliveCount(createWake(0)), 0);
});

test('wake: deterministic and spread across the beam', () => {
  const make = () => { const w = createWake(200); for (let i = 0; i < 120; i++) stepWake(w, 1 / 60, stern()); return w; };
  const a = make(), b = make();
  assert.deepEqual([...a.x], [...b.x]);
  const xs = [...a.x].filter((_, i) => a.age[i] < WAKE_LIFETIME);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 1.5 && Math.max(...xs) - Math.min(...xs) <= 3, 'within the beam');
});

test('baked shore texture equals a brute-force distance field, and a 4 km region bakes quickly', () => {
  const obs = staticObstacles();
  const area = { originX: -1300, originZ: -1300, extent: 4600, size: 256, maxDist: 80 };
  const t0 = Date.now();
  const t = bakeShore(obs, area);
  const cell = area.extent / area.size;
  for (const [i, j] of [[10, 10], [40, 60], [100, 100], [180, 150], [200, 30], [30, 220], [120, 240], [255, 255], [64, 66]]) {
    const x = area.originX + (i + 0.5) * cell, z = area.originZ + (j + 0.5) * cell;
    const want = Math.round((Math.min(80, distanceToShore(x, z, obs)) / 80) * 255);
    assert.equal(t.data[(j * area.size + i) * 4], want, `texel ${i},${j}`);
  }
  assert.ok(Date.now() - t0 < 1500, 'baking is cheap');
});

test('baked shoal channel: zero inside a shoal, rising with distance, and land does not leak into it', () => {
  const area = { originX: -1300, originZ: -1300, extent: 4600, size: 256, maxDist: 80 };
  const shoals = [{ type: 'circle', name: 's', cx: 1100, cz: 1300, r: 190, depth: 4.5 }];
  const t = bakeShore(staticObstacles(), area, shoals);
  const cell = area.extent / area.size;
  const g = (x, z) => t.data[(Math.floor((z - area.originZ) / cell) * area.size + Math.floor((x - area.originX) / cell)) * 4 + 1];
  assert.equal(g(1100, 1300), 0, 'inside the shoal');
  assert.ok(g(1100 + 190 + 25, 1300) > 0 && g(1100 + 190 + 25, 1300) < 255, 'a little outside');
  assert.ok(g(1100 + 190 + 55, 1300) > g(1100 + 190 + 25, 1300), 'rising with distance');
  assert.equal(g(1100 + 190 + 120, 1300), 255, 'far away');
  assert.equal(g(-1100, 0), 255, 'on land the shoal channel stays clear');
  const empty = bakeShore(staticObstacles(), area);
  assert.equal(empty.data[1], 255, 'no shoals means an untouched channel');
});
