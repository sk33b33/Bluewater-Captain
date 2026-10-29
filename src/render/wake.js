import * as THREE from 'three';
import { WAKE_LIFETIME } from '../sim/wake.js';
import { getWaterHeight } from '../sim/waves.js';

// Draws the foam particles from sim/wake.js as soft white discs lying on the water.
export function createWakeMesh(capacity) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(capacity * 3);
  const age = new Float32Array(capacity).fill(WAKE_LIFETIME);
  const size = new Float32Array(capacity);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAge', new THREE.BufferAttribute(age, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uPx: { value: 600 }, uLife: { value: WAKE_LIFETIME } },
    vertexShader: `
      attribute float aAge; attribute float aSize; uniform float uPx; uniform float uLife; varying float vFade;
      void main() {
        vFade = clamp(1.0 - aAge / uLife, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aAge >= uLife ? 0.0 : aSize * uPx / max(1.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vFade;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(0.95, 0.98, 1.0, (1.0 - r * r) * vFade * 0.5);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.userData.sync = (wake, t, waves, camera, drawingBufferHeight) => {
    for (let i = 0; i < capacity; i++) {
      pos[i * 3] = wake.x[i];
      pos[i * 3 + 1] = getWaterHeight(wake.x[i], wake.z[i], t, waves) + 0.08;
      pos[i * 3 + 2] = wake.z[i];
      age[i] = wake.age[i];
      size[i] = wake.size[i];
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAge.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    mat.uniforms.uPx.value = drawingBufferHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
  };
  points.userData.dispose = () => { geo.dispose(); mat.dispose(); };
  return points;
}
