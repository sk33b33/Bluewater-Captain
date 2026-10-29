import test from 'node:test';
import assert from 'node:assert/strict';
import { NODES, EDGES } from '../src/data/charts.js';
import { PORTS, BERTHS, getPort, portByBerth, portZones, knotsToMps } from '../src/data/ports.js';
import { MISSIONS, getMission, gateBuoys } from '../src/data/missions.js';
import { VESSELS, getVessel } from '../src/data/vessels.js';
import { WEATHER, getWeather } from '../src/data/weather.js';
import { staticObstacles, resolveCollisions, REGION, BUOY_RADIUS } from '../src/sim/world.js';
import { distanceToObstacle, distanceToShore } from '../src/sim/shore.js';
import { createVesselState } from '../src/sim/vessel.js';
import { SMALL_MOTORBOAT as P } from '../src/sim/vessel.js';
import { LEGS, getNode, neighbours, findRoutes, shortestRoute, routeFromPath, nextMarkers, isComplete, validatePath, planMission, estimateSeconds, routeDeadline, pathLength, legPassable, REFERENCE_SPEED } from '../src/sim/routes.js';
import { createRun, stepRun, scoreRun, PORT_ZONES, zoneAt, SPEEDING_POINTS_PER_SECOND, EARLY_BONUS_MAX } from '../src/sim/mission.js';
import { missionAccess, usableVessels, portLengthLimit, vesselFitsPorts } from '../src/sim/licenses.js';
import { defaultProfile } from '../src/sim/profile.js';
import { deadlineFor } from '../src/sim/weather.js';
import { autopilot } from './helpers/autopilot.js';
import { toPx, fromPx, pickNode } from '../src/ui/chart.js';

const obs = staticObstacles();
const skiff = getVessel('small-motorboat');
const workboat = getVessel('workboat');
const cat = getVessel('coastal-passenger');
const portIds = Object.keys(PORTS);

const clearOfObstacles = (x, z, r = 0) => obs.every((o) => distanceToObstacle(x, z, o) > r);

// ---- the region and its ports
test('the region is a 4 km box with the west harbor inside it', () => {
  assert.equal(REGION.maxX - REGION.minX, 4000);
  assert.equal(REGION.maxZ - REGION.minZ, 4000);
  assert.ok(Object.keys(PORTS).length >= 4);
});

test('every port has a clear berth, a clear start pose, a slow zone and a beacon', () => {
  for (const p of Object.values(PORTS)) {
    const b = BERTHS[p.berth];
    assert.ok(b, `${p.id} berth`);
    for (const [label, x, z] of [['berth centre', b.cx, b.cz], ['start', p.start.x, p.start.z]]) {
      const s = createVesselState(x, z, p.start.heading);
      assert.equal(resolveCollisions(s, skiff, obs).hit, false, `${p.id} ${label}`);
    }
    assert.ok(p.speedLimit.knots > 0 && p.speedLimit.radius > 30, p.id);
    assert.ok(p.beacon && p.beacon.x !== undefined, `${p.id} beacon`);
    assert.ok(p.maxLength >= 12, `${p.id} takes at least the small vessels`);
    assert.equal(getPort(p.id), p);
    assert.equal(portByBerth(p.berth), p);
    for (const w of p.inbound) assert.ok(clearOfObstacles(w.x, w.z, 8), `${p.id} inbound ${w.name}`);
  }
  assert.equal(getPort('nope'), null);
});

test('port slow zones: one per port, centred on the berth, in m/s', () => {
  const zones = portZones();
  assert.equal(zones.length, portIds.length);
  for (const z of zones) {
    const p = PORTS[z.port];
    assert.equal(z.x, BERTHS[p.berth].cx);
    assert.ok(Math.abs(z.limit - knotsToMps(p.speedLimit.knots)) < 1e-9);
    assert.ok(Math.hypot(p.start.x - z.x, p.start.z - z.z) < z.radius, 'departures start inside the slow zone');
  }
  assert.equal(PORT_ZONES.length, portIds.length);
  assert.ok(knotsToMps(14) > 7 && knotsToMps(14) < 7.4);
});

