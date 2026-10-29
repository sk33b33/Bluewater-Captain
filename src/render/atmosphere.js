import * as THREE from 'three';
import { waveSet } from '../sim/waves.js';

const CLEAR_TOP = new THREE.Color(0x2f78c4);
const GREY_TOP = new THREE.Color(0x626d79);
const CLEAR_HORIZON = new THREE.Color(0xbcd8ea);
const GREY_HORIZON = new THREE.Color(0x9ea8b0);
const FOG_WHITE = new THREE.Color(0xc9cfd2);
const tmp = new THREE.Color();

// Apply a weather preset to the look of the world: sky, fog (visibility), light and water colour.
// Fog near/far follow visibility; the water fades out before its mesh edge so there is never a visible seam.
export function applyAtmosphere({ scene, sky, water, hemi, sun }, w) {
  const cloud = w.cloud;
  sky.mesh.material.uniforms.uTop.value.copy(CLEAR_TOP).lerp(GREY_TOP, cloud);
  sky.fogColor.copy(CLEAR_HORIZON).lerp(GREY_HORIZON, cloud);
  const murk = Math.max(0, 1 - w.visibility / 1500); // fog banks wash the horizon toward white
  sky.fogColor.lerp(FOG_WHITE, murk);
  const far = w.visibility;
  scene.fog.near = far * 0.1;
  scene.fog.far = far;
  hemi.intensity = 0.9 - 0.35 * cloud;
  sun.intensity = 1.6 - 1.2 * cloud;
  const skyColor = tmp.copy(sky.fogColor).lerp(new THREE.Color(0x7aa6c8), 0.25 * (1 - cloud));
  water.userData.setLook({
    foamLevel: 0.5 * w.waveHs + 0.15,
    fogNear: Math.min(far * 0.12, 300),
    fogFar: Math.min(far, 1450),
    skyColor,
  });
}

export { waveSet };
