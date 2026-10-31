// The world: Bluewater Bay, a bounded 4 km x 4 km region (2 x 2 cells of 2 km) with four ports.
// Coordinates in metres. x east, z south. Cell (0,0) spans -1000..1000 on both axes.
// The whole region is loaded at once: at this size streaming is not needed (see docs/TECHNICAL_DESIGN.md).
export const REGION = { minX: -1000, maxX: 3000, minZ: -1000, maxZ: 3000 };
export const EDGE_WARN = 60; // warn this close to the region edge
export const EDGE_OUT = 12; // auto-return this far beyond it

export const LAND = [
  { type: 'rect', name: 'West coast', cx: -1050, cz: 750, hx: 250, hz: 1950 },
  { type: 'rect', name: 'East coast', cx: 3000, cz: 1000, hx: 300, hz: 2300 },
  { type: 'rect', name: 'South coast', cx: 1000, cz: 3000, hx: 2400, hz: 300 },
  { type: 'rect', name: 'Long Spit', cx: 1800, cz: 2300, hx: 25, hz: 400 },
];
export const BREAKWATERS = [
  { type: 'rect', name: 'Breakwater north', cx: -640, cz: -100, hx: 6, hz: 100 },
  { type: 'rect', name: 'Breakwater south', cx: -640, cz: 200, hx: 6, hz: 100 },
];
export const DOCKS = [
  { type: 'rect', name: 'Main pier', cx: -740, cz: 150, hx: 50, hz: 5 },
  { type: 'rect', name: 'Pine Isle pier', cx: 385, cz: 250, hx: 25, hz: 3 },
  { type: 'rect', name: 'Cape Quay pier', cx: 2650, cz: 300, hx: 50, hz: 5 },
  { type: 'rect', name: 'Marina pier', cx: 400, cz: 2650, hx: 5, hz: 50 },
  { type: 'rect', name: 'Cape Terminal quay', cx: 2570, cz: 520, hx: 130, hz: 8 },
  { type: 'rect', name: 'Driftwood quay', cx: 2300, cz: 2480, hx: 8, hz: 220 },
];
export const ISLANDS = [
  { type: 'circle', name: 'Gull Rock', cx: 200, cz: -300, r: 60 },
  { type: 'circle', name: 'Pine Isle', cx: 500, cz: 250, r: 90 },
  { type: 'circle', name: 'Skerry', cx: -100, cz: -500, r: 40 },
  { type: 'circle', name: 'Seal Rock', cx: 1500, cz: 60, r: 30 },
  { type: 'circle', name: 'Seal Rock south', cx: 1500, cz: 145, r: 25 },
  { type: 'circle', name: 'Anvil Reef', cx: 1100, cz: 1300, r: 120 },
  { type: 'circle', name: 'Tern Island', cx: 2200, cz: 1500, r: 70 },
];

// Shoals: shallow water only deep-draft vessels cannot cross. A vessel is blocked when its draft plus
// UNDER_KEEL (clearance it needs) exceeds the shoal depth. Small boats sail over them freely.
export const UNDER_KEEL = 1.0;
export const SHOALS = [
  { type: 'rect', name: 'Cape north shoal', cx: 2200, cz: 200, hx: 520, hz: 220, depth: 4.5 },
  { type: 'rect', name: 'Cape south shoal', cx: 2200, cz: 760, hx: 520, hz: 200, depth: 4.5 },
  { type: 'circle', name: 'Anvil shoal', cx: 1100, cz: 1300, r: 190, depth: 4.5 },
  { type: 'circle', name: 'Tern shoal', cx: 2200, cz: 1500, r: 100, depth: 4.5 },
  { type: 'rect', name: 'Driftwood east shoal', cx: 2600, cz: 2300, hx: 110, hz: 400, depth: 4.5 },
];

export const blocksVessel = (shoal, vessel) => vessel.draft + UNDER_KEEL > shoal.depth;
export const shoalsFor = (vessel) => SHOALS.filter((sh) => blocksVessel(sh, vessel));

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

// The hull is a row of overlapping circles sized from the vessel's beam (hullRadius) and spread along its
// length, so even a 140 m ship has no gaps. Short boats get three circles. Returns array of {x, z, r}.
export function hullCircleCount(p) {
  const reach = Math.max(0, p.length / 2 - p.hullRadius);
  return Math.max(3, Math.ceil(reach / (p.hullRadius * 0.75)) * 2 + 1);
}

export function hullCircles(s, p) {
  const sin = Math.sin(s.heading);
  const cos = Math.cos(s.heading);
  const reach = Math.max(0, p.length / 2 - p.hullRadius);
  const n = hullCircleCount(p);
  const out = [];
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : reach - (2 * reach * i) / (n - 1);
    out.push({ x: s.x + sin * off, z: s.z - cos * off, r: p.hullRadius });
  }
  return out;
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

// 'ok' | 'warn' (near the region edge) | 'out' (past it: returned to the last safe point)
export function edgeStatus(s) {
  const out = Math.max(REGION.minX - s.x, s.x - REGION.maxX, REGION.minZ - s.z, s.z - REGION.maxZ);
  if (out > EDGE_OUT) return 'out';
  if (out > -EDGE_WARN) return 'warn';
  return 'ok';
}
