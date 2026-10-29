import test from 'node:test';
import assert from 'node:assert/strict';
import { SMALL_MOTORBOAT as P, createVesselState, stepVessel } from '../src/sim/vessel.js';
import { staticObstacles, resolveCollisions, circleVsObstacle, BUOY_RADIUS } from '../src/sim/world.js';
import { MISSIONS, BERTHS, getMission, gateBuoys } from '../src/data/missions.js';
import { createRun, stepRun, applyImpact, abortRun, registerRespawn, evaluateDock, respawnPose, scoreRun, gradeFor, DOCK } from '../src/sim/mission.js';
import { autopilot } from './helpers/autopilot.js';
import { getVessel, vesselForClass } from '../src/data/vessels.js';
import { defaultProfile, loadProfile, saveProfile, recordResult, sanitizeProfile, clearProfile } from '../src/sim/profile.js';

const DT = 1 / 60;
const supply = getMission('supply-run');
const ret = getMission('return-run');
const training = getMission('training-loop');
const berthPose = (b, heading = b.heading) => createVesselState(b.cx, b.cz, heading);

// ---- data sanity
test('every mission start, waypoint and berth centre is in clear water', () => {
  const obs = staticObstacles();
  for (const m of MISSIONS) {
    for (const pt of [m.start, ...m.waypoints]) {
      const s = createVesselState(pt.x, pt.z, 0);
      assert.equal(resolveCollisions(s, P, obs).hit, false, `${m.id} @ ${pt.x},${pt.z}`);
    }
    if (m.dock) {
      const b = BERTHS[m.dock];
      assert.equal(resolveCollisions(berthPose(b), P, obs).hit, false, `berth ${m.dock}`);
    }
  }
});

test('gate buoys never sit inside land, piers or islands, and leave a gap to sail through', () => {
  const obs = staticObstacles();
  for (const m of MISSIONS) {
    m.waypoints.forEach((_, i) => {
      const [a, b] = gateBuoys(m.waypoints, i, m.start);
      for (const p of [a, b]) {
        for (const o of obs) assert.equal(circleVsObstacle({ x: p.x, z: p.z, r: BUOY_RADIUS + 2 }, o), null, `${m.id} wp${i}`);
      }
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 12, 'gate too narrow');
    });
  }
});

test('missions have the fields the board needs', () => {
  for (const m of MISSIONS) {
    for (const k of ['id', 'title', 'summary', 'from', 'to', 'cargo', 'deadline', 'reward', 'risk', 'kind', 'vesselClasses', 'weather', 'start', 'waypoints']) assert.ok(m[k] !== undefined, `${m.id}.${k}`);
    if (m.dock) assert.ok(BERTHS[m.dock]);
  }
  assert.equal(getMission('nope'), null);
});

// ---- docking geometry
test('evaluateDock: centred, slow and aligned is ok in either direction', () => {
  const b = BERTHS.pine;
  for (const h of [b.heading, b.heading + Math.PI]) {
    const d = evaluateDock(berthPose(b, h), b);
    assert.ok(d.inside && d.speedOk && d.angleOk, `h=${h}`);
  }
});

test('evaluateDock: flags wrong position, speed and angle independently', () => {
  const b = BERTHS.pine;
  assert.equal(evaluateDock(createVesselState(b.cx + 30, b.cz, b.heading), b).inside, false);
  assert.equal(evaluateDock(createVesselState(b.cx, b.cz + 10, b.heading), b).inside, false);
  const fast = berthPose(b); fast.u = 3;
  assert.equal(evaluateDock(fast, b).speedOk, false);
  const crooked = berthPose(b, b.heading + 0.8);
  assert.equal(evaluateDock(crooked, b).angleOk, false);
});

// ---- run state machine
function parkedRun(m, secs = 3) {
  const run = createRun(m);
  const v = createVesselState(m.start.x, m.start.z, m.start.heading);
  for (const wp of m.waypoints) { v.x = wp.x; v.z = wp.z; stepRun(run, v, DT, BERTHS); }
  return { run, v };
}

test('timer only starts once the boat moves', () => {
  const run = createRun(supply);
  const v = createVesselState(supply.start.x, supply.start.z, supply.start.heading);
  for (let i = 0; i < 120; i++) stepRun(run, v, DT, BERTHS);
  assert.equal(run.time, 0);
  v.u = 2;
  for (let i = 0; i < 60; i++) stepRun(run, v, DT, BERTHS);
  assert.ok(Math.abs(run.time - 1) < 0.05);
});

test('dock mission: waypoints lead to docking phase, then complete after the hold time', () => {
  const { run } = parkedRun(supply);
  assert.equal(run.phase, 'docking');
  const b = BERTHS[supply.dock];
  const v = berthPose(b);
  let done = false;
  for (let i = 0; i < 60 * 3 && !done; i++) done = stepRun(run, v, DT, BERTHS).some((e) => e.type === 'complete');
  assert.ok(done);
  assert.equal(run.phase, 'complete');
  assert.ok(run.dock.centre < 0.1);
});

