import test from 'node:test';
import assert from 'node:assert/strict';
import { SMALL_MOTORBOAT as P, createVesselState, stepVessel, speedKnots } from '../src/sim/vessel.js';
import { resolveCollisions, staticObstacles, edgeStatus, ROUTE, SPAWN, LAND, ISLANDS } from '../src/sim/world.js';
import { createRouteState, updateRoute, respawnPoint, formatTime } from '../src/sim/route.js';
import { getWaterHeight } from '../src/sim/waves.js';

const DT = 1 / 60;
const run = (s, input, secs) => { for (let i = 0; i < secs / DT; i++) stepVessel(s, input, P, DT); return s; };

test('full throttle settles near max speed', () => {
  const s = run(createVesselState(), { throttle: 1, steer: 0 }, 40);
  assert.ok(Math.abs(s.u - P.maxSpeed) < 0.7, `u=${s.u}`);
});

test('boat has inertia: speed does not jump', () => {
  const s = run(createVesselState(), { throttle: 1, steer: 0 }, 0.5);
  assert.ok(s.u > 0 && s.u < 3, `u=${s.u}`);
});

test('coasts down after throttle release, never instantly', () => {
  const s = run(createVesselState(), { throttle: 1, steer: 0 }, 20);
  const fast = s.u;
  run(s, { throttle: 0, steer: 0 }, 2);
  assert.ok(s.u < fast && s.u > 0.3 * fast, `fast=${fast} u=${s.u}`);
});

test('reverse is capped and slower than forward', () => {
  const s = run(createVesselState(), { throttle: -1, steer: 0 }, 40);
  assert.ok(s.u < 0 && Math.abs(s.u) <= P.maxReverse + 0.3, `u=${s.u}`);
});

test('steer right turns clockwise (heading increases), left decreases', () => {
  const r = run(createVesselState(0, 0, 0), { throttle: 1, steer: 1 }, 5);
  assert.ok(r.heading > 0 && r.heading < Math.PI, `h=${r.heading}`);
  const l = run(createVesselState(0, 0, 0), { throttle: 1, steer: -1 }, 5);
  assert.ok(l.heading > Math.PI, `h=${l.heading}`);
});

test('no steering authority when stationary', () => {
  const s = run(createVesselState(0, 0, 0), { throttle: 0, steer: 1 }, 5);
  assert.ok(Math.abs(s.heading) < 1e-6);
});

test('heading 0 moves north (-z); heading 90deg moves east (+x)', () => {
  const n = run(createVesselState(0, 0, 0), { throttle: 1, steer: 0 }, 3);
  assert.ok(n.z < -1 && Math.abs(n.x) < 0.01);
  const e = run(createVesselState(0, 0, Math.PI / 2), { throttle: 1, steer: 0 }, 3);
  assert.ok(e.x > 1 && Math.abs(e.z) < 0.01);
});

test('speedKnots converts m/s', () => {
  assert.ok(Math.abs(speedKnots({ u: 10, v: 0 }) - 19.438) < 0.01);
});

test('collision: boat driven into west coast is stopped and stays outside', () => {
  const s = createVesselState(-760, -400, (3 * Math.PI) / 2); // facing west toward the coast (x<-800)
  let hit = false;
  for (let i = 0; i < 60 * 15; i++) {
    stepVessel(s, { throttle: 1, steer: 0 }, P, DT);
    if (resolveCollisions(s, P, staticObstacles()).hit) hit = true;
  }
  assert.ok(hit);
  const edge = LAND[0].cx + LAND[0].hx; // -800
  assert.ok(s.x > edge, `x=${s.x}`);
});

test('collision: island blocks the boat', () => {
  const isl = ISLANDS[0];
  const s = createVesselState(isl.cx - 150, isl.cz, Math.PI / 2);
  for (let i = 0; i < 60 * 20; i++) {
    stepVessel(s, { throttle: 1, steer: 0 }, P, DT);
    resolveCollisions(s, P, staticObstacles());
  }
  assert.ok(Math.hypot(s.x - isl.cx, s.z - isl.cz) >= isl.r, 'inside island');
});

test('spawn point is clear of all obstacles', () => {
  const s = createVesselState(SPAWN.x, SPAWN.z, SPAWN.heading);
  assert.equal(resolveCollisions(s, P, staticObstacles()).hit, false);
});

