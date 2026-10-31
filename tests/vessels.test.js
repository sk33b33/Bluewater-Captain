import test from 'node:test';
import assert from 'node:assert/strict';
import { VESSELS, getVessel, vesselForClass, DEFAULT_VESSEL } from '../src/data/vessels.js';
import { VESSEL_CLASSES, LICENSES, getLicense } from '../src/data/licenses.js';
import { MISSIONS, getMission } from '../src/data/missions.js';
import { createVesselState, stepVessel } from '../src/sim/vessel.js';
import { hullCircles, hullCircleCount, resolveCollisions } from '../src/sim/world.js';
import { WIND, windVector, windKnots, windPushAngleDeg, windArrow } from '../src/sim/wind.js';
import { createRun, applyImpact, scoreRun } from '../src/sim/mission.js';
import { defaultProfile, loadProfile, saveProfile, sanitizeProfile, recordResult } from '../src/sim/profile.js';
import { fleetStatus, selectVessel, chooseVessel, usableVessels, usableClasses, classUsableForMission, missionAccess, evaluateLicense, recordWritten, startExam, judgeExam, applyExamOutcome, permittedClasses } from '../src/sim/licenses.js';
import { autopilot } from './helpers/autopilot.js';

const DT = 1 / 60;
const [skiff, workboat, cat] = [getVessel('small-motorboat'), getVessel('workboat'), getVessel('coastal-passenger')];
const skipper = getLicense('coastal-skipper');
const permit = getLicense('small-craft-permit');

// ---- measurements used to prove the vessels really differ
function atSpeed(v, target) {
  const s = createVesselState(0, 0, 0);
  for (let i = 0; i < 60 * 40; i++) stepVessel(s, { throttle: Math.max(-1, Math.min(1, (target - s.u) * 0.8)), steer: 0 }, v, DT);
  return s;
}
const topSpeed = (v) => { const s = createVesselState(0, 0, 0); for (let i = 0; i < 60 * 90; i++) stepVessel(s, { throttle: 1, steer: 0 }, v, DT); return s.u; };
function brakingDistance(v, from = 6) {
  const s = atSpeed(v, from); const z0 = s.z;
  for (let i = 0; i < 60 * 60 && s.u > 0.3; i++) stepVessel(s, { throttle: -1, steer: 0 }, v, DT);
  return Math.abs(s.z - z0);
}
function coastDistance(v, from = 6) {
  const s = atSpeed(v, from); const z0 = s.z;
  for (let i = 0; i < 60 * 120 && s.u > 1; i++) stepVessel(s, { throttle: 0, steer: 0 }, v, DT);
  return Math.abs(s.z - z0);
}
function turnRadius(v, speed = 6) {
  const s = atSpeed(v, speed);
  for (let i = 0; i < 60 * 12; i++) stepVessel(s, { throttle: Math.max(-1, Math.min(1, (speed - s.u) * 0.8)), steer: 1 }, v, DT);
  return s.u / Math.abs(s.r);
}
function drift(v, secs = 60, wind = windVector()) {
  const s = createVesselState(0, 0, 0);
  for (let i = 0; i < 60 * secs; i++) stepVessel(s, { throttle: 0, steer: 0 }, v, DT, wind);
  return s;
}

// ---- roster
test('at least three vessel classes with distinct, valid definitions', () => {
  assert.ok(VESSELS.length >= 3);
  assert.equal(new Set(VESSELS.map((v) => v.class)).size, VESSELS.length, 'one vessel per class');
  assert.equal(new Set(VESSELS.map((v) => v.id)).size, VESSELS.length);
  for (const v of VESSELS) {
    assert.ok(VESSEL_CLASSES[v.class], v.id);
    for (const k of ['length', 'beam', 'draft', 'massTonnes', 'maxSpeed', 'maxReverse', 'thrustAccel', 'reverseAccel', 'linearResistance', 'maxYawRate', 'yawResponse', 'lateralDamping', 'hullRadius', 'hullStrength', 'windage', 'deadlineFactor']) {
      assert.ok(Number.isFinite(v[k]) && v[k] > 0, `${v.id}.${k}`);
    }
    assert.ok(v.thrustAccel > v.linearResistance * v.maxSpeed, `${v.id} can reach its top speed`);
    assert.ok(v.reverseAccel > v.linearResistance * v.maxReverse, `${v.id} can reach its reverse speed`);
    assert.ok(v.hullRadius * 2 <= v.length && v.hullRadius <= v.beam, `${v.id} hull circles fit the hull`);
  }
  assert.equal(getVessel(DEFAULT_VESSEL).class, 'small-motorboat');
  assert.equal(vesselForClass('workboat').id, 'workboat');
  assert.equal(getVessel('nope'), null);
});