test('the other ports are far from each other and from other ports\' slow zones', () => {
  for (const a of PORT_ZONES) for (const b of PORT_ZONES) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > a.radius + b.radius + 200);
});

// ---- the chart
test('chart nodes are in open water, inside the region, with unique ids', () => {
  assert.equal(new Set(NODES.map((n) => n.id)).size, NODES.length);
  for (const n of NODES) {
    assert.ok(n.x > REGION.minX && n.x < REGION.maxX && n.z > REGION.minZ && n.z < REGION.maxZ, n.id);
    assert.ok(clearOfObstacles(n.x, n.z, 25), `${n.id} near an obstacle`);
  }
});

test('every port fairway is a chart marker', () => {
  for (const p of Object.values(PORTS)) assert.ok(getNode(p.fairway), p.id);
  assert.equal(getNode('nope'), null);
});

test('chart legs: symmetric, real lengths, and only the Seal gap is a narrow passage', () => {
  for (const [a, b] of EDGES) {
    const f = LEGS.get(`${a}-${b}`), r = LEGS.get(`${b}-${a}`);
    assert.ok(f && r);
    assert.equal(f.length, r.length);
    const A = getNode(a), B = getNode(b);
    assert.ok(Math.abs(f.length - Math.hypot(A.x - B.x, A.z - B.z)) < 1e-6);
    assert.ok(f.clearance > 5, `${a}-${b} touches something`);
  }
  const narrow = EDGES.filter(([a, b]) => LEGS.get(`${a}-${b}`).narrow).map(([a, b]) => `${a}-${b}`);
  assert.deepEqual(narrow, ['SGW-SGE']);
  assert.ok(neighbours('H').some((e) => e.to === 'A'));
});

test('a boat sailing straight along any leg never touches land (hull sweep, every vessel)', () => {
  for (const [a, b] of EDGES) {
    const A = getNode(a), B = getNode(b);
    const len = Math.hypot(B.x - A.x, B.z - A.z);
    const heading = Math.atan2(B.x - A.x, -(B.z - A.z));
    for (const v of VESSELS) {
      if (!legPassable(LEGS.get(`${a}-${b}`), v)) continue;
      for (let d = 0; d <= len; d += 4) {
        const t = d / len;
        const s = createVesselState(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t, heading);
        assert.equal(resolveCollisions(s, v, obs).hit, false, `${a}-${b} ${v.id} at ${Math.round(d)} m`);
      }
    }
  }
});

test('gate buoys of every chart marker are clear of land and leave room to pass', () => {
  for (const n of NODES) {
    // a gate across a straight leg through this marker: use any neighbour for a direction
    const nb = neighbours(n.id)[0];
    const other = getNode(nb.to);
    const wps = [{ x: other.x, z: other.z }, { name: n.name, x: n.x, z: n.z, radius: n.radius || 30, spread: n.spread }];
    const [a, b] = gateBuoys(wps, 1);
    for (const p of [a, b]) assert.ok(clearOfObstacles(p.x, p.z, BUOY_RADIUS + 3), `${n.id} gate buoy at ${Math.round(p.x)},${Math.round(p.z)}`);
  }
});

// ---- route search
test('every pair of ports can be sailed, and busy pairs have real alternatives', () => {
  for (const a of portIds) for (const b of portIds) {
    if (a === b) { assert.deepEqual(findRoutes(a, b), []); continue; }
    assert.ok(findRoutes(a, b).length >= 1, `${a} -> ${b}`);
  }
  for (const [a, b] of [['harbor', 'cape'], ['cape', 'southgate'], ['harbor', 'southgate'], ['pine', 'southgate'], ['harbor', 'pine']]) {
    assert.ok(findRoutes(a, b).length >= 2, `${a} -> ${b} should offer a choice`);
  }
});

