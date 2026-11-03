// Mid-mission save: enough state to put the boat, the run and the clock back exactly where they were.
// Pure logic (storage is passed in), validated on load: a bad or stale save is discarded, never trusted.
import { getMission } from '../data/missions.js';
import { getVessel } from '../data/vessels.js';
import { REGION } from './world.js';
import { createRun } from './mission.js';
import { routeFromPath, planMission, validatePath } from './routes.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'bwc-save';
const PHASES = ['underway', 'docking'];
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampNum = (v, lo, hi, d = 0) => Math.min(hi, Math.max(lo, num(v, d)));
const bool = (v) => v === true;

// What to remember. `mission` is the mission instance being sailed (it names the route that was chosen).
export function snapshot(run, vessel, mission, time, now = Date.now()) {
  return {
    version: SAVE_VERSION,
    savedAt: now,
    missionId: mission.id,
    routeId: mission.routeId || null,
    routeName: mission.routeName || null,
    vesselId: run.vesselId,
    time,
    vessel: { x: vessel.x, z: vessel.z, heading: vessel.heading, u: vessel.u, v: vessel.v, r: vessel.r, throttle: vessel.throttle, rudder: vessel.rudder },
    run: {
      phase: run.phase, time: run.time, departed: run.departed, deadline: run.deadline,
      integrity: run.integrity, collisions: run.collisions, respawns: run.respawns,
      speedingTime: run.speedingTime, speedViolations: run.speedViolations, inSpeedViolation: run.inSpeedViolation,
      dockHold: run.dockHold, roughTime: run.roughTime, strained: run.strained,
      dock: run.dock ? { centre: run.dock.centre, angleDeg: run.dock.angleDeg } : null,
      route: { next: run.route.next, started: run.route.started, finished: run.route.finished, time: run.route.time, lastSafe: run.route.lastSafe ? { x: run.route.lastSafe.x, z: run.route.lastSafe.z } : null, splits: run.route.splits.slice(0, 64) },
    },
  };
}

// Returns a cleaned snapshot, or null if it cannot be trusted.
export function sanitizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) return null;
  if (typeof raw.missionId !== 'string' || !getMission(raw.missionId)) return null;
  if (typeof raw.vesselId !== 'string' || !getVessel(raw.vesselId)) return null;
  const v = raw.vessel, r = raw.run;
  if (!v || typeof v !== 'object' || !r || typeof r !== 'object' || !r.route || typeof r.route !== 'object') return null;
  if (!PHASES.includes(r.phase)) return null;
  const inRegion = (x, z) => x >= REGION.minX - 50 && x <= REGION.maxX + 50 && z >= REGION.minZ - 50 && z <= REGION.maxZ + 50;
  if (!inRegion(num(v.x, NaN), num(v.z, NaN))) return null;
  const ls = r.route.lastSafe;
  return {
    version: SAVE_VERSION,
    savedAt: num(raw.savedAt),
    missionId: raw.missionId,
    routeId: typeof raw.routeId === 'string' ? raw.routeId.slice(0, 120) : null,
    routeName: typeof raw.routeName === 'string' ? raw.routeName.slice(0, 40) : null,
    vesselId: raw.vesselId,
    time: Math.max(0, num(raw.time)),
    vessel: { x: v.x, z: v.z, heading: num(v.heading), u: clampNum(v.u, -30, 30), v: clampNum(v.v, -30, 30), r: clampNum(v.r, -3, 3), throttle: clampNum(v.throttle, -1, 1), rudder: clampNum(v.rudder, -1, 1) },
    run: {
      phase: r.phase, time: Math.max(0, num(r.time)), departed: bool(r.departed), deadline: Math.max(1, num(r.deadline, 1)),
      integrity: clampNum(r.integrity, 0.01, 100, 100), collisions: Math.max(0, Math.floor(num(r.collisions))), respawns: Math.max(0, Math.floor(num(r.respawns))),
      speedingTime: Math.max(0, num(r.speedingTime)), speedViolations: Math.max(0, Math.floor(num(r.speedViolations))), inSpeedViolation: bool(r.inSpeedViolation),
      dockHold: Math.max(0, num(r.dockHold)), roughTime: Math.max(0, num(r.roughTime)), strained: bool(r.strained),
      dock: r.dock && typeof r.dock === 'object' ? { centre: Math.max(0, num(r.dock.centre)), angleDeg: Math.max(0, num(r.dock.angleDeg)) } : null,
      route: {
        next: Math.max(0, Math.floor(num(r.route.next))), started: bool(r.route.started), finished: bool(r.route.finished), time: Math.max(0, num(r.route.time)),
        lastSafe: ls && typeof ls === 'object' && Number.isFinite(ls.x) && Number.isFinite(ls.z) ? { x: ls.x, z: ls.z } : null,
        splits: Array.isArray(r.route.splits) ? r.route.splits.slice(0, 64).map((x) => num(x)) : [],
      },
    },
  };
}

