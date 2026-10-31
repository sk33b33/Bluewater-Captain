import test from 'node:test';
import assert from 'node:assert/strict';
import { VESSELS, getVessel } from '../src/data/vessels.js';
import { LICENSES, getLicense } from '../src/data/licenses.js';
import { MISSIONS, getMission, BERTHS } from '../src/data/missions.js';
import { PORTS, portView, portAccepts, portZones } from '../src/data/ports.js';
import { LARGE_VESSEL_QUESTIONS } from '../src/data/quiz.js';
import { WEATHER } from '../src/data/weather.js';
import { SHOALS, UNDER_KEEL, blocksVessel, shoalsFor, staticObstacles, resolveCollisions, hullCircles } from '../src/sim/world.js';
import { createVesselState, stepVessel } from '../src/sim/vessel.js';
import { brakingDistance, turnRadius, timeTo90, driftPerMinute } from '../src/sim/handling.js';
import { seaEffect } from '../src/sim/weather.js';
import { createRun, stepRun, scoreRun, evaluateDock, CARGO_ALLOWANCE, DOCK } from '../src/sim/mission.js';
import { findRoutes, planMission, LEGS, legPassable, routeFromPath, validatePath } from '../src/sim/routes.js';
import { EDGES, NODES } from '../src/data/charts.js';
import { defaultProfile } from '../src/sim/profile.js';
import { evaluateLicense, missionAccess, usableVessels, classUsableForMission, judgeExam, vesselFitsPorts, canUseVessel, selectVessel } from '../src/sim/licenses.js';
import { autopilot } from './helpers/autopilot.js';

const [skiff, workboat, cat, cargo, box] = VESSELS;
const ships = [cargo, box];
const small = [skiff, workboat, cat];
const obs = staticObstacles();
const lv = getLicense('large-vessel');

// ---- the ships themselves
test('five vessels: three small craft and two ships, ordered by size', () => {
  assert.equal(VESSELS.length, 5);
  assert.deepEqual(VESSELS.map((v) => v.class), ['small-motorboat', 'workboat', 'coastal-passenger', 'cargo-ship', 'container-carrier']);
  for (let i = 1; i < VESSELS.length; i++) assert.ok(VESSELS[i].length > VESSELS[i - 1].length && VESSELS[i].massTonnes > VESSELS[i - 1].massTonnes);
  assert.ok(box.length >= 100 && cargo.length >= 60, 'real ship scale');
  for (const v of ships) assert.ok(v.draft >= 5 && v.cargoLimit > 0 && v.hullRadius * 2 >= v.beam * 0.9, v.id);
});

test('ships are sluggish by an order of magnitude: pick-up, stopping and turning', () => {
  const big = [cargo, box];
  for (const v of big) {
    assert.ok(timeTo90(v) > timeTo90(skiff) * 5, `${v.id} pick-up ${timeTo90(v).toFixed(0)} s`);
    assert.ok(brakingDistance(v) > brakingDistance(skiff) * 8, `${v.id} stopping ${brakingDistance(v).toFixed(0)} m`);
    assert.ok(turnRadius(v) > turnRadius(skiff) * 4, `${v.id} turning ${turnRadius(v).toFixed(0)} m`);
    assert.ok(brakingDistance(v) > brakingDistance(cat) && turnRadius(v) > turnRadius(cat));
  }
  assert.ok(brakingDistance(box) > brakingDistance(cargo) && turnRadius(box) > turnRadius(cargo) && timeTo90(box) > timeTo90(cargo), 'the container carrier is the heaviest');
});

test('ships shrug off waves but the tall container stack catches the wind', () => {
  for (const v of ships) {
    const s = seaEffect(WEATHER.rough, v);
    assert.equal(s.speedFactor, 1); assert.equal(s.steerFactor, 1);
  }
  assert.ok(driftPerMinute(box) > driftPerMinute(cargo) && driftPerMinute(cargo) > driftPerMinute(workboat));
});

