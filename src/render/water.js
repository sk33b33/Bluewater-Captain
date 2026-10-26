import * as THREE from 'three';
import { WAVES } from '../sim/waves.js';

const G = 9.81;

// Same wave sum as sim/waves.js, evaluated in the vertex shader (height + analytic normal).
const vert = /* glsl */ `
  uniform float uTime;
  uniform vec4 uWaves[3]; // dirX, dirZ, k, amp
  uniform float uOmega[3];
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float h = 0.0;
    float dhdx = 0.0;
    float dhdz = 0.0;
    for (int i = 0; i < 3; i++) {
      float phase = uWaves[i].z * (uWaves[i].x * wp.x + uWaves[i].y * wp.z) - uOmega[i] * uTime;
      h += uWaves[i].w * sin(phase);
      float c = uWaves[i].w * uWaves[i].z * cos(phase);
      dhdx += c * uWaves[i].x;
      dhdz += c * uWaves[i].y;
    }
    wp.y += h;
    vWorld = wp.xyz;
    vNormal = normalize(vec3(-dhdx, 1.0, -dhdz));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
    float crest = smoothstep(0.35, 0.8, vWorld.y);
    vec3 base = mix(uDeep, uShallow, crest * 0.6 + 0.2);
    vec3 col = mix(base, uSky, clamp(fres * 0.85, 0.0, 1.0));
    vec3 refl = reflect(-view, n);
    float spec = pow(max(dot(refl, normalize(uSunDir)), 0.0), 40.0);
    col += vec3(1.0, 0.95, 0.8) * spec * 0.12 * (0.3 + fres);
    float diff = max(dot(n, normalize(uSunDir)), 0.0);
    col *= 0.75 + 0.35 * diff;
    float d = length(vWorld - cameraPosition);
    float f = smoothstep(uFogNear, uFogFar, d);
    gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  }
`;

export function createWater(sky) {
  const geo = new THREE.PlaneGeometry(2600, 2600, 360, 360);
  geo.rotateX(-Math.PI / 2);
  const waves = WAVES.map((w) => new THREE.Vector4(Math.cos(w.dir), Math.sin(w.dir), (2 * Math.PI) / w.length, w.amp));
  const omega = WAVES.map((w) => Math.sqrt(G * ((2 * Math.PI) / w.length)) * w.speed);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uWaves: { value: waves },
      uOmega: { value: omega },
      uSunDir: { value: sky.sunDir },
      uDeep: { value: new THREE.Color(0x0f4a70) },
      uShallow: { value: new THREE.Color(0x3aa0b4) },
      uSky: { value: new THREE.Color(0x9cc8e8) },
      uFogColor: { value: sky.fogColor },
      uFogNear: { value: 400 },
      uFogFar: { value: 2600 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // Far water so the horizon never shows an edge: flat plane in fog colour.
  const far = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: sky.fogColor })
  );
  far.position.y = -0.8;
  const group = new THREE.Group();
  group.add(far, mesh);
  group.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return group;
}
