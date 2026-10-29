// Mission run state machine, docking check and scoring. Pure logic: no DOM or WebGL.
// phases: underway -> (docking ->) complete | failed
import { createRouteState, updateRoute, respawnPoint } from './route.js';
import { deadlineFor } from './weather.js';
import { getWeather } from '../data/weather.js';

export const DOCK = { maxSpeed: 1.5, maxAngleDeg: 25, holdSeconds: 2, maxOffset: 8 };
export const TIME_LIMIT_FACTOR = 2; // mission fails at deadline x this
export const DAMAGE_PER_MPS = 4; // hull % lost per m/s of impact speed
export const MIN_DAMAGE_IMPACT = 1; // m/s, gentler contact does no damage

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// `vessel` sets the vessel id and, with the mission's weather, scales the deadline (mission deadlines are
// written for the skiff in calm weather: slower vessels and rougher seas get more time).
export function createRun(mission, vessel = null) {
  return {
    mission,
    vesselId: vessel ? vessel.id : null,
    weatherId: mission.weather,
    deadline: vessel ? deadlineFor(mission, vessel, getWeather(mission.weather)) : mission.deadline,
    phase: 'underway',
    time: 0,
    departed: false,
    route: createRouteState(),
    integrity: 100,
    collisions: 0,
    respawns: 0,
    dockHold: 0,
    dock: null, // { centre, angleDeg } captured when docked
    failReason: null,
  };
}

// Vessel against a berth rectangle, in the berth's own frame.
export function evaluateDock(v, berth) {
  const dx = v.x - berth.cx;
  const dz = v.z - berth.cz;
  const f = { x: Math.sin(berth.heading), z: -Math.cos(berth.heading) };
  const along = dx * f.x + dz * f.z;
  const across = dx * -f.z + dz * f.x;
  let diff = Math.abs(angleDiff(v.heading, berth.heading));
  if (diff > Math.PI / 2) diff = Math.PI - diff; // either direction along the pier is fine
  const angleDeg = (diff * 180) / Math.PI;
  const speed = Math.hypot(v.u, v.v);
  return {
    along,
    across,
    inside: Math.abs(along) <= berth.halfLength - 1 && Math.abs(across) <= berth.halfWidth,
    angleDeg,
    speed,
    speedOk: speed <= DOCK.maxSpeed,
    angleOk: angleDeg <= DOCK.maxAngleDeg,
    centre: Math.hypot(along, across),
  };
}

function fail(run, reason) {
  run.phase = 'failed';
  run.failReason = reason;
  return { type: 'failed', reason };
}

// Call after resolving a collision. `strength` is the vessel's hullStrength (lower = tougher hull).
// Returns an event or null.
export function applyImpact(run, impact, strength = 1) {
  if (run.phase !== 'underway' && run.phase !== 'docking') return null;
  if (impact < MIN_DAMAGE_IMPACT) return null;
  run.collisions += 1;
  run.integrity = Math.max(0, run.integrity - impact * DAMAGE_PER_MPS * strength);
  if (run.integrity <= 0) return fail(run, 'hull');
  return { type: 'damage', integrity: run.integrity };
}

export function registerRespawn(run) {
  if (run.phase === 'underway' || run.phase === 'docking') run.respawns += 1;
}

export function abortRun(run) {
  if (run.phase === 'underway' || run.phase === 'docking') return fail(run, 'aborted');
  return null;
}