test('ships can reach their top speed and stop within their own limits', () => {
  for (const v of ships) {
    const s = createVesselState(0, 0, 0);
    for (let i = 0; i < 60 * 400; i++) stepVessel(s, { throttle: 1, steer: 0 }, v, 1 / 60);
    assert.ok(Math.abs(s.u - v.maxSpeed) < 0.6, `${v.id} reaches ${s.u.toFixed(2)} of ${v.maxSpeed}`);
    for (let i = 0; i < 60 * 600 && s.u > 0.05; i++) stepVessel(s, { throttle: -1, steer: 0 }, v, 1 / 60);
    assert.ok(s.u <= 0.05, `${v.id} stops under reverse thrust`);
  }
});

test('hull circles cover a 140 m ship with no gaps and keep it inside a 40 m wide berth footprint', () => {
  const c = hullCircles(createVesselState(0, 0, 0), box);
  assert.ok(c.length >= 15);
  const zs = c.map((k) => k.z).sort((a, b) => a - b);
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] <= box.hullRadius * 1.5 + 1e-9);
  assert.ok((zs[zs.length - 1] - zs[0]) / 2 + box.hullRadius <= box.length / 2 + 1e-9);
});

// ---- shoals and draft
test('shoals block exactly the vessels that need more water', () => {
  assert.ok(SHOALS.length >= 4 && UNDER_KEEL > 0);
  for (const sh of SHOALS) {
    assert.ok(sh.depth > 0);
    for (const v of small) assert.equal(blocksVessel(sh, v), false, `${v.id} sails over ${sh.name}`);
    for (const v of ships) assert.equal(blocksVessel(sh, v), true, `${v.id} cannot cross ${sh.name}`);
  }
  for (const v of small) assert.deepEqual(shoalsFor(v), []);
  for (const v of ships) assert.equal(shoalsFor(v).length, SHOALS.length);
  assert.equal(blocksVessel({ depth: 5 }, { draft: 3.9 }), false);
  assert.equal(blocksVessel({ depth: 5 }, { draft: 4.1 }), true);
});

test('a ship runs aground on a shoal the skiff crosses', () => {
  const sh = SHOALS.find((x) => x.name === 'Cape north shoal');
  const aground = createVesselState(sh.cx, sh.cz, 0);
  assert.equal(resolveCollisions(aground, cargo, [...obs, ...shoalsFor(cargo)]).hit, true);
  const free = createVesselState(sh.cx, sh.cz, 0);
  assert.equal(resolveCollisions(free, skiff, [...obs, ...shoalsFor(skiff)]).hit, false);
  const deep = createVesselState(2150, 488, Math.PI / 2); // the dredged channel
  assert.equal(resolveCollisions(deep, box, [...obs, ...shoalsFor(box)]).hit, false, 'the channel centreline is clear for the biggest ship');
});

test('the dredged channel is wide enough for the container carrier, with shoal clearance on both sides', () => {
  const v = box;
  for (let x = 1500; x <= 2330; x += 10) {
    const s = createVesselState(x, x < 1700 ? 520 - (x - 1500) * 0.16 : 488, Math.PI / 2);
    assert.equal(resolveCollisions(s, v, [...obs, ...shoalsFor(v)]).hit, false, `channel at x=${x}`);
  }
});

// ---- ports
test('ports show the berth that fits the vessel: small craft use small berths, ships the deep terminals', () => {
  assert.equal(portView('cape', skiff).berth, 'cape');
  assert.equal(portView('cape', cat).berth, 'cape');
  assert.equal(portView('cape', cargo).berth, 'capeDeep');
  assert.equal(portView('cape', box).berth, 'capeDeep');
  assert.equal(portView('cape', cargo).fairway, 'CT');
  assert.equal(portView('cape', cargo).name, 'Cape Quay');
  assert.equal(portView('cape', null).berth, 'cape');
  assert.equal(portView('harbor', box).berth, 'harborN', 'ports without a deep variant never change');
});