test('dimensions grow from skiff to workboat to passenger craft', () => {
  assert.ok(skiff.length < workboat.length && workboat.length < cat.length);
  assert.ok(skiff.massTonnes * 5 < workboat.massTonnes);
});

// ---- handling really differs
test('each vessel reaches its own top speed', () => {
  for (const v of VESSELS) assert.ok(Math.abs(topSpeed(v) - v.maxSpeed) < 0.7, `${v.id}: ${topSpeed(v).toFixed(2)} vs ${v.maxSpeed}`);
  assert.ok(topSpeed(skiff) > topSpeed(cat) && topSpeed(cat) > topSpeed(workboat));
});

test('stopping distance: heavier vessels need much more room (same 6 m/s, full astern)', () => {
  const [a, b, c] = [brakingDistance(skiff), brakingDistance(workboat), brakingDistance(cat)];
  assert.ok(b > a * 1.8, `workboat ${b.toFixed(1)} vs skiff ${a.toFixed(1)}`);
  assert.ok(c > b * 1.15, `passenger ${c.toFixed(1)} vs workboat ${b.toFixed(1)}`);
});

test('coasting: heavier vessels carry their way much longer', () => {
  assert.ok(coastDistance(workboat) > coastDistance(skiff) * 1.1);
  assert.ok(coastDistance(cat) > coastDistance(workboat) * 1.1);
});

test('turning radius: the skiff turns tight, big vessels swing wide', () => {
  const [a, b, c] = [turnRadius(skiff), turnRadius(workboat), turnRadius(cat)];
  assert.ok(b > a * 1.4, `workboat ${b.toFixed(1)} vs skiff ${a.toFixed(1)}`);
  assert.ok(c > b * 1.15, `passenger ${c.toFixed(1)} vs workboat ${b.toFixed(1)}`);
});

test('acceleration: the skiff gets going far faster than the workboat', () => {
  const t90 = (v) => { const s = createVesselState(0, 0, 0); for (let i = 0; i < 60 * 120; i++) { stepVessel(s, { throttle: 1, steer: 0 }, v, DT); if (s.u >= 0.9 * v.maxSpeed) return i * DT; } return Infinity; };
  assert.ok(t90(workboat) > t90(skiff) * 1.2);
});

// ---- wind
test('wind helpers: vector direction, knots, relative push angle and arrow', () => {
  const w = windVector({ fromDeg: 270, speed: 5 }); // from the west, blows east
  assert.ok(Math.abs(w.x - 5) < 1e-9 && Math.abs(w.z) < 1e-9);
  const n = windVector({ fromDeg: 0, speed: 5 }); // from the north, blows south (+z)
  assert.ok(Math.abs(n.z - 5) < 1e-9 && Math.abs(n.x) < 1e-9);
  assert.ok(Math.abs(windKnots({ speed: 10 }) - 19.44) < 0.01);
  assert.ok(Math.abs(windPushAngleDeg(0, { fromDeg: 270, speed: 5 }) - 90) < 1e-9, 'heading north, wind from west pushes to starboard');
  assert.equal(windArrow(0, { fromDeg: 180, speed: 5 }), '↑', 'wind from the south pushes a north-facing bow forward');
  assert.equal(windArrow(0, { fromDeg: 0, speed: 5 }), '↓', 'wind from the north pushes astern');
});

test('no wind means no drift; wind carries a stopped boat downwind', () => {
  const none = drift(skiff, 30, { x: 0, z: 0 });
  assert.equal(none.x, 0); assert.equal(none.z, 0);
  const w = windVector();
  const s = drift(skiff, 30);
  assert.ok(s.x * w.x > 0 && s.z * w.z > 0, 'moves the way the wind blows');
  assert.ok(Math.abs(Math.hypot(s.x, s.z) - skiff.windage * WIND.speed * 30) < 0.01);
});