// Advance the run. Returns a list of events: waypoint, phase, complete, failed.
export function stepRun(run, vessel, dt, berths) {
  const events = [];
  if (run.phase !== 'underway' && run.phase !== 'docking') return events;
  const m = run.mission;
  if (!run.departed && Math.hypot(vessel.u, vessel.v) > 0.5) run.departed = true;
  if (run.departed) run.time += dt;

  if (run.phase === 'underway') {
    const reached = updateRoute(run.route, m.waypoints, vessel, 0);
    if (reached >= 0) events.push({ type: 'waypoint', index: reached, last: run.route.finished });
    if (run.route.finished) {
      if (m.dock) {
        run.phase = 'docking';
        events.push({ type: 'phase', phase: 'docking' });
      } else {
        run.phase = 'complete';
        events.push({ type: 'complete' });
        return events;
      }
    }
  }

  if (run.phase === 'docking') {
    const d = evaluateDock(vessel, berths[m.dock]);
    if (d.inside && d.speedOk && d.angleOk) run.dockHold += dt;
    else run.dockHold = 0;
    if (run.dockHold >= DOCK.holdSeconds) {
      run.dock = { centre: d.centre, angleDeg: d.angleDeg };
      run.phase = 'complete';
      events.push({ type: 'complete' });
      return events;
    }
  }

  if (run.time > run.deadline * TIME_LIMIT_FACTOR) events.push(fail(run, 'timeout'));
  return events;
}

// Where to put the vessel after a respawn: last passed waypoint, or the mission start.
export function respawnPose(run, berths) {
  const m = run.mission;
  const last = run.route.lastSafe;
  if (run.phase === 'docking' && last) {
    const b = berths[m.dock];
    const h = Math.atan2(b.cx - last.x, -(b.cz - last.z));
    return { x: last.x, z: last.z, heading: (h + 2 * Math.PI) % (2 * Math.PI) };
  }
  return respawnPoint(run.route, m.waypoints, m.start);
}

export function gradeFor(total) {
  if (total >= 90) return 'S';
  if (total >= 80) return 'A';
  if (total >= 65) return 'B';
  if (total >= 50) return 'C';
  return 'D';
}

// Score a completed run. Every category carries a plain-language note explaining deductions.
export function scoreRun(run) {
  const m = run.mission;
  const max = m.dock ? { safety: 30, navigation: 20, timing: 20, docking: 30 } : { safety: 40, navigation: 40, timing: 20 };
  const cats = [];

  const safety = Math.round((max.safety * run.integrity) / 100);
  cats.push({
    name: 'Safety',
    points: safety,
    max: max.safety,
    note: run.collisions === 0 ? 'No damaging collisions' : `${run.collisions} collision${run.collisions === 1 ? '' : 's'}, hull at ${Math.round(run.integrity)}%`,
  });

  const perRespawn = max.navigation * 0.2;
  const nav = Math.max(0, Math.round(max.navigation - perRespawn * run.respawns));
  cats.push({
    name: 'Navigation',
    points: nav,
    max: max.navigation,
    note: run.respawns === 0 ? 'All marks passed, no respawns' : `${run.respawns} respawn${run.respawns === 1 ? '' : 's'} (-${perRespawn} each)`,
  });

  const late = Math.max(0, run.time - run.deadline);
  const timing = Math.max(0, max.timing - Math.ceil(late / 5));
  cats.push({
    name: 'Timing',
    points: timing,
    max: max.timing,
    note: late === 0 ? 'Arrived within the deadline' : `${Math.round(late)} s over the deadline (-1 per 5 s)`,
  });

  if (m.dock) {
    const pos = clamp(1 - run.dock.centre / DOCK.maxOffset, 0, 1);
    const ang = clamp(1 - run.dock.angleDeg / DOCK.maxAngleDeg, 0, 1);
    const docking = Math.round(max.docking * (0.6 * pos + 0.4 * ang));
    cats.push({
      name: 'Docking',
      points: docking,
      max: max.docking,
      note: `${run.dock.centre.toFixed(1)} m from berth centre, ${Math.round(run.dock.angleDeg)}° off the pier line`,
    });
  }

  const total = cats.reduce((a, c) => a + c.points, 0);
  const grade = gradeFor(total);
  return {
    categories: cats,
    total,
    grade,
    time: run.time,
    reward: Math.round(m.reward * (0.5 + (0.5 * total) / 100)),
    reputation: Math.round((m.rep * total) / 100),
    xp: Math.round(m.xp * (0.5 + (0.5 * total) / 100)),
  };
}
