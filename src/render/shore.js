import * as THREE from 'three';
import { bakeShore } from '../sim/shore.js';
import { REGION, SHOALS } from '../sim/world.js';

// The texture covers the whole region plus a margin of open water.
const MARGIN = 300;
export const SHORE_AREA = { originX: REGION.minX - MARGIN, originZ: REGION.minZ - MARGIN, extent: REGION.maxX - REGION.minX + 2 * MARGIN };

// Bake distance-to-land into a small texture once. The water shader reads it for shallow tint and shore foam.
export function makeShoreTexture(obstacles) {
  const { data, size } = bakeShore(obstacles, { ...SHORE_AREA, size: 1024 }, SHOALS);
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