test('routes: shortest first, distinct, bounded detour, never through another port', () => {
  for (const a of portIds) for (const b of portIds) {
    if (a === b) continue;
    const rs = findRoutes(a, b, { max: 4 });
    const others = portIds.filter((p) => p !== a && p !== b).map((p) => PORTS[p].fairway);
    rs.forEach((r, i) => {
      assert.equal(r.path[0], PORTS[a].fairway);
      assert.equal(r.path[r.path.length - 1], PORTS[b].fairway);
      assert.ok(r.length >= rs[0].length - 1e-9);
      assert.ok(r.seaLength <= rs[0].seaLength * 1.35 + 1e-6, `${a}->${b} #${i} too long`);
      assert.ok(!r.path.some((n) => others.includes(n)), `${a}->${b} cuts through a port`);
      assert.equal(r.name, i === 0 ? 'Shortest route' : `Alternative ${i}`);
      assert.equal(new Set(r.path).size, r.path.length, 'simple path');
    });
    assert.equal(new Set(rs.map((r) => r.id)).size, rs.length, 'distinct');
  }
});

test('route length is the whole trip: berth to the first marker, the charted legs, the approach to the berth', () => {
  const r = shortestRoute('harbor', 'pine');
  assert.deepEqual(r.path, ['H', 'A', 'P']);
  const start = PORTS.harbor.start;
  const out = Math.hypot(getNode('H').x - start.x, getNode('H').z - start.z);
  const sea = pathLength(r.path);
  const b = BERTHS.pine;
  const inb = Math.hypot(getNode('P').x - b.cx, getNode('P').z - b.cz);
  assert.ok(Math.abs(r.seaLength - sea) < 1e-9);
  assert.ok(Math.abs(r.length - (out + sea + inb)) < 1e-6);
  const back = shortestRoute('pine', 'harbor');
  assert.ok(back.length > back.seaLength + 100, 'harbor approach through the mouth and basin counts');
});

test('route waypoints: markers in order then the harbor approach; the last is the mouth and basin for the harbor', () => {
  const r = shortestRoute('pine', 'harbor');
  assert.deepEqual(r.waypoints.map((w) => w.name), ['Landing approach', 'Open water', 'Harbor entrance', 'Harbor mouth', 'Inner basin']);
  const w = shortestRoute('harbor', 'cape').waypoints;
  assert.equal(w[w.length - 1].name, 'Cape approach');
  assert.ok(w.every((p) => p.radius > 0));
});

test('narrow passages are reported and passability depends on the vessel', () => {
  const via = findRoutes('harbor', 'cape').find((r) => r.path.includes('SGW'));
  assert.ok(via && via.narrowCount === 1 && /Narrow passage/.test(via.hazards[0]) && /m wide/.test(via.hazards[0]));
  const wide = findRoutes('harbor', 'cape').find((r) => !r.path.includes('SGW'));
  assert.equal(wide.hazards.length, 0);
  assert.equal(legPassable(LEGS.get('SGW-SGE'), skiff), true);
  assert.equal(legPassable({ clearance: 3 }, cat), false, 'a 6 m gap is too tight for the Coastal Cat');
  assert.equal(legPassable(LEGS.get('H-A'), null), true);
  const fake = { clearance: 1 };
  assert.equal(legPassable(fake, skiff), false);
});

test('deadline and time estimates follow route length, vessel and sea', () => {
  const r = shortestRoute('harbor', 'cape'), s = shortestRoute('harbor', 'pine');
  assert.ok(r.deadline > s.deadline * 2);
  assert.equal(r.deadline, routeDeadline(r.length));
  assert.ok(Math.abs(r.deadline - (r.length / REFERENCE_SPEED + 30)) <= 2.5 + 1e-9);
  assert.ok(estimateSeconds(r, workboat, WEATHER.calm) > estimateSeconds(r, skiff, WEATHER.calm));
  assert.ok(estimateSeconds(r, skiff, WEATHER.rough) > estimateSeconds(r, skiff, WEATHER.calm));
});