test('windage: the tall passenger craft drifts most, the heavy workboat least', () => {
  const d = (v) => Math.hypot(drift(v).x, drift(v).z);
  assert.ok(d(cat) > d(skiff) * 1.5, 'passenger vs skiff');
  assert.ok(d(skiff) > d(workboat) * 1.5, 'skiff vs workboat');
});

// ---- collision and damage
test('hull circles scale with the vessel, span its length and leave no gaps', () => {
  for (const v of VESSELS) {
    const c = hullCircles(createVesselState(0, 0, 0), v);
    assert.ok(c.length >= 3 && c.length === hullCircleCount(v));
    assert.ok(c.every((k) => k.r === v.hullRadius));
    const zs = c.map((k) => k.z).sort((a, b) => a - b);
    const reach = (zs[zs.length - 1] - zs[0]) / 2 + v.hullRadius;
    assert.ok(Math.abs(reach - v.length / 2) < 1e-9, `${v.id} circles cover the hull length`);
    for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] <= v.hullRadius * 1.5 + 1e-9, `${v.id} gap between circles`);
  }
  assert.ok(hullCircleCount(getVessel('container-carrier')) > hullCircleCount(skiff), 'a 140 m ship needs many more circles');
});

test('a bigger hull touches a wall a smaller one clears', () => {
  const wall = [{ type: 'rect', name: 'Wall', cx: 20, cz: 0, hx: 10, hz: 100 }]; // west face at x=10
  const a = createVesselState(8.5, 0, 0);
  const b = createVesselState(8.5, 0, 0);
  assert.equal(resolveCollisions(a, skiff, wall).hit, false);
  assert.equal(resolveCollisions(b, workboat, wall).hit, true);
});

test('hull strength: the tough workboat takes less damage from the same hit', () => {
  const hit = (v) => { const run = createRun(getMission('supply-run'), v); applyImpact(run, 5, v.hullStrength); return 100 - run.integrity; };
  assert.ok(hit(workboat) < hit(skiff) * 0.7);
  assert.ok(hit(cat) < hit(skiff) && hit(cat) > hit(workboat));
});

test('deadlines scale with the vessel (and, in calm weather, the skiff gets exactly the mission deadline)', () => {
  const m = getMission('training-loop'); // calm
  assert.equal(createRun(m, skiff).deadline, m.deadline);
  assert.ok(createRun(m, workboat).deadline > m.deadline);
  assert.equal(createRun(m).deadline, m.deadline, 'no vessel -> mission deadline');
  const rough = getMission('supply-run'); // breezy
  assert.ok(createRun(rough, skiff).deadline > rough.deadline, 'sea adds time');
});

// ---- fleet, selection and license gates
function withPermit() {
  const p = defaultProfile();
  p.licenses[permit.id] = { held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } };
  return p;
}
function withSkipper() {
  const p = withPermit();
  p.licenses[skipper.id] = { held: true, heldAt: 2, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } };
  return p;
}

test('fleet: fresh profile can select the skiff only; workboat and cat show the license that unlocks them', () => {
  const p = defaultProfile();
  const rows = fleetStatus(p);
  assert.equal(rows.length, VESSELS.length);
  const byId = Object.fromEntries(rows.map((r) => [r.vessel.id, r]));
  assert.equal(byId['small-motorboat'].selectable, true);
  assert.equal(byId.workboat.selectable, false);
  assert.match(byId.workboat.reason, /Coastal Skipper/);
  assert.match(byId['coastal-passenger'].reason, /Coastal Skipper/);
  assert.equal(selectVessel(p, 'workboat'), false);
  assert.equal(p.vessel, DEFAULT_VESSEL);
  assert.equal(selectVessel(p, 'nope'), false);
});

