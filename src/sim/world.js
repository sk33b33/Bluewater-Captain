// Stage 1 world: one 2 km sea cell ("box world" cell), one simple harbor, and obstacles.
// Coordinates in metres. x east, z south, cell spans -1000..1000 on both axes.
export const CELL_HALF = 1000;
export const SOFT_LIMIT = 950; // warn past this
export const HARD_LIMIT = 1010; // auto-return past this

export const LAND = [
  { type: 'rect', name: 'West coast', cx: -1050, cz: 0, hx: 250, hz: 1200 },
];
export const BREAKWATERS = [
  { type: 'rect', name: 'Breakwater north', cx: -640, cz: -100, hx: 6, hz: 100 },
  { type: 'rect', name: 'Breakwater south', cx: -640, cz: 200, hx: 6, hz: 100 },
];
export const DOCKS = [
  { type: 'rect', name: 'Main pier', cx: -740, cz: 150, hx: 50, hz: 5 },
  { type: 'rect', name: 'Pine Isle pier', cx: 385, cz: 250, hx: 25, hz: 3 },
];
export const ISLANDS = [
  { type: 'circle', name: 'Gull Rock', cx: 200, cz: -300, r: 60 },
  { type: 'circle', name: 'Pine Isle', cx: 500, cz: 250, r: 90 },
  { type: 'circle', name: 'Skerry', cx: -100, cz: -500, r: 40 },
];

// Route checkpoints; first is the harbor exit gate, last is the finish.
export const ROUTE = [
  { name: 'Harbor exit', x: -600, z: 50, radius: 30 },
  { name: 'Channel buoy', x: -200, z: -150, radius: 30 },
  { name: 'North passage', x: 300, z: -500, radius: 30 },
  { name: 'East turn', x: 550, z: -100, radius: 30 },
  { name: 'Finish', x: 650, z: 380, radius: 30 },
];
export const SPAWN = { x: -720, z: 50, heading: Math.PI / 2 }; // inside the harbor, facing east

export const BUOY_RADIUS = 1.2;

export function staticObstacles() {
  return [...LAND, ...BREAKWATERS, ...DOCKS, ...ISLANDS];
}

// Two circles (bow, stern) approximate the hull. Returns array of {x, z, r}.
export function hullCircles(s, p) {
  const sin = Math.sin(s.heading);
  const cos = Math.cos(s.heading);
  const off = p.length * 0.3;
  return [
    { x: s.x + sin * off, z: s.z - cos * off, r: p.hullRadius },
    { x: s.x - sin * off, z: s.z + cos * off, r: p.hullRadius },
  ];
}

// Push circle out of obstacle. Returns { nx, nz, depth } or null.
export function circleVsObstacle(c, o) {
  if (o.type === 'circle') {
    const dx = c.x - o.cx;
    const dz = c.z - o.cz;
    const d = Math.hypot(dx, dz);
    const min = c.r + o.r;
    if (d >= min) return null;
    if (d < 1e-6) return { nx: 0, nz: -1, depth: min };
    return { nx: dx / d, nz: dz / d, depth: min - d };
  }
  const px = Math.max(o.cx - o.hx, Math.min(c.x, o.cx + o.hx));
  const pz = Math.max(o.cz - o.hz, Math.min(c.z, o.cz + o.hz));
  const dx = c.x - px;
  const dz = c.z - pz;
  const d = Math.hypot(dx, dz);
  if (d >= c.r) return null;
  if (d > 1e-6) return { nx: dx / d, nz: dz / d, depth: c.r - d };
  // Centre inside the rect: exit along the shallowest axis.
  const ex = o.hx - Math.abs(c.x - o.cx);
  const ez = o.hz - Math.abs(c.z - o.cz);
  if (ex < ez) return { nx: Math.sign(c.x - o.cx) || 1, nz: 0, depth: ex + c.r };
  return { nx: 0, nz: Math.sign(c.z - o.cz) || 1, depth: ez + c.r };
}

// Resolves collisions in place: moves the vessel out and removes the speed into the surface.
// Returns { hit: bool, impact: m/s of speed lost, name } for HUD/feedback.
export function resolveCollisions(s, p, obstacles) {
  let hit = false;
  let impact = 0;
  let name = '';
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (const c of hullCircles(s, p)) {
      for (const o of obstacles) {
        const col = circleVsObstacle(c, o);
        if (!col) continue;
        any = true;
        hit = true;
        name = o.name || name;
        s.x += col.nx * col.depth;
        s.z += col.nz * col.depth;
        c.x += col.nx * col.depth;
        c.z += col.nz * col.depth;
        // World velocity -> remove inward component.
        const sin = Math.sin(s.heading);
        const cos = Math.cos(s.heading);
        const vx = s.u * sin + s.v * cos;
        const vz = -s.u * cos + s.v * sin;
        const into = -(vx * col.nx + vz * col.nz);
        if (into > 0) {
          impact = Math.max(impact, into);
          const nvx = vx + col.nx * into * 1.3; // slight bounce
          const nvz = vz + col.nz * into * 1.3;
          s.u = nvx * sin - nvz * cos;
          s.v = nvx * cos + nvz * sin;
        }
      }
    }
    if (!any) break;
  }
  return { hit, impact, name };
}

// 'ok' | 'warn' (near edge) | 'out' (past hard limit)
export function edgeStatus(s) {
  const m = Math.max(Math.abs(s.x), Math.abs(s.z));
  if (m > HARD_LIMIT) return 'out';
  if (m > SOFT_LIMIT) return 'warn';
  return 'ok';
}