test('docking hold resets when the boat is too fast, then succeeds on a clean retry (failed docking is recoverable)', () => {
  const { run } = parkedRun(supply);
  const b = BERTHS[supply.dock];
  const v = berthPose(b);
  for (let i = 0; i < 60 * 1.5; i++) stepRun(run, v, DT, BERTHS);
  assert.ok(run.dockHold > 1);
  v.u = 4; // overspeed
  stepRun(run, v, DT, BERTHS);
  assert.equal(run.dockHold, 0);
  assert.equal(run.phase, 'docking');
  v.u = 0;
  let ok = false;
  for (let i = 0; i < 60 * 3 && !ok; i++) ok = stepRun(run, v, DT, BERTHS).some((e) => e.type === 'complete');
  assert.ok(ok);
});

test('training mission completes at the last waypoint with no docking', () => {
  const { run } = parkedRun(training);
  assert.equal(run.phase, 'complete');
});

test('waypoints must be reached in order', () => {
  const run = createRun(supply);
  const v = createVesselState(supply.waypoints[2].x, supply.waypoints[2].z, 0);
  stepRun(run, v, DT, BERTHS);
  assert.equal(run.route.next, 0);
  assert.equal(run.phase, 'underway');
});

test('collisions: gentle contact is free, hard impacts damage the hull, enough of them fail the mission', () => {
  const run = createRun(supply);
  assert.equal(applyImpact(run, 0.5), null);
  assert.equal(run.integrity, 100);
  assert.equal(applyImpact(run, 3).type, 'damage');
  assert.equal(run.integrity, 88);
  assert.equal(run.collisions, 1);
  let ev = null;
  for (let i = 0; i < 20 && !ev; i++) { const e = applyImpact(run, 6); if (e && e.type === 'failed') ev = e; }
  assert.equal(ev.reason, 'hull');
  assert.equal(run.phase, 'failed');
  assert.equal(applyImpact(run, 6), null, 'no more events once failed');
});

test('timeout fails the mission at twice the deadline; abort fails immediately', () => {
  const run = createRun(training);
  const v = createVesselState(0, 0, 0); v.u = 2;
  let ev = null;
  for (let i = 0; i < 60 * 700 && !ev; i++) ev = stepRun(run, v, DT, BERTHS).find((e) => e.type === 'failed');
  assert.equal(ev.reason, 'timeout');
  assert.ok(run.time > training.deadline * 2);
  const r2 = createRun(supply);
  assert.equal(abortRun(r2).reason, 'aborted');
  assert.equal(abortRun(r2), null, 'abort is idempotent');
});

test('respawn pose: mission start first, then last waypoint facing the next one, and facing the berth when docking', () => {
  const run = createRun(supply);
  assert.deepEqual(respawnPose(run, BERTHS), supply.start);
  const v = createVesselState(supply.waypoints[0].x, supply.waypoints[0].z, 0);
  stepRun(run, v, DT, BERTHS);
  const p = respawnPose(run, BERTHS);
  assert.equal(p.x, supply.waypoints[0].x);
  const dx = supply.waypoints[1].x - p.x, dz = supply.waypoints[1].z - p.z;
  assert.ok(Math.abs(Math.sin(p.heading) * Math.hypot(dx, dz) - dx) < 1e-6);
  const { run: r2 } = parkedRun(supply);
  const q = respawnPose(r2, BERTHS);
  const b = BERTHS.pine;
  const h = Math.atan2(b.cx - q.x, -(b.cz - q.z));
  assert.ok(Math.abs(Math.sin(q.heading) - Math.sin(h)) < 1e-6);
  registerRespawn(r2);
  assert.equal(r2.respawns, 1);
});

// ---- scoring
function completed(m, over = {}) {
  const { run } = parkedRun(m);
  run.time = over.time ?? m.deadline - 10;
  run.integrity = over.integrity ?? 100;
  run.collisions = over.collisions ?? 0;
  run.respawns = over.respawns ?? 0;
  if (m.dock) { run.dock = { centre: over.centre ?? 0, angleDeg: over.angle ?? 0 }; run.phase = 'complete'; }
  return run;
}

test('perfect dock run scores 100 and pays full reward', () => {
  const r = scoreRun(completed(supply));
  assert.equal(r.total, 100);
  assert.equal(r.grade, 'S');
  assert.equal(r.reward, supply.reward);
  assert.equal(r.categories.length, 4);
});

test('scoring explains each deduction', () => {
  const r = scoreRun(completed(supply, { time: supply.deadline + 20, integrity: 70, collisions: 2, respawns: 1, centre: 4, angle: 12.5 }));
  const by = Object.fromEntries(r.categories.map((c) => [c.name, c]));
  assert.equal(by.Safety.points, 21);
  assert.match(by.Safety.note, /2 collisions/);
  assert.equal(by.Navigation.points, 16);
  assert.equal(by.Timing.points, 16);
  assert.match(by.Timing.note, /20 s over/);
  assert.ok(by.Docking.points > 0 && by.Docking.points < 30);
  assert.ok(r.reward < supply.reward && r.reward >= supply.reward / 2);
});