test('GATE: holding the Coastal Skipper unlocks the workboat and passenger craft; the Small Craft Permit alone does not', () => {
  const p = withPermit();
  assert.deepEqual([...permittedClasses(p)], ['small-motorboat']);
  assert.equal(selectVessel(p, 'workboat'), false);
  const q = withSkipper();
  assert.deepEqual([...permittedClasses(q)].sort(), ['coastal-passenger', 'small-motorboat', 'workboat']);
  assert.equal(selectVessel(q, 'workboat'), true);
  assert.equal(q.vessel, 'workboat');
  assert.equal(fleetStatus(q).find((r) => r.vessel.id === 'workboat').active, true);
});

test('mission vessel rules: contracts need a permitted class; vessel-specific contracts stay locked without it', () => {
  const supply = getMission('supply-run');
  const haul = getMission('workboat-haul');
  const shuttle = getMission('passenger-shuttle');
  const p = withPermit();
  assert.equal(missionAccess(p, supply).ok, true);
  assert.deepEqual(usableClasses(p, supply), ['small-motorboat']);
  const h = missionAccess(p, haul);
  assert.equal(h.ok, false);
  assert.match(h.reason, /workboat/i);
  assert.match(h.reason, /Coastal Skipper/);
  assert.equal(missionAccess(p, shuttle).ok, false);
  const q = withSkipper();
  assert.equal(missionAccess(q, haul).ok, true);
  assert.equal(missionAccess(q, shuttle).ok, true);
  assert.deepEqual(usableClasses(q, supply).sort(), ['coastal-passenger', 'small-motorboat', 'workboat']);
});

test('chooseVessel: the active vessel if it fits the mission, else the first that does', () => {
  const supply = getMission('supply-run');
  const haul = getMission('workboat-haul');
  const q = withSkipper();
  q.vessel = 'coastal-passenger';
  assert.equal(chooseVessel(q, supply).id, 'coastal-passenger');
  assert.equal(chooseVessel(q, haul).id, 'workboat', 'active vessel cannot do this job');
  const p = withPermit();
  assert.equal(chooseVessel(p, supply).id, 'small-motorboat');
  assert.equal(chooseVessel(p, haul), null);
  assert.deepEqual(usableVessels(q, supply).map((v) => v.id), ['small-motorboat', 'workboat', 'coastal-passenger']);
});

test('every contract has at least one vessel class, and some jobs only suit one class', () => {
  const contracts = MISSIONS.filter((m) => m.kind === 'contract');
  assert.ok(contracts.some((m) => m.vesselClasses.length > 1), 'a job open to several vessels');
  assert.ok(contracts.some((m) => m.vesselClasses.length === 1 && m.vesselClasses[0] === 'workboat'));
  assert.ok(contracts.some((m) => m.vesselClasses.length === 1 && m.vesselClasses[0] === 'coastal-passenger'));
});

// ---- the Coastal Skipper path (earns the vessels)
function done(p, id, score = 80) { recordResult(p, id, { reward: 0, reputation: 0, xp: 0, total: score, grade: 'B', time: 100 }); }

test('Coastal Skipper is now earnable: prerequisites, training under instruction, written test, exam', () => {
  const trial = getMission('workboat-trials');
  const p = withPermit();
  assert.equal(evaluateLicense(p, skipper).status, 'locked');
  assert.equal(missionAccess(p, trial).ok, false);
  assert.match(missionAccess(p, trial).reason, /Coastal Skipper/);
  p.reputation = 10;
  assert.equal(evaluateLicense(p, skipper).status, 'available');
  assert.equal(classUsableForMission(p, trial, 'workboat'), true, 'trials open under instruction');
  assert.equal(missionAccess(p, trial).ok, true);
  assert.equal(classUsableForMission(p, getMission('workboat-haul'), 'workboat'), false, 'but never for contracts');
  assert.equal(evaluateLicense(p, skipper).canPractical, false);
  done(p, 'workboat-trials'); done(p, 'passenger-trials');
  recordWritten(p, skipper.id, { correct: 5, passed: true });
  p.credits = 300;
  const ev = evaluateLicense(p, skipper);
  assert.equal(ev.canPractical, true);
  const exam = getMission('coastal-skipper-exam');
  assert.equal(missionAccess(p, exam).ok, true);
  assert.equal(startExam(p, exam).ok, true);
  assert.equal(p.credits, 300 - skipper.exam.fee);
  const run = createRun(exam, workboat);
  const j = judgeExam(run, { total: 82 }, skipper.exam);
  assert.equal(applyExamOutcome(p, skipper, { total: 82 }, j, 9).awarded, true);
  assert.equal(permittedClasses(p).has('workboat'), true);
  assert.equal(selectVessel(p, 'coastal-passenger'), true);
  assert.equal(p.reputation, 10 + skipper.bonus.reputation);
});