// ---- building a route by hand
test('hand-built routes: next markers, completion and validation', () => {
  const to = 'cape';
  let path = ['H'];
  const opts = nextMarkers(path, to, skiff).map((o) => o.id).sort();
  assert.deepEqual(opts, ['A', 'G']);
  assert.equal(isComplete(path, to), false);
  path = ['H', 'G', 'N', 'SS', 'CO', 'C'];
  assert.equal(isComplete(path, to), true);
  assert.deepEqual(nextMarkers(path, to, skiff), []);
  assert.deepEqual(validatePath('harbor', to, path, skiff), { ok: true, reason: '' });
  assert.equal(validatePath('harbor', to, ['A', 'G'], skiff).ok, false, 'must start at the fairway');
  assert.match(validatePath('harbor', to, ['H', 'N'], skiff).reason, /not joined/);
  assert.match(validatePath('harbor', to, ['H', 'A', 'G', 'A'], skiff).reason, /twice/);
  assert.match(validatePath('harbor', to, ['H', 'A'], skiff).reason, /ends at/);
  const r = routeFromPath('harbor', to, path);
  assert.equal(r.id, 'H>G>N>SS>CO>C');
  assert.ok(r.length > pathLength(path));
});

test('a hand-built route that wanders (visits every marker once) is still valid and longer', () => {
  const long = ['H', 'A', 'P', 'G', 'N', 'SS', 'CO', 'C'];
  assert.equal(validatePath('harbor', 'cape', long, skiff).ok, true);
  assert.ok(routeFromPath('harbor', 'cape', long).length > shortestRoute('harbor', 'cape').length);
});

test('planMission swaps in the route and its deadline for planned missions only', () => {
  const m = getMission('cape-parcels');
  const alt = findRoutes('harbor', 'cape')[1];
  const planned = planMission(m, alt);
  assert.notEqual(planned, m);
  assert.deepEqual(planned.waypoints, alt.waypoints);
  assert.equal(planned.deadline, alt.deadline);
  assert.equal(planned.routeName, alt.name);
  assert.equal(m.routeName, 'Shortest route', 'the base mission is untouched');
  const training = getMission('training-loop');
  assert.equal(planMission(training, alt), training);
});

// ---- missions use the ports
test('planned missions derive start, berth, names and a default route from their ports', () => {
  for (const m of MISSIONS.filter((x) => x.planned)) {
    assert.equal(m.start, PORTS[m.fromPort].start, m.id);
    assert.equal(m.dock, PORTS[m.toPort].berth);
    assert.equal(m.from, PORTS[m.fromPort].name);
    assert.ok(m.waypoints.length >= 2 && m.deadline > 100 && m.routeLength > 800, m.id);
    assert.ok(m.fromPort !== m.toPort);
  }
  const ports = new Set(MISSIONS.filter((x) => x.planned).flatMap((m) => [m.fromPort, m.toPort]));
  assert.equal(ports.size, portIds.length, 'every port has a job');
});

test('the contract board spans the bay: long hauls pay more and need reputation', () => {
  const c = MISSIONS.filter((m) => m.kind === 'contract');
  assert.ok(c.length >= 8);
  const hard = c.filter((m) => m.minReputation);
  assert.ok(hard.length >= 4);
  const short = getMission('supply-run'), long = getMission('cape-parcels');
  assert.ok(long.reward > short.reward && long.routeLength > short.routeLength * 2);
});