test('who can use which port: size limits both ways', () => {
  const accepts = (p, v) => portAccepts(p, v);
  for (const v of ships) {
    assert.equal(accepts('cape', v), true); assert.equal(accepts('driftwood', v), true);
    for (const p of ['harbor', 'pine', 'southgate']) assert.equal(accepts(p, v), false, `${p} refuses ${v.id}`);
  }
  for (const v of small) assert.equal(accepts('driftwood', v), false, 'commercial terminal: 30 m and up only');
  assert.equal(accepts('cape', skiff), true);
  assert.equal(accepts('southgate', cat), false);
});

test('mission vessel limits include commercial terminals', () => {
  const c = getMission('container-feeder');
  assert.equal(vesselFitsPorts(box, c), true);
  assert.equal(vesselFitsPorts(skiff, c), false);
  assert.equal(vesselFitsPorts(box, getMission('supply-run')), false, 'a 140 m ship cannot enter the harbor');
});

test('deep berths are long and wide enough for the biggest ship, with slow zones around them', () => {
  for (const key of ['capeDeep', 'driftwood']) {
    const b = BERTHS[key];
    assert.ok(b.halfLength * 2 >= box.length * 1.4 && b.halfWidth * 2 >= box.beam * 1.5, key);
    assert.ok(b.maxOffset >= 30);
  }
  const deepZones = portZones().filter((z) => z.deep || z.port === 'driftwood');
  assert.ok(deepZones.length >= 2 && deepZones.every((z) => z.radius >= 300 && z.knots <= 10));
});

// ---- docking a long ship
test('a long ship must fit inside the berth: its centre has to stay clear of the ends', () => {
  const b = BERTHS.capeDeep;
  const at = (along, len) => evaluateDock(createVesselState(b.cx + along, b.cz, b.heading), b, len);
  assert.equal(at(0, box.length).inside, true);
  assert.equal(at(40, box.length).inside, true);
  assert.equal(at(60, box.length).inside, false, 'the stern would hang over the end of the berth');
  assert.equal(at(100, cargo.length).inside, false);
  assert.equal(at(60, cargo.length).inside, true, 'the shorter freighter has more room');
  const sg = BERTHS.cape;
  const ev = (along, len) => evaluateDock(createVesselState(sg.cx + along, sg.cz, sg.heading), sg, len);
  assert.equal(ev(8, skiff.length).inside, true, 'small berths keep their old margin');
  assert.equal(ev(8.5, skiff.length).inside, false);
});

test('docking accuracy is judged against the berth: 10 m off is poor at a marina but good at a terminal', () => {
  const mk = (id, dock, centre) => { const m = { ...getMission(id), dock }; const run = createRun(m, small[0]); run.phase = 'complete'; run.dock = { centre, angleDeg: 0 }; run.time = 30; return scoreRun(run).categories.find((c) => c.name === 'Docking').points; };
  const marina = mk('supply-run', 'pine', 6);
  const terminal = mk('supply-run', 'capeDeep', 6);
  assert.ok(terminal > marina, `${terminal} vs ${marina}`);
});

// ---- chart and routes for ships
test('ships can only use deep legs; small craft can use them all', () => {
  const shallow = [...LEGS.values()].filter((l) => l.minDepth < Infinity);
  assert.ok(shallow.length >= 10, 'the shoal bands cross several legs');
  for (const l of shallow) {
    for (const v of ships) assert.equal(legPassable(l, v), false, `${l.a}-${l.b} for ${v.id}`);
    assert.equal(legPassable({ ...l, clearance: 100 }, skiff), true);
  }
  for (const v of ships) assert.equal(legPassable(LEGS.get('CT-CW'), v), true);
  assert.equal(LEGS.get('SGW-SGE').narrow, true);
  for (const v of ships) assert.equal(legPassable(LEGS.get('SGW-SGE'), v), false, 'the Seal gap is far too tight');
});

