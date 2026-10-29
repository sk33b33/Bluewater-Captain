// Distance from a point to the nearest land, pier or breakwater (0 inside). Drives shallow-water tint and
// shoreline foam. Pure so it can be tested; the renderer bakes it into a small texture once.
export function distanceToObstacle(x, z, o) {
  if (o.type === 'circle') return Math.max(0, Math.hypot(x - o.cx, z - o.cz) - o.r);
  const dx = Math.max(Math.abs(x - o.cx) - o.hx, 0);
  const dz = Math.max(Math.abs(z - o.cz) - o.hz, 0);
  return Math.hypot(dx, dz);
}

export function distanceToShore(x, z, obstacles) {
  let d = Infinity;
  for (const o of obstacles) d = Math.min(d, distanceToObstacle(x, z, o));
  return d;
}

// Grid of distances clamped to maxDist, as bytes 0..255 (RGBA). Row j covers z, column i covers x, over the
// square [originX, originX + extent] x [originZ, originZ + extent]. Each obstacle only touches the texels within
// maxDist of it, so baking a 4 km region is cheap.
export function bakeShore(obstacles, { originX = -1300, originZ = -1300, extent = 2600, size = 512, maxDist = 80 } = {}) {
  const data = new Uint8Array(size * size * 4).fill(255);
  const cell = extent / size;
  const box = (o) => (o.type === 'circle' ? [o.cx - o.r, o.cz - o.r, o.cx + o.r, o.cz + o.r] : [o.cx - o.hx, o.cz - o.hz, o.cx + o.hx, o.cz + o.hz]);
  for (const o of obstacles) {
    const [x0, z0, x1, z1] = box(o);
    const i0 = Math.max(0, Math.floor((x0 - maxDist - originX) / cell));
    const i1 = Math.min(size - 1, Math.ceil((x1 + maxDist - originX) / cell));
    const j0 = Math.max(0, Math.floor((z0 - maxDist - originZ) / cell));
    const j1 = Math.min(size - 1, Math.ceil((z1 + maxDist - originZ) / cell));
    for (let j = j0; j <= j1; j++) {
      const z = originZ + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const x = originX + (i + 0.5) * cell;
        const v = Math.round((Math.min(maxDist, distanceToObstacle(x, z, o)) / maxDist) * 255);
        const k = (j * size + i) * 4;
        if (v < data[k]) { data[k] = v; data[k + 1] = v; data[k + 2] = v; }
      }
    }
  }
  return { data, size, originX, originZ, extent, maxDist };
}
