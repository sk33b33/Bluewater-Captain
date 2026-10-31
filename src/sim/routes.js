// Route planning on the navigation chart. A route is a path of chart markers from one port's fairway to
// another's, plus the port approach waypoints at each end. Pure logic: nothing here touches the DOM or WebGL.
import { NODES, EDGES } from '../data/charts.js';
import { PORTS, BERTHS, getPort, portView, portAccepts } from '../data/ports.js';
import { staticObstacles, SHOALS, UNDER_KEEL } from './world.js';
import { distanceToObstacle } from './shore.js';
import { seaEffect } from './weather.js';

const NARROW_CLEARANCE = 40; // m to the nearest hazard; below this a leg is a narrow passage
export const REFERENCE_SPEED = 6.8; // m/s, the speed route deadlines are written for (the skiff, with docking time)
export const DEADLINE_MARGIN = 30; // s added for harbor work and docking
const MAX_DETOUR = 1.35;

const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]));
export const getNode = (id) => nodeById[id] || null;

function legClearance(a, b, obstacles) {
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 5));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    for (const o of obstacles) best = Math.min(best, distanceToObstacle(x, z, o));
  }
  return best;
}

// Shallowest shoal a leg crosses (Infinity if none): deep-draft vessels cannot use legs shallower than they need.
function legShoalDepth(a, b) {
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 5));
  let depth = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    for (const sh of SHOALS) if (distanceToObstacle(x, z, sh) === 0) depth = Math.min(depth, sh.depth);
  }
  return depth;
}

// Adjacency: id -> [{ to, length, clearance, narrow, minDepth }]
const obstacles = staticObstacles();
export const LEGS = new Map();
const adjacency = new Map(NODES.map((n) => [n.id, []]));
for (const [a, b] of EDGES) {
  const A = nodeById[a], B = nodeById[b];
  const length = Math.hypot(A.x - B.x, A.z - B.z);
  const clearance = legClearance(A, B, obstacles);
  const narrow = clearance < NARROW_CLEARANCE;
  const minDepth = legShoalDepth(A, B);
  adjacency.get(a).push({ to: b, length, clearance, narrow, minDepth });
  adjacency.get(b).push({ to: a, length, clearance, narrow, minDepth });
  LEGS.set(`${a}-${b}`, { a, b, length, clearance, narrow, minDepth });
  LEGS.set(`${b}-${a}`, { a: b, b: a, length, clearance, narrow, minDepth });
}

export const neighbours = (id) => adjacency.get(id) || [];

// Can this vessel use a leg? The width between hazards must be several beams, and the water deep enough.
export function legPassable(leg, vessel) {
  if (!vessel) return true;
  if (leg.clearance * 2 < vessel.beam * 4) return false;
  return leg.minDepth === undefined || leg.minDepth === Infinity || vessel.draft + UNDER_KEEL <= leg.minDepth;
}

export function pathLength(path) {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += LEGS.get(`${path[i - 1]}-${path[i]}`).length;
  return sum;
}

// All simple paths between two markers (the chart is small), as arrays of ids, shortest first.
function simplePaths(from, to, vessel, maxLength) {
  const out = [];
  const walk = (id, path, len) => {
    if (len > maxLength) return;
    if (id === to) { out.push({ path: path.slice(), len }); return; }
    for (const e of adjacency.get(id)) {
      if (path.includes(e.to) || !legPassable(e, vessel)) continue;
      path.push(e.to);
      walk(e.to, path, len + e.length);
      path.pop();
    }
  };
  walk(from, [from], 0);
  return out.sort((a, b) => a.len - b.len);
}

function describeLegs(path) {
  const legs = [];
  for (let i = 1; i < path.length; i++) {
    const leg = LEGS.get(`${path[i - 1]}-${path[i]}`);
    legs.push({ from: path[i - 1], to: path[i], fromName: nodeById[path[i - 1]].name, toName: nodeById[path[i]].name, length: leg.length, clearance: leg.clearance, narrow: leg.narrow });
  }
  return legs;
}

// Build a route object from a path of marker ids between two ports.
export function routeFromPath(fromPortId, toPortId, path, vessel = null) {
  const from = portView(fromPortId, vessel), to = portView(toPortId, vessel);
  const legs = describeLegs(path);
  const seaLength = legs.reduce((a, l) => a + l.length, 0);
  // Whole trip: berth to the first marker, the charted legs, then the harbor approach to the berth.
  const first = nodeById[path[0]];
  const length = Math.hypot(first.x - from.start.x, first.z - from.start.z) + seaLength + approachLength(to, path[path.length - 1]);
  const narrow = legs.filter((l) => l.narrow);
  const hazards = narrow.map((l) => `Narrow passage between ${l.fromName} and ${l.toName}: about ${Math.round(l.clearance * 2)} m wide`);
  return {
    id: path.join('>'),
    from: fromPortId, to: toPortId, path, legs, length, seaLength, hazards, narrowCount: narrow.length,
    waypoints: routeWaypoints(from, to, path),
    deadline: routeDeadline(length),
    vesselId: vessel ? vessel.id : null,
  };
}

// Distance from a port's fairway marker through its inbound waypoints to the berth centre.
function approachLength(port, fairwayId) {
  const f = nodeById[fairwayId];
  const b = BERTHS[port.berth];
  let pts = [f, ...port.inbound, { x: b.cx, z: b.cz }];
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return sum;
}