test('training scoring has no docking category and totals 100 at best', () => {
  const r = scoreRun(completed(training));
  assert.equal(r.categories.length, 3);
  assert.equal(r.total, 100);
});

test('grade thresholds', () => {
  assert.deepEqual([95, 85, 70, 55, 10].map(gradeFor), ['S', 'A', 'B', 'C', 'D']);
});

// ---- profile
function fakeStorage(initial) {
  const m = new Map(initial ? [['bwc-profile', initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('profile: records rewards, keeps best result, survives a reload', () => {
  const st = fakeStorage();
  const p = loadProfile(st);
  recordResult(p, 'supply-run', { reward: 500, reputation: 4, xp: 90, total: 80, grade: 'A', time: 150 });
  recordResult(p, 'supply-run', { reward: 300, reputation: 2, xp: 60, total: 60, grade: 'C', time: 140 });
  saveProfile(st, p);
  const q = loadProfile(st);
  assert.equal(q.credits, 800);
  assert.equal(q.completed['supply-run'].plays, 2);
  assert.equal(q.completed['supply-run'].bestGrade, 'A');
  assert.equal(q.completed['supply-run'].bestScore, 80);
  assert.equal(q.completed['supply-run'].bestTime, 140);
});

test('profile: corrupt, wrong-version or hostile data falls back to defaults', () => {
  assert.deepEqual(loadProfile(fakeStorage('{not json')), defaultProfile());
  assert.deepEqual(loadProfile(fakeStorage(JSON.stringify({ version: 99, credits: 5 }))), defaultProfile());
  const p = sanitizeProfile({ version: 1, credits: -50, reputation: 'lots', xp: NaN, completed: { a: 5, b: { plays: 2, bestScore: 70, bestGrade: 'AAA', bestTime: null } } });
  assert.equal(p.credits, 0);
  assert.equal(p.reputation, 0);
  assert.equal(p.completed.a, undefined);
  assert.equal(p.completed.b.bestGrade, 'A');
  assert.equal(loadProfile({ getItem() { throw new Error('blocked'); } }).credits, 0);
  assert.equal(saveProfile({ setItem() { throw new Error('blocked'); } }, defaultProfile()), false);
});

test('profile: clear resets progress', () => {
  const st = fakeStorage();
  const p = loadProfile(st);
  p.credits = 10; saveProfile(st, p);
  assert.equal(clearProfile(st).credits, 0);
  assert.equal(loadProfile(st).credits, 0);
});

// ---- end-to-end: a scripted captain flies each mission with collisions on (see tests/helpers/autopilot.js)
for (const m of MISSIONS) {
  for (const cls of m.vesselClasses) {
    const vessel = vesselForClass(cls);
    test(`autopilot completes "${m.id}" with the ${vessel.name} within its deadline`, () => {
      const { run, s } = autopilot(m, vessel);
      assert.equal(run.phase, 'complete', `phase=${run.phase} at (${s.x.toFixed(0)},${s.z.toFixed(0)}) wp=${run.route.next} t=${run.time.toFixed(0)} hull=${Math.round(run.integrity)}`);
      assert.ok(run.time <= run.deadline, `time=${run.time.toFixed(0)}s > ${run.deadline}s`);
      const r = scoreRun(run);
      assert.ok(r.total >= 65, `score ${r.total}: ${JSON.stringify(r.categories)}`);
    });
  }
}

test('the same mission can be run repeatedly with fresh state each time', () => {
  const skiff = getVessel('small-motorboat');
  const a = autopilot(supply, skiff);
  const b = autopilot(supply, skiff);
  assert.equal(a.run.phase, 'complete');
  assert.equal(b.run.phase, 'complete');
  assert.notEqual(a.run, b.run);
  assert.equal(Math.round(a.run.time), Math.round(b.run.time));
});

import { judgeExam } from '../src/sim/licenses.js';
import { getLicense } from '../src/data/licenses.js';
test('the practical exam is passable: the scripted captain meets the pass mark and collision limit', () => {
  const exam = getMission('small-craft-exam');
  const { run } = autopilot(exam, getVessel('small-motorboat'));
  assert.equal(run.phase, 'complete');
  const r = scoreRun(run);
  const j = judgeExam(run, r, getLicense('small-craft-permit').exam);
  assert.ok(j.passed, JSON.stringify({ total: r.total, checks: j.checks }));
});

test('a reckless run fails the exam: hull wrecked or too many collisions', () => {
  const exam = getMission('small-craft-exam');
  const run = createRun(exam);
  for (let i = 0; i < 3; i++) applyImpact(run, 3);
  run.phase = 'complete'; run.dock = { centre: 0, angleDeg: 0 };
  const j = judgeExam(run, scoreRun(run), getLicense('small-craft-permit').exam);
  assert.equal(j.passed, false);
  assert.equal(j.checks[1].ok, false);
});
