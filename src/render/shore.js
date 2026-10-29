import * as THREE from 'three';
import { bakeShore } from '../sim/shore.js';

// Bake distance-to-land into a small texture once. The water shader reads it for shallow tint and shore foam.
export function makeShoreTexture(obstacles) {
  const { data, size } = bakeShore(obstacles, { size: 512 });
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
