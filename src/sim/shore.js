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

// Grid of distances clamped to maxDist, as bytes 0..255. Row j covers z, column i covers x.
export function bakeShore(obstacles, { extent = 2600, size = 512, maxDist = 80 } = {}) {
  const data = new Uint8Array(size * size * 4);
  const half = extent / 2;
  for (let j = 0; j < size; j++) {
    const z = -half + ((j + 0.5) / size) * extent;
    for (let i = 0; i < size; i++) {
      const x = -half + ((i + 0.5) / size) * extent;
      const v = Math.round((Math.min(maxDist, distanceToShore(x, z, obstacles)) / maxDist) * 255);
      const k = (j * size + i) * 4;
      data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
    }
  }
  return { data, size, extent, maxDist };
}