test('no route checkpoint is inside an obstacle', () => {
  for (const cp of ROUTE) {
    const s = createVesselState(cp.x, cp.z, 0);
    assert.equal(resolveCollisions(s, P, staticObstacles()).hit, false, cp.name);
  }
});

test('edge status', () => {
  assert.equal(edgeStatus({ x: 0, z: 0 }), 'ok');
  assert.equal(edgeStatus({ x: 2900, z: 1500 }), 'ok', 'the east of the region is open water now');
  assert.equal(edgeStatus({ x: -960, z: 0 }), 'warn');
  assert.equal(edgeStatus({ x: 1000, z: 2960 }), 'warn');
  assert.equal(edgeStatus({ x: 0, z: -1100 }), 'out');
  assert.equal(edgeStatus({ x: 3050, z: 0 }), 'out');
});

test('route: checkpoints must be reached in order; timer starts at first', () => {
  const rt = createRouteState();
  updateRoute(rt, ROUTE, { x: ROUTE[2].x, z: ROUTE[2].z }, 1);
  assert.equal(rt.next, 0);
  assert.equal(rt.started, false);
  assert.equal(updateRoute(rt, ROUTE, ROUTE[0], 1), 0);
  assert.equal(rt.started, true);
  updateRoute(rt, ROUTE, { x: 0, z: 0 }, 2.5);
  assert.equal(rt.time, 2.5);
});

test('route: completing all checkpoints finishes and freezes time', () => {
  const rt = createRouteState();
  for (const cp of ROUTE) { updateRoute(rt, ROUTE, cp, 1); }
  assert.equal(rt.finished, true);
  const t = rt.time;
  updateRoute(rt, ROUTE, ROUTE[0], 5);
  assert.equal(rt.time, t);
});

test('respawn: spawn point before any checkpoint, then last checkpoint facing next', () => {
  const rt = createRouteState();
  assert.deepEqual(respawnPoint(rt, ROUTE, SPAWN), { x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading });
  updateRoute(rt, ROUTE, ROUTE[0], 0);
  const rp = respawnPoint(rt, ROUTE, SPAWN);
  assert.equal(rp.x, ROUTE[0].x);
  const dx = ROUTE[1].x - ROUTE[0].x, dz = ROUTE[1].z - ROUTE[0].z;
  assert.ok(Math.abs(Math.sin(rp.heading) * Math.hypot(dx, dz) - dx) < 1e-6);
});

test('formatTime', () => {
  assert.equal(formatTime(75.34), '1:15.3');
  assert.equal(formatTime(5), '0:05.0');
});

test('water height is bounded and varies with time', () => {
  let max = 0;
  for (let x = 0; x < 200; x += 7) max = Math.max(max, Math.abs(getWaterHeight(x, 3, 1.2)));
  assert.ok(max > 0.1 && max < 1);
  assert.notEqual(getWaterHeight(10, 10, 0), getWaterHeight(10, 10, 1));
});

// Autopilot: proves the route is completable with realistic input and collisions on.
test('autopilot can complete the full route without grounding', () => {
  const rt = createRouteState();
  const s = createVesselState(SPAWN.x, SPAWN.z, SPAWN.heading);
  const obs = staticObstacles();
  let hits = 0;
  for (let i = 0; i < 60 * 600 && !rt.finished; i++) {
    const cp = ROUTE[rt.next];
    const want = Math.atan2(cp.x - s.x, -(cp.z - s.z));
    let err = Math.atan2(Math.sin(want - s.heading), Math.cos(want - s.heading));
    stepVessel(s, { throttle: Math.abs(err) > 0.6 ? 0.4 : 0.8, steer: Math.max(-1, Math.min(1, err * 2.5)) }, P, DT);
    if (resolveCollisions(s, P, obs).hit) hits++;
    updateRoute(rt, ROUTE, s, DT);
  }
  assert.ok(rt.finished, `stuck at checkpoint ${rt.next} (${s.x.toFixed(0)}, ${s.z.toFixed(0)})`);
  assert.equal(hits, 0, 'autopilot should not touch anything');
  assert.ok(rt.time < 300, `time=${rt.time}`);
});
