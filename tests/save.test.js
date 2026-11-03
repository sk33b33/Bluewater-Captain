import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, exportProfile, importProfile, describeProfile, sanitizeProfile, recordResult, MAX_IMPORT_BYTES, PROFILE_VERSION } from '../src/sim/profile.js';

function played() {
  const p = defaultProfile();
  p.credits = 1234; p.reputation = 17; p.xp = 340; p.vessel = 'workboat';
  p.licenses['small-craft-permit'] = { held: true, heldAt: 99, grandfathered: false, written: { attempts: 2, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 88, passed: true } };
  recordResult(p, 'supply-run', { reward: 100, reputation: 1, xp: 1, total: 91, grade: 'S', time: 140 });
  return p;
}

// ---- backup file
test('backup: export then import returns the same progress', () => {
  const p = played();
  const r = importProfile(exportProfile(p));
  assert.equal(r.ok, true);
  assert.deepEqual(r.profile, sanitizeProfile(p));
  assert.equal(r.profile.credits, 1234 + 100);
  assert.equal(r.profile.vessel, 'workboat');
  assert.equal(r.profile.licenses['small-craft-permit'].held, true);
  assert.equal(r.profile.completed['supply-run'].bestGrade, 'S');
});

test('backup: the file is readable JSON tagged with the app and a version', () => {
  const raw = JSON.parse(exportProfile(played(), 1700000000000));
  assert.equal(raw.app, 'bluewater-captain');
  assert.equal(raw.exportVersion, 1);
  assert.equal(raw.exportedAt, 1700000000000);
  assert.equal(raw.profile.version, PROFILE_VERSION);
});

test('backup: junk, wrong app, wrong version, oversize and empty files are refused with a reason', () => {
  const bad = (text) => { const r = importProfile(text); assert.equal(r.ok, false); assert.ok(r.error.length > 10); return r.error; };
  assert.match(bad(''), /empty/);
  assert.match(bad(undefined), /empty/);
  assert.match(bad('{not json'), /not valid JSON/);
  assert.match(bad('{"app":"other","profile":{}}'), /not a Bluewater Captain backup/);
  assert.match(bad(JSON.stringify({ app: 'bluewater-captain', exportVersion: 9, profile: {} })), /different version/);
  assert.match(bad(JSON.stringify({ app: 'bluewater-captain', exportVersion: 1 })), /missing or too old/);
  assert.match(bad(JSON.stringify({ app: 'bluewater-captain', exportVersion: 1, profile: { version: 99 } })), /missing or too old/);
  assert.match(bad('x'.repeat(MAX_IMPORT_BYTES + 1)), /too large/);
  assert.match(bad('[1,2,3]'), /not a Bluewater Captain backup/);
});

test('backup: hostile values are sanitized, not trusted', () => {
  const file = JSON.stringify({ app: 'bluewater-captain', exportVersion: 1, profile: { version: 3, credits: -50, reputation: 'lots', xp: 1e308 * 10, vessel: 'death-star', evil: '<script>', completed: { x: { plays: -3, bestScore: 'high' } }, licenses: { 'small-craft-permit': { held: 'yes', heldAt: 'never' } } } });
  const r = importProfile(file);
  assert.equal(r.ok, true);
  assert.equal(r.profile.credits, 0);
  assert.equal(r.profile.reputation, 0);
  assert.equal(r.profile.xp, 0);
  assert.equal(r.profile.vessel, 'small-motorboat');
  assert.equal(r.profile.evil, undefined);
  assert.equal(r.profile.completed.x.plays, 0);
  assert.equal(r.profile.licenses['small-craft-permit'].held, true);
  assert.equal(r.profile.licenses['small-craft-permit'].heldAt, null);
});

test('backup: older saves import and migrate', () => {
  const v1 = { version: 1, credits: 400, reputation: 7, xp: 120, completed: { 'supply-run': { plays: 2, bestScore: 90, bestGrade: 'S', bestTime: 100 } } };
  const r = importProfile(JSON.stringify({ app: 'bluewater-captain', exportVersion: 1, profile: v1 }));
  assert.equal(r.ok, true);
  assert.equal(r.profile.version, PROFILE_VERSION);
  assert.equal(r.profile.licenses['small-craft-permit'].held, true, 'v1 contract players keep the permit');
});

test('backup: describeProfile summarises what you are about to load', () => {
  assert.equal(describeProfile(defaultProfile()), '0 credits, reputation 0, 0 licenses, 0 jobs completed');
  const text = describeProfile(played());
  assert.match(text, /1334 credits/); assert.match(text, /1 license,/); assert.match(text, /1 job completed/);
});