// The mission instance that was being sailed (a planned mission gets its chosen route back).
// Returns { mission, vessel } or null if the route is no longer valid.
export function rebuildMission(snap) {
  const base = getMission(snap.missionId);
  const vessel = getVessel(snap.vesselId);
  if (!base || !vessel) return null;
  if (!base.planned) return { mission: base, vessel };
  const path = (snap.routeId || '').split('>').filter(Boolean);
  if (!path.length || !validatePath(base.fromPort, base.toPort, path, vessel).ok) return null;
  const route = routeFromPath(base.fromPort, base.toPort, path, vessel);
  route.name = snap.routeName || route.name;
  return { mission: planMission(base, route, vessel), vessel };
}

// Put a fresh run back where the snapshot left it. Returns false if it does not fit the mission.
export function restoreRun(run, snap) {
  const m = run.mission;
  if (snap.run.route.next > m.waypoints.length) return false;
  if (snap.run.phase === 'docking' && !m.dock) return false;
  Object.assign(run, {
    phase: snap.run.phase, time: snap.run.time, departed: snap.run.departed, deadline: snap.run.deadline,
    integrity: snap.run.integrity, collisions: snap.run.collisions, respawns: snap.run.respawns,
    speedingTime: snap.run.speedingTime, speedViolations: snap.run.speedViolations, inSpeedViolation: snap.run.inSpeedViolation,
    dockHold: snap.run.dockHold, roughTime: snap.run.roughTime, strained: snap.run.strained, dock: snap.run.dock,
  });
  Object.assign(run.route, snap.run.route);
  return true;
}

export function restoreVessel(vessel, snap) {
  Object.assign(vessel, snap.vessel);
  return vessel;
}

// Build everything needed to carry on. Returns { mission, vessel (model), run, state } or null.
export function resume(snap) {
  const rebuilt = rebuildMission(snap);
  if (!rebuilt) return null;
  const run = createRun(rebuilt.mission, rebuilt.vessel);
  if (!restoreRun(run, snap)) return null;
  return { mission: rebuilt.mission, vessel: rebuilt.vessel, run, state: { ...snap.vessel }, time: snap.time };
}

export function readSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? sanitizeSnapshot(JSON.parse(raw)) : null;
  } catch { return null; }
}
export function writeSave(storage, snap) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(snap)); return true; } catch { return false; }
}
export function clearSave(storage) {
  try { storage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

export function describeSave(snap, now = Date.now()) {
  const m = getMission(snap.missionId);
  const v = getVessel(snap.vesselId);
  const mins = Math.max(0, Math.floor((now - snap.savedAt) / 60000));
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  const sailed = Math.round(snap.run.time);
  return `${m.title} in the ${v.name}: ${Math.floor(sailed / 60)}:${String(sailed % 60).padStart(2, '0')} sailed, saved ${ago}`;
}