// ---- reputation and port size rules
test('reputation gates far contracts; port size filters vessels', () => {
  const p = defaultProfile();
  p.licenses['small-craft-permit'] = { held: true };
  const parcels = getMission('cape-parcels');
  p.reputation = 3;
  const a = missionAccess(p, parcels);
  assert.equal(a.ok, false);
  assert.match(a.reason, /reputation 5/);
  p.reputation = 5;
  assert.equal(missionAccess(p, parcels).ok, true);
  assert.equal(portLengthLimit(getMission('island-hop')), PORTS.southgate.maxLength);
  assert.equal(portLengthLimit(getMission('training-loop')), Infinity);
  assert.equal(vesselFitsPorts(cat, getMission('island-hop')), false, 'a 15 m craft does not fit a 12 m marina');
  assert.equal(vesselFitsPorts(workboat, getMission('island-hop')), true);
  const fake = { fromPort: 'harbor', toPort: 'southgate', vesselClasses: ['coastal-passenger'], kind: 'contract', license: 'small-craft-permit' };
  p.licenses['coastal-skipper'] = { held: true };
  assert.deepEqual(usableVessels(p, fake), []);
  const r = missionAccess(p, { ...fake, id: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Southgate Marina/);
});

// ---- port approach limits
function sailZone(speed, secs, zone = PORT_ZONES[0]) {
  const run = createRun(getMission('dock-drill'), skiff);
  const s = createVesselState(zone.x, zone.z, 0);
  s.u = speed;
  const events = [];
  for (let i = 0; i < 60 * secs; i++) events.push(...stepRun(run, s, 1 / 60, BERTHS));
  return { run, events };
}

test('port speed limit: speeding in a slow zone is counted once per entry, slow is free, outside is free', () => {
  const z = PORT_ZONES[0];
  const slow = sailZone(z.limit * 0.8, 5);
  assert.equal(slow.run.speedingTime, 0);
  assert.equal(slow.events.filter((e) => e.type === 'speeding').length, 0);
  const fast = sailZone(z.limit * 1.5, 5);
  assert.ok(Math.abs(fast.run.speedingTime - 5) < 0.05);
  assert.equal(fast.events.filter((e) => e.type === 'speeding').length, 1, 'one warning, not one per tick');
  assert.equal(fast.run.speedViolations, 1);
  const run = createRun(getMission('dock-drill'), skiff);
  const s = createVesselState(1500, 1500, 0); s.u = 20;
  for (let i = 0; i < 120; i++) stepRun(run, s, 1 / 60, BERTHS);
  assert.equal(run.speedingTime, 0, 'open water has no limit');
  assert.equal(zoneAt(s, PORT_ZONES), null);
  assert.equal(zoneAt({ x: z.x + 10, z: z.z }, PORT_ZONES).port, z.port);
});

test('port speed limit costs Navigation points, explained, capped, and re-entry warns again', () => {
  const m = getMission('dock-drill');
  const make = (secs) => { const run = createRun(m, skiff); run.speedingTime = secs; run.phase = 'complete'; run.dock = { centre: 0, angleDeg: 0 }; run.time = 20; return scoreRun(run); };
  const clean = make(0).categories.find((c) => c.name === 'Navigation');
  assert.equal(clean.points, clean.max);
  const six = make(6).categories.find((c) => c.name === 'Navigation');
  assert.equal(six.points, clean.max - Math.floor(6 * SPEEDING_POINTS_PER_SECOND));
  assert.match(six.note, /6 s over a port speed limit/);
  const lots = make(500).categories.find((c) => c.name === 'Navigation');
  assert.equal(lots.points, Math.round(clean.max * 0.7), 'capped at 30% of the category');
  const run = createRun(m, skiff);
  const z = PORT_ZONES[0];
  const s = createVesselState(z.x, z.z, 0);
  const ev = [];
  for (const speed of [z.limit * 2, z.limit * 0.5, z.limit * 2]) { s.u = speed; for (let i = 0; i < 10; i++) ev.push(...stepRun(run, s, 1 / 60, BERTHS)); }
  assert.equal(ev.filter((e) => e.type === 'speeding').length, 2, 'a second entry warns again');
});

// ---- early arrival bonus
test('early arrival bonus: none at 85% of the deadline or later, full (15%) at 50% or earlier', () => {
  const m = getMission('supply-run');
  const mk = (frac) => { const run = createRun(m, skiff); run.phase = 'complete'; run.dock = { centre: 0, angleDeg: 0 }; run.time = run.deadline * frac; return scoreRun(run); };
  const late = mk(0.9), edge = mk(0.85), mid = mk(0.675), full = mk(0.5), fast = mk(0.2);
  assert.equal(late.earlyBonus, 0); assert.equal(edge.earlyBonus, 0);
  assert.ok(Math.abs(mid.earlyBonus - EARLY_BONUS_MAX / 2) < 1e-9);
  assert.ok(Math.abs(full.earlyBonus - EARLY_BONUS_MAX) < 1e-9 && Math.abs(fast.earlyBonus - EARLY_BONUS_MAX) < 1e-9);
  assert.equal(late.reward, m.reward);
  assert.equal(full.reward, Math.round(m.reward * 1.15));
  assert.equal(full.earlyBonusCredits, full.reward - late.reward);
  const exam = getMission('small-craft-exam');
  const run = createRun(exam, skiff); run.phase = 'complete'; run.dock = { centre: 0, angleDeg: 0 }; run.time = 10;
  assert.equal(scoreRun(run).earlyBonus, 0, 'exams pay nothing, so no bonus');
});

// ---- the chart screen maths
test('chart projection round-trips and picks the nearest marker', () => {
  for (const x of [REGION.minX, 0, 1000, REGION.maxX]) assert.ok(Math.abs(fromPx(toPx(x, 600), 600) - x) < 1e-6);
  assert.ok(toPx(REGION.minX, 600) > 0 && toPx(REGION.maxX, 600) < 600, 'the region sits inside the canvas with a margin');
  const n = getNode('C');
  const hit = pickNode(toPx(n.x, 600) + 3, toPx(n.z, 600) - 2, 600, 14);
  assert.equal(hit.id, 'C');
  assert.equal(pickNode(2, 2, 600, 10), null);
});

// ---- every route is sailable: scripted captain on every alternative, with every vessel that may take the job
test('the scripted captain completes every planned contract on every suggested route with every allowed vessel', () => {
  let runs = 0;
  for (const m of MISSIONS.filter((x) => x.planned)) {
    for (const cls of m.vesselClasses) {
      const v = VESSELS.find((x) => x.class === cls);
      if (!vesselFitsPorts(v, m)) continue;
      for (const route of findRoutes(m.fromPort, m.toPort, { vessel: v, max: 3 })) {
        const inst = planMission(m, route);
        const { run, s } = autopilot(inst, v, { maxSeconds: 1500 });
        runs++;
        assert.equal(run.phase, 'complete', `${m.id}/${v.id}/${route.id}: ${run.phase} at (${s.x.toFixed(0)},${s.z.toFixed(0)}) wp=${run.route.next} t=${run.time.toFixed(0)} hull=${Math.round(run.integrity)}`);
        assert.ok(run.time <= run.deadline, `${m.id}/${v.id}/${route.id}: ${run.time.toFixed(0)}s over ${run.deadline}s`);
        assert.ok(scoreRun(run).total >= 60, `${m.id}/${v.id}/${route.id} score`);
      }
    }
  }
  assert.ok(runs >= 30, `only ${runs} runs`);
});

test('a longer route gets a longer deadline, so route choice is about risk and bonus, not just time', () => {
  const m = getMission('cape-parcels');
  const [a, b] = findRoutes('harbor', 'cape', { max: 2 });
  assert.ok(b.deadline > a.deadline);
  assert.ok(deadlineFor(planMission(m, b), skiff, getWeather(m.weather)) > deadlineFor(planMission(m, a), skiff, getWeather(m.weather)));
});