// ---- mid-mission save and resume
import { getMission } from '../src/data/missions.js';
import { getVessel } from '../src/data/vessels.js';
import { findRoutes, planMission } from '../src/sim/routes.js';
import { createRun, scoreRun } from '../src/sim/mission.js';
import { createVesselState } from '../src/sim/vessel.js';
import { snapshot, sanitizeSnapshot, rebuildMission, resume, readSave, writeSave, clearSave, describeSave, SAVE_KEY } from '../src/sim/save.js';
import { createPilot } from './helpers/autopilot.js';

const roundTrip = (snap) => sanitizeSnapshot(JSON.parse(JSON.stringify(snap)));
function sailTo(mission, vessel, ticks) { const p = createPilot(mission, vessel); for (let i = 0; i < ticks; i++) p.step(); return p; }
function finish(p, max = 60 * 2500) { while (!p.done && p.tick < max) p.step(); return p; }
function fakeStore(init) { const m = new Map(init ? [[SAVE_KEY, init]] : []); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; }

test('save: a mission saved halfway and resumed finishes exactly like one never interrupted (planned route, two ports)', () => {
  const base = getMission('cape-parcels');
  const v = getVessel('small-motorboat');
  const route = findRoutes(base.fromPort, base.toPort, { vessel: v, max: 2 })[1]; // the non-default alternative
  const mission = planMission(base, route, v);

  const straight = finish(sailTo(mission, v, 0));

  const half = sailTo(mission, v, 60 * 150);
  assert.equal(half.run.phase, 'underway');
  const snap = roundTrip(snapshot(half.run, half.s, mission, half.time, 1000));
  assert.ok(snap, 'snapshot survives JSON and validation');

  const resumed = resume(snap);
  assert.ok(resumed);
  assert.equal(resumed.mission.routeId, mission.routeId, 'the chosen route is restored');
  assert.equal(resumed.mission.routeName, mission.routeName);
  assert.deepEqual(resumed.mission.waypoints, mission.waypoints);
  const state = Object.assign(createVesselState(0, 0, 0), resumed.state);
  const cont = finish(createPilot(resumed.mission, resumed.vessel, { run: resumed.run, s: state, tick: Math.round(snap.time * 60) }));

  assert.equal(cont.run.phase, 'complete');
  assert.equal(cont.run.time, straight.run.time, 'same time on the clock');
  assert.equal(cont.run.integrity, straight.run.integrity);
  assert.deepEqual(scoreRun(cont.run), scoreRun(straight.run), 'identical score and reward');
  assert.deepEqual({ x: cont.s.x, z: cont.s.z }, { x: straight.s.x, z: straight.s.z }, 'the boat ends in the same place');
});

test('save: resume works in the docking phase and for a ship with cargo strain and a fixed course', () => {
  for (const [id, cls] of [['dock-drill', 'small-motorboat'], ['cargo-trials', 'cargo-ship'], ['container-feeder', 'container-carrier']]) {
    const base = getMission(id), v = getVessel(cls);
    const mission = base.planned ? planMission(base, findRoutes(base.fromPort, base.toPort, { vessel: v, max: 1 })[0], v) : base;
    const straight = finish(sailTo(mission, v, 0));
    // save a little before the end, whatever the phase is
    const cut = Math.round(straight.tick * 0.85);
    const half = sailTo(mission, v, cut);
    const snap = roundTrip(snapshot(half.run, half.s, mission, half.time, 5));
    const r = resume(snap);
    assert.ok(r, id);
    const cont = finish(createPilot(r.mission, r.vessel, { run: r.run, s: Object.assign(createVesselState(0, 0, 0), r.state), tick: Math.round(snap.time * 60) }));
    assert.equal(cont.run.phase, 'complete', id);
    assert.deepEqual(scoreRun(cont.run), scoreRun(straight.run), `${id} resumes to the same result`);
  }
});

test('save: the snapshot carries what matters and is small', () => {
  const m = getMission('supply-run'), v = getVessel('small-motorboat');
  const p = sailTo(m, v, 600);
  const snap = snapshot(p.run, p.s, m, p.time, 42);
  assert.equal(snap.missionId, 'supply-run'); assert.equal(snap.vesselId, 'small-motorboat'); assert.equal(snap.savedAt, 42);
  assert.equal(snap.run.route.next, p.run.route.next);
  assert.ok(JSON.stringify(snap).length < 3000, 'small enough to autosave every few seconds');
});

