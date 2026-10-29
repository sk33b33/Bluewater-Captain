import * as THREE from 'three';

const G = 9.81;
const MAX_WAVES = 4;
const EXTENT = 2600;

// Same wave sum as sim/waves.js, evaluated in the vertex shader (height + analytic normal).
const vert = /* glsl */ `
  uniform float uTime;
  uniform vec4 uWaves[4]; // dirX, dirZ, k, amp
  uniform float uOmega[4];
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float h = 0.0;
    float dhdx = 0.0;
    float dhdz = 0.0;
    for (int i = 0; i < 4; i++) {
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
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFoam;       // 0 = no foam (and no noise work), 1 = full
  uniform float uFoamLevel;  // crest height at which whitecaps start
  uniform sampler2D uShore;  // r = distance to land / uShoreMax
  uniform float uShoreExtent;
  uniform float uShoreMax;
  varying vec3 vWorld;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
    float crest = smoothstep(0.35, 0.8, vWorld.y);

    float sd = texture2D(uShore, (vWorld.xz + uShoreExtent * 0.5) / uShoreExtent).r * uShoreMax; // metres to land
    float shallow = 1.0 - smoothstep(0.0, 45.0, sd);

    vec3 base = mix(uDeep, uShallow, crest * 0.6 + 0.2);
    base = mix(base, uShallow * 1.1, shallow * 0.7);
    vec3 col = mix(base, uSky, clamp(fres * 0.85, 0.0, 1.0));
    vec3 refl = reflect(-view, n);
    float spec = pow(max(dot(refl, normalize(uSunDir)), 0.0), 40.0);
    col += vec3(1.0, 0.95, 0.8) * spec * 0.12 * (0.3 + fres);
    float diff = max(dot(n, normalize(uSunDir)), 0.0);
    col *= 0.75 + 0.35 * diff;

    if (uFoam > 0.0) {
      float nz = noise(vWorld.xz * 0.35 + vec2(uTime * 0.12, -uTime * 0.08)) * 0.65 + noise(vWorld.xz * 1.1 - uTime * 0.2) * 0.35;
      float whitecap = smoothstep(uFoamLevel, uFoamLevel + 0.25, vWorld.y + (nz - 0.5) * 0.3);
      float edge = 5.0 + 2.0 * sin(uTime * 0.8 + vWorld.x * 0.1);
      float shoreFoam = (1.0 - smoothstep(1.5, edge, sd)) * smoothstep(0.25, 0.75, nz);
      float foam = clamp(whitecap * 0.8 + shoreFoam, 0.0, 1.0) * uFoam;
      col = mix(col, vec3(0.93, 0.96, 0.98), foam * 0.85);
    }

    float d = length(vWorld - cameraPosition);
    float f = smoothstep(uFogNear, uFogFar, d);
    gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  }
`;

// The shore texture is baked once (see render/shore.js) and shared across rebuilds.
export function createWater(sky, quality, shoreTexture) {
  const geo = new THREE.PlaneGeometry(EXTENT, EXTENT, quality.grid, quality.grid);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uWaves: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector4(1, 0, 0.1, 0)) },
      uOmega: { value: new Array(MAX_WAVES).fill(0) },
      uSunDir: { value: sky.sunDir },
      uDeep: { value: new THREE.Color(0x0f4a70) },
      uShallow: { value: new THREE.Color(0x3aa0b4) },
      uSky: { value: new THREE.Color(0x9cc8e8) },
      uFogColor: { value: sky.fogColor },
      uFogNear: { value: 300 },
      uFogFar: { value: 1450 },
      uFoam: { value: quality.foam },
      uFoamLevel: { value: 0.3 },
      uShore: { value: shoreTexture },
      uShoreExtent: { value: EXTENT },
      uShoreMax: { value: 80 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // Far water so the horizon never shows an edge: flat plane in fog colour, well below the wave troughs.
  const far = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: sky.fogColor.clone(), fog: false })
  );
  far.position.y = -6;
  const group = new THREE.Group();
  group.add(far, mesh);

  const u = mat.uniforms;
  group.userData.update = (t) => { u.uTime.value = t; };
  // waves: array from sim/waves.js (up to 4); extra slots are silenced.
  group.userData.setWaves = (waves) => {
    for (let i = 0; i < MAX_WAVES; i++) {
      const w = waves[i];
      if (!w) { u.uWaves.value[i].set(1, 0, 0.1, 0); u.uOmega.value[i] = 0; continue; }
      const k = (2 * Math.PI) / w.length;
      u.uWaves.value[i].set(Math.cos(w.dir), Math.sin(w.dir), k, w.amp);
      u.uOmega.value[i] = Math.sqrt(G * k) * w.speed;
    }
  };
  group.userData.setFoam = (f) => { u.uFoam.value = f; };
  group.userData.setLook = ({ foamLevel, fogNear, fogFar, skyColor }) => {
    u.uFoamLevel.value = foamLevel;
    u.uFogNear.value = fogNear;
    u.uFogFar.value = fogFar;
    u.uSky.value.copy(skyColor);
    far.material.color.copy(sky.fogColor);
  };
  group.userData.dispose = () => { geo.dispose(); mat.dispose(); far.geometry.dispose(); far.material.dispose(); };
  return group;
}