function nodeWaypoint(n) {
  const w = { name: n.name, x: n.x, z: n.z, radius: n.radius || 30 };
  if (n.spread) w.spread = n.spread;
  return w;
}

export function routeWaypoints(from, to, path) {
  return [...path.map((id) => nodeWaypoint(nodeById[id])), ...to.inbound];
}

export const routeDeadline = (length) => Math.round((length / REFERENCE_SPEED + DEADLINE_MARGIN) / 5) * 5;

// Up to `max` distinct, sensible routes between two ports: the shortest plus real alternatives (no route
// more than 1.35x the shortest, none through another port, none that is nearly the same length and markers).
export function findRoutes(fromPortId, toPortId, { vessel = null, max = 3 } = {}) {
  if (!getPort(fromPortId) || !getPort(toPortId) || fromPortId === toPortId) return [];
  if (vessel && !(portAccepts(fromPortId, vessel) && portAccepts(toPortId, vessel))) return []; // a port that refuses the vessel has no route
  const from = portView(fromPortId, vessel), to = portView(toPortId, vessel);
  const all = simplePaths(from.fairway, to.fairway, vessel, Infinity);
  if (!all.length) return [];
  const best = all[0].len;
  const otherFairways = Object.values(PORTS).flatMap((p) => [p.fairway, p.deep && p.deep.fairway]).filter((f) => f && f !== from.fairway && f !== to.fairway);
  const picked = [];
  for (const cand of all) {
    if (cand.len > best * MAX_DETOUR) break;
    if (cand.path.some((n) => otherFairways.includes(n))) continue; // routes do not cut through another port
    // distinct enough: uses at least one different marker and is at least 4% longer or shorter than each pick
    const tooSimilar = picked.some((p) => (cand.path.filter((n) => !p.path.includes(n)).length + p.path.filter((n) => !cand.path.includes(n)).length < 1) || Math.abs(cand.len - p.len) < p.len * 0.04);
    if (tooSimilar) continue;
    picked.push(cand);
    if (picked.length >= max) break;
  }
  return picked.map((p, i) => {
    const r = routeFromPath(fromPortId, toPortId, p.path, vessel);
    r.name = i === 0 ? 'Shortest route' : `Alternative ${i}`;
    r.via = i === 0 ? '' : viaNames(p.path, picked[0].path);
    r.rank = i;
    return r;
  });
}

function viaNames(path, shortest) {
  const mine = path.filter((id) => !shortest.includes(id)).map((id) => nodeById[id].name);
  return mine.length ? `via ${mine.slice(0, 3).join(', ')}` : 'same markers, different order';
}

export function shortestRoute(fromPortId, toPortId, vessel = null) {
  const r = findRoutes(fromPortId, toPortId, { vessel, max: 1 });
  return r[0] || null;
}

// What the player can add next while building a route by hand: unvisited markers one leg away that the
// vessel can use. Once the path ends at the destination's fairway there is nothing to add.
export function nextMarkers(path, toPortId, vessel = null) {
  const to = portView(toPortId, vessel);
  const last = path[path.length - 1];
  if (last === to.fairway) return [];
  return neighbours(last).filter((e) => !path.includes(e.to) && legPassable(e, vessel)).map((e) => ({ id: e.to, name: nodeById[e.to].name, length: e.length, narrow: e.narrow }));
}

export function isComplete(path, toPortId, vessel = null) {
  return path[path.length - 1] === portView(toPortId, vessel).fairway;
}

// Validate a hand-built path: starts at the origin's fairway, every step is a real leg, simple, passable.
export function validatePath(fromPortId, toPortId, path, vessel = null) {
  const from = portView(fromPortId, vessel);
  const to = portView(toPortId, vessel);
  if (!path.length || path[0] !== from.fairway) return { ok: false, reason: `A route starts at ${nodeById[from.fairway].name}.` };
  if (new Set(path).size !== path.length) return { ok: false, reason: 'A route cannot visit the same marker twice.' };
  for (let i = 1; i < path.length; i++) {
    const leg = LEGS.get(`${path[i - 1]}-${path[i]}`);
    if (!leg) return { ok: false, reason: `${nodeById[path[i - 1]].name} and ${nodeById[path[i]].name} are not joined by a charted leg.` };
    if (!legPassable(leg, vessel)) return { ok: false, reason: `Too narrow for the ${vessel.name}: ${nodeById[path[i - 1]].name} to ${nodeById[path[i]].name}.` };
  }
  if (path[path.length - 1] !== to.fairway) return { ok: false, reason: `A route ends at ${nodeById[to.fairway].name}.` };
  return { ok: true, reason: '' };
}

// Rough time on the water for a vessel in the given weather (for the chart, not for scoring).
export function estimateSeconds(route, vessel, weather) {
  const sea = seaEffect(weather, vessel);
  const cruise = Math.max(1, vessel.maxSpeed * 0.6 * sea.speedFactor);
  return route.length / cruise + 20;
}

// A mission instance that sails the given route: same mission, new waypoints and a deadline for the length.
// The start pose and berth depend on the vessel (ships use the deep terminal), so they are set here too.
export function planMission(mission, route, vessel = null) {
  if (!mission.planned) return mission;
  const from = portView(mission.fromPort, vessel), to = portView(mission.toPort, vessel);
  return { ...mission, start: from.start, dock: to.berth, waypoints: route.waypoints, deadline: route.deadline, routeName: route.name, routeId: route.id, routeLength: route.length };
}

export { PORTS };