test('ships have routes between the terminals, in both directions, with a real alternative', () => {
  for (const v of ships) for (const [a, b] of [['cape', 'driftwood'], ['driftwood', 'cape']]) {
    const rs = findRoutes(a, b, { vessel: v, max: 3 });
    assert.ok(rs.length >= 2, `${a}->${b} ${v.id}: ${rs.length}`);
    for (const r of rs) {
      for (let i = 1; i < r.path.length; i++) assert.ok(legPassable(LEGS.get(`${r.path[i - 1]}-${r.path[i]}`), v), `${r.id} ${v.id}`);
      assert.equal(r.vesselId, v.id);
    }
  }
  assert.equal(findRoutes('harbor', 'cape', { vessel: box }).length, 0, 'a container ship cannot reach the harbor');
});

test('a hull sweep along every ship route, with shoals, never touches anything', () => {
  for (const v of ships) for (const [a, b] of [['cape', 'driftwood'], ['driftwood', 'cape']]) {
    for (const r of findRoutes(a, b, { vessel: v, max: 3 })) {
      const pts = [portView(a, v).start, ...r.waypoints, { x: BERTHS[portView(b, v).berth].cx, z: BERTHS[portView(b, v).berth].cz }];
      for (let i = 1; i < pts.length; i++) {
        const A = pts[i - 1], B = pts[i], len = Math.hypot(B.x - A.x, B.z - A.z), h = Math.atan2(B.x - A.x, -(B.z - A.z));
        for (let d = 0; d <= len; d += 6) {
          const t = d / len;
          const s = createVesselState(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t, h);
          assert.equal(resolveCollisions(s, v, [...obs, ...shoalsFor(v)]).hit, false, `${v.id} ${r.id} leg ${i} at ${Math.round(d)} m`);
        }
      }
    }
  }
});

test('a hand-built route for a ship is rejected if it crosses a shoal', () => {
  assert.equal(validatePath('cape', 'driftwood', ['CT', 'CW', 'DS1', 'DS2', 'D'], box).ok, true);
  const bad = validatePath('cape', 'driftwood', ['CT', 'CW', 'SS', 'CO'], box);
  assert.equal(bad.ok, false);
});

test('planMission picks the start pose and berth for the vessel', () => {
  const m = getMission('cape-parcels');
  const r = findRoutes(m.fromPort, m.toPort, { vessel: skiff, max: 1 })[0];
  const p = planMission(m, r, skiff);
  assert.equal(p.dock, 'cape'); assert.deepEqual(p.start, PORTS.harbor.start);
  const c = getMission('container-feeder');
  const rb = findRoutes(c.fromPort, c.toPort, { vessel: box, max: 1 })[0];
  const pb = planMission(c, rb, box);
  assert.equal(pb.dock, 'driftwood'); assert.deepEqual(pb.start, PORTS.cape.deep.start);
  assert.equal(rb.waypoints[rb.waypoints.length - 1].name, 'Terminal channel');
  assert.equal(c.dock, 'driftwood', 'the base mission is planned for its only vessel');
});

// ---- cargo
function strainRun(speed, yawRate, secs, mission = getMission('container-feeder'), vessel = box) {
  const run = createRun(mission, vessel);
  run.departed = true;
  const s = createVesselState(2000, 600, 0);
  s.u = speed; s.r = yawRate;
  const events = [];
  for (let i = 0; i < 60 * secs; i++) events.push(...stepRun(run, s, 1 / 60, BERTHS));
  return { run, events };
}

