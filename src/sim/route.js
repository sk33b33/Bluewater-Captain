// Route progress: sequential checkpoints, timer starts at the first one.
export function createRouteState() {
  return { next: 0, started: false, finished: false, time: 0, lastSafe: null, splits: [] };
}

// Returns the checkpoint index just reached, or -1.
export function updateRoute(rt, route, pos, dt) {
  if (rt.finished) return -1;
  if (rt.started) rt.time += dt;
  const cp = route[rt.next];
  if (!cp) return -1;
  if (Math.hypot(pos.x - cp.x, pos.z - cp.z) > cp.radius) return -1;
  const reached = rt.next;
  if (reached === 0) rt.started = true;
  rt.splits.push(rt.time);
  rt.lastSafe = { x: cp.x, z: cp.z };
  rt.next += 1;
  if (rt.next >= route.length) rt.finished = true;
  return reached;
}

// Where to respawn and which way to face: last passed checkpoint, else spawn.
export function respawnPoint(rt, route, spawn) {
  if (!rt.lastSafe) return { x: spawn.x, z: spawn.z, heading: spawn.heading };
  const target = route[Math.min(rt.next, route.length - 1)];
  const heading = Math.atan2(target.x - rt.lastSafe.x, -(target.z - rt.lastSafe.z));
  return { x: rt.lastSafe.x, z: rt.lastSafe.z, heading: (heading + 2 * Math.PI) % (2 * Math.PI) };
}

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