test('save: bad, hostile or stale snapshots are discarded', () => {
  const m = getMission('supply-run'), v = getVessel('small-motorboat');
  const p = sailTo(m, v, 300);
  const good = snapshot(p.run, p.s, m, p.time);
  assert.ok(sanitizeSnapshot(good));
  const bad = (mut) => { const s = JSON.parse(JSON.stringify(good)); mut(s); return sanitizeSnapshot(s); };
  assert.equal(sanitizeSnapshot(null), null); assert.equal(sanitizeSnapshot('x'), null); assert.equal(sanitizeSnapshot({}), null);
  assert.equal(bad((s) => { s.version = 9; }), null, 'wrong version');
  assert.equal(bad((s) => { s.missionId = 'nope'; }), null, 'unknown mission');
  assert.equal(bad((s) => { s.vesselId = 'death-star'; }), null, 'unknown vessel');
  assert.equal(bad((s) => { s.vessel.x = 1e9; }), null, 'far outside the bay');
  assert.equal(bad((s) => { s.vessel.x = 'a'; }), null, 'not a number');
  assert.equal(bad((s) => { s.run.phase = 'complete'; }), null, 'a finished run is not resumable');
  assert.equal(bad((s) => { s.run = null; }), null);
  const clean = bad((s) => { s.run.integrity = -5; s.vessel.u = 9999; s.run.collisions = -3; s.run.time = 'x'; s.run.route.splits = 'oops'; });
  assert.equal(clean.run.integrity, 0.01); assert.equal(clean.vessel.u, 30); assert.equal(clean.run.collisions, 0); assert.equal(clean.run.time, 0); assert.deepEqual(clean.run.route.splits, []);
});

test('save: a save whose route or waypoint index no longer fits is refused', () => {
  const base = getMission('cape-parcels'), v = getVessel('small-motorboat');
  const route = findRoutes(base.fromPort, base.toPort, { vessel: v, max: 1 })[0];
  const mission = planMission(base, route, v);
  const p = sailTo(mission, v, 600);
  const good = roundTrip(snapshot(p.run, p.s, mission, p.time));
  assert.ok(resume(good));
  assert.equal(resume({ ...good, routeId: 'H>N' }), null, 'a route that is not on the chart');
  assert.equal(resume({ ...good, routeId: null }), null, 'a planned mission needs its route');
  const far = JSON.parse(JSON.stringify(good)); far.run.route.next = 99;
  assert.equal(resume(sanitizeSnapshot(far)), null, 'waypoint index past the end');
  assert.equal(rebuildMission({ ...good, missionId: 'nope' }), null);
});

test('save: a vessel too big for the route in the save is refused (route is re-validated for the vessel)', () => {
  const base = getMission('cape-parcels');
  const sk = getVessel('small-motorboat');
  const r = findRoutes(base.fromPort, base.toPort, { vessel: sk, max: 1 })[0];
  const m = planMission(base, r, sk);
  const p = sailTo(m, sk, 300);
  const snap = roundTrip(snapshot(p.run, p.s, m, p.time));
  assert.equal(rebuildMission({ ...snap, vesselId: 'container-carrier' }), null, 'a container ship cannot take that route');
});

test('save: storage round trip, corrupt storage and clearing', () => {
  const m = getMission('supply-run'), v = getVessel('small-motorboat');
  const p = sailTo(m, v, 300);
  const snap = roundTrip(snapshot(p.run, p.s, m, p.time, 1000));
  const st = fakeStore();
  assert.equal(readSave(st), null);
  assert.equal(writeSave(st, snap), true);
  assert.deepEqual(readSave(st), snap);
  clearSave(st);
  assert.equal(readSave(st), null);
  assert.equal(readSave(fakeStore('{broken')), null);
  assert.equal(readSave({ getItem() { throw new Error('blocked'); } }), null);
  assert.equal(writeSave({ setItem() { throw new Error('full'); } }, snap), false);
});

test('save: the Resume banner text names the job, the vessel, the time sailed and how long ago', () => {
  const m = getMission('supply-run'), v = getVessel('workboat');
  const run = createRun(m, v); run.time = 125; run.phase = 'underway';
  const snap = snapshot(run, createVesselState(0, 0, 0), m, 0, 1_000_000);
  assert.match(describeSave(snap, 1_000_000 + 30_000), /Pine Isle Supply Run in the Harbor Workboat: 2:05 sailed, saved just now/);
  assert.match(describeSave(snap, 1_000_000 + 12 * 60_000), /saved 12 min ago/);
  assert.match(describeSave(snap, 1_000_000 + 3 * 3600_000), /saved 3 h ago/);
});