test('cargo strain: turning hard at speed shifts the cargo; gentle turns do not', () => {
  const gentle = strainRun(6, 0.04, 5);
  assert.equal(gentle.run.roughTime, 0);
  assert.equal(gentle.events.filter((e) => e.type === 'strain').length, 0);
  const hard = strainRun(6, 0.1, 5);
  assert.ok(Math.abs(hard.run.roughTime - 5) < 0.1);
  assert.equal(hard.events.filter((e) => e.type === 'strain').length, 1, 'one warning, not one per tick');
  assert.equal(hard.run.cargoLimit, box.cargoLimit);
  assert.ok(createRun(getMission('container-feeder'), cargo).cargoLimit > box.cargoLimit, 'a freighter takes more than a container stack');
});

test('cargo strain only applies to cargo jobs', () => {
  const sup = createRun(getMission('supply-run'), skiff);
  assert.equal(sup.cargoLimit, null);
  const r = strainRun(8, 0.9, 5, getMission('supply-run'), skiff);
  assert.equal(r.run.roughTime, 0);
});

test('cargo scoring: a fifth of the score, lost to hard turns and hull damage, explained', () => {
  const m = getMission('coaster-cargo');
  const mk = ({ rough = 0, integrity = 100 } = {}) => { const run = createRun(m, cargo); run.phase = 'complete'; run.dock = { centre: 0, angleDeg: 0 }; run.time = run.deadline * 0.9; run.roughTime = rough; run.integrity = integrity; return scoreRun(run); };
  const clean = mk();
  assert.equal(clean.total, 100);
  const names = clean.categories.map((c) => c.name);
  assert.deepEqual(names, ['Safety', 'Navigation', 'Timing', 'Docking', 'Cargo']);
  assert.equal(clean.categories.find((c) => c.name === 'Cargo').max, 20);
  assert.equal(clean.categories.reduce((a, c) => a + c.max, 0), 100);
  const shaken = mk({ rough: CARGO_ALLOWANCE / 2 });
  const cargoRow = shaken.categories.find((c) => c.name === 'Cargo');
  assert.equal(cargoRow.points, 10);
  assert.match(cargoRow.note, /6 s of hard turning shifted the cargo/);
  assert.equal(mk({ rough: CARGO_ALLOWANCE * 2 }).categories.find((c) => c.name === 'Cargo').points, 0);
  const dented = mk({ integrity: 50 }).categories.find((c) => c.name === 'Cargo');
  assert.equal(dented.points, 10);
  assert.match(dented.note, /hull at 50%/);
  const small = createRun(getMission('supply-run'), skiff); small.phase = 'complete'; small.dock = { centre: 0, angleDeg: 0 }; small.time = 10;
  assert.ok(!scoreRun(small).categories.some((c) => c.name === 'Cargo'), 'no cargo line on ordinary jobs');
});

// ---- licensing the ships
const held = () => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } });
function skipperProfile(rep) {
  const p = defaultProfile();
  p.licenses['small-craft-permit'] = held(); p.licenses['coastal-skipper'] = held();
  p.reputation = rep;
  return p;
}

test('Large Vessel Endorsement: data and prerequisites', () => {
  assert.equal(LICENSES.length, 3);
  assert.deepEqual(lv.prerequisites.licenses, ['coastal-skipper']);
  assert.equal(lv.prerequisites.reputation, 30);
  assert.deepEqual(lv.permits, ['cargo-ship', 'container-carrier']);
  assert.ok(lv.exam.fee > getLicense('coastal-skipper').exam.fee && lv.exam.maxCollisions === 1);
  assert.equal(LARGE_VESSEL_QUESTIONS.length >= lv.written.questions + 3, true);
  assert.equal(evaluateLicense(defaultProfile(), lv).status, 'locked');
  assert.equal(evaluateLicense(skipperProfile(29), lv).status, 'locked');
  assert.equal(evaluateLicense(skipperProfile(30), lv).status, 'available');
});