test('the Skipper exam fee is charged per attempt and the exam only allows its own vessel', () => {
  const exam = getMission('coastal-skipper-exam');
  assert.deepEqual(exam.vesselClasses, ['workboat']);
  assert.equal(skipper.exam.fee > permit.exam.fee, true);
});

// ---- profile v3
function store(initial) {
  const m = new Map(initial ? [['bwc-profile', initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('profile v3 stores the active vessel across save and load', () => {
  const st = store();
  const p = withSkipper();
  selectVessel(p, 'workboat');
  saveProfile(st, p);
  const q = loadProfile(st);
  assert.equal(q.version, 3);
  assert.equal(q.vessel, 'workboat');
});

test('migration: v2 saves keep everything and default to the skiff; bad vessel ids are ignored', () => {
  const v2 = { version: 2, credits: 321, reputation: 8, xp: 50, completed: {}, licenses: { 'small-craft-permit': { held: true, heldAt: 5, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 80, passed: true } } } };
  const p = loadProfile(store(JSON.stringify(v2)));
  assert.equal(p.version, 3);
  assert.equal(p.credits, 321);
  assert.equal(p.licenses['small-craft-permit'].held, true);
  assert.equal(p.vessel, DEFAULT_VESSEL);
  assert.equal(sanitizeProfile({ version: 3, vessel: 'death-star' }).vessel, DEFAULT_VESSEL);
  assert.equal(sanitizeProfile({ version: 3, vessel: 'workboat' }).vessel, 'workboat');
});

// ---- every allowed vessel can do every mission it is offered
test('Skipper-path missions are passable with their vessels (scripted captain, wind on)', () => {
  for (const id of ['workboat-trials', 'passenger-trials', 'coastal-skipper-exam']) {
    const m = getMission(id);
    for (const cls of m.vesselClasses) {
      const v = vesselForClass(cls);
      const { run } = autopilot(m, v);
      assert.equal(run.phase, 'complete', `${id}/${v.id}`);
      if (m.kind === 'exam') {
        const r = scoreRun(run);
        assert.ok(judgeExam(run, r, skipper.exam).passed, `${id} pass: ${r.total}`);
      }
    }
  }
});

// ---- the fleet screen shows measured numbers
import { handlingProfile, statRows, brakingDistance as bd, turnRadius as tr } from '../src/sim/handling.js';
test('handling profile matches independent measurement and orders the fleet sensibly', () => {
  for (const v of VESSELS) {
    const h = handlingProfile(v);
    assert.ok(Math.abs(h.brakeDistance - brakingDistance(v)) < 0.01);
    assert.ok(Math.abs(h.turnRadius - turnRadius(v)) < 0.01);
    assert.ok(Math.abs(h.driftPerMinute - Math.hypot(drift(v).x, drift(v).z)) < 0.01);
  }
  assert.ok(handlingProfile(cat).brakeDistance > handlingProfile(skiff).brakeDistance);
  assert.ok(handlingProfile(workboat).toughness > handlingProfile(skiff).toughness);
});

test('stat rows: one bar per metric, ratios in (0, 1], the best-scaled vessel hits 1', () => {
  for (const v of VESSELS) {
    const rows = statRows(v, VESSELS);
    assert.equal(rows.length, 7);
    for (const r of rows) assert.ok(r.ratio >= 0 && r.ratio <= 1.000001 && r.display.length > 0 && ['higher', 'lower'].includes(r.better), `${v.id} ${r.label}`);
  }
  const topSpeedRows = VESSELS.map((v) => statRows(v, VESSELS)[0].ratio);
  assert.ok(Math.max(...topSpeedRows) === 1);
  assert.equal(bd(skiff) > 0, true); assert.equal(tr(skiff) > 0, true);
});