test('sea trials for ships open only once you qualify, and only for that license\'s trials', () => {
  const trials = getMission('cargo-trials');
  const contract = getMission('coaster-cargo');
  const low = skipperProfile(10);
  assert.equal(missionAccess(low, trials).ok, false);
  const ok = skipperProfile(30);
  assert.equal(missionAccess(ok, trials).ok, true);
  assert.equal(classUsableForMission(ok, trials, 'cargo-ship'), true);
  assert.equal(classUsableForMission(ok, contract, 'cargo-ship'), false, 'never for contracts');
  assert.deepEqual(usableVessels(ok, trials).map((v) => v.id), ['cargo-ship']);
});

test('GATE: the endorsement unlocks the ships and the deep-water contracts; reputation gates the container jobs', () => {
  const p = skipperProfile(60);
  const contract = getMission('coaster-cargo'), feeder = getMission('container-feeder');
  assert.equal(missionAccess(p, contract).ok, false);
  assert.match(missionAccess(p, contract).reason, /Large Vessel Endorsement/);
  p.licenses['large-vessel'] = held();
  assert.equal(canUseVessel(p, 'cargo-ship'), true); assert.equal(canUseVessel(p, 'container-carrier'), true);
  assert.equal(missionAccess(p, contract).ok, true);
  assert.equal(missionAccess(p, feeder).ok, true);
  p.reputation = 35;
  assert.equal(missionAccess(p, contract).ok, true);
  assert.equal(missionAccess(p, feeder).ok, false);
  assert.match(missionAccess(p, feeder).reason, /reputation 45/);
  assert.equal(selectVessel(p, 'container-carrier'), true);
  assert.equal(missionAccess(p, getMission('supply-run')).ok, true);
  assert.deepEqual(usableVessels(p, getMission('supply-run')).map((v) => v.id), ['small-motorboat', 'workboat', 'coastal-passenger'], 'the ships do not fit the small harbors');
});

test('the quiz pool is well formed', () => {
  for (const q of LARGE_VESSEL_QUESTIONS) assert.ok(q.options.length >= 3 && q.answer >= 0 && q.answer < q.options.length && q.explain.length > 10, q.id);
});

// ---- every ship mission is passable (scripted captain)
test('the practical exam is passable with at most one scrape and the cargo intact', () => {
  const exam = getMission('large-vessel-exam');
  for (const r of findRoutes(exam.fromPort, exam.toPort, { vessel: cargo, max: 2 })) {
    const { run } = autopilot(planMission(exam, r, cargo), cargo, { maxSeconds: 2500 });
    assert.equal(run.phase, 'complete', r.id);
    const score = scoreRun(run);
    assert.ok(judgeExam(run, score, lv.exam).passed, `${r.id}: ${score.total} ${JSON.stringify(score.categories)}`);
    assert.ok(run.roughTime < 1, 'cargo not shaken');
  }
});

test('the trials courses are passable with their ships, and the container trials also reach the berth', () => {
  for (const [id, v] of [['cargo-trials', cargo], ['container-trials', box]]) {
    const m = getMission(id);
    const { run } = autopilot(m, v, { maxSeconds: 2500 });
    assert.equal(run.phase, 'complete', id);
    assert.ok(scoreRun(run).total >= 50, `${id} reaches the license score`);
  }
});

test('nodes of the deep channel sit in water deep enough for the biggest ship', () => {
  for (const id of ['CT', 'CW', 'DS1', 'DS2', 'D', 'DT', 'TE']) {
    const n = NODES.find((x) => x.id === id);
    for (const sh of shoalsFor(box)) {
      const d = sh.type === 'circle' ? Math.hypot(n.x - sh.cx, n.z - sh.cz) - sh.r : Math.hypot(Math.max(Math.abs(n.x - sh.cx) - sh.hx, 0), Math.max(Math.abs(n.z - sh.cz) - sh.hz, 0));
      assert.ok(d > 40, `${id} is ${Math.round(d)} m from ${sh.name}`);
    }
  }
});
