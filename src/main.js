import * as THREE from 'three';
import { SMALL_MOTORBOAT as P, createVesselState, stepVessel, speedKnots, headingDegrees } from './sim/vessel.js';
import { ROUTE, SPAWN, BUOY_RADIUS, staticObstacles, resolveCollisions, edgeStatus } from './sim/world.js';
import { createRouteState, updateRoute, respawnPoint, formatTime } from './sim/route.js';
import { createSky } from './render/sky.js';
import { createWater } from './render/water.js';
import { buildStatic, buildBoat, buildBuoys, updateBuoys, poseBoat, addLights } from './render/scene.js';
import { createInput } from './input.js';
import { createHud } from './ui/hud.js';

const STEP = 1 / 60;
const settings = loadSettings();

// ---- renderer / scene
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 60000);
const scene = new THREE.Scene();
const sky = createSky();
scene.add(sky.mesh);
scene.fog = new THREE.Fog(sky.fogColor, 600, 3000);
addLights(scene, sky.sunDir);
const water = createWater(sky);
scene.add(water);
scene.add(buildStatic());
const buoys = buildBuoys();
scene.add(buoys.group);
const boat = buildBoat();
scene.add(boat);

function applyQuality() {
  const ratio = settings.lowGraphics ? 0.75 : Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', applyQuality);
applyQuality();

// ---- game state
const input = createInput();
const hud = createHud();
const obstacles = staticObstacles();
// Buoys are small solid obstacles too.
for (const g of buoys.gates) for (const p of g.positions) obstacles.push({ type: 'circle', name: 'Buoy', cx: p.x, cz: p.z, r: BUOY_RADIUS });

const vessel = createVesselState(SPAWN.x, SPAWN.z, SPAWN.heading);
let route = createRouteState();
let mode = 'menu'; // menu | play | finished
let hits = 0;
let stuckTime = 0;
let time = 0;
let acc = 0;
let last = performance.now();
let camHeading = SPAWN.heading;
let camOffset = 0;
let camPitch = 0.28;
let dragging = false;
let idleSince = 0;

function placeVessel(p) {
  vessel.x = p.x; vessel.z = p.z; vessel.heading = p.heading;
  vessel.u = vessel.v = vessel.r = vessel.throttle = vessel.rudder = 0;
  camHeading = p.heading;
  camOffset = 0;
  stuckTime = 0;
}

function resetRun() {
  route = createRouteState();
  hits = 0;
  placeVessel(SPAWN);
}

function respawn(reason) {
  placeVessel(respawnPoint(route, ROUTE, SPAWN));
  hud.warn(reason, 2000);
}

function startPlaying() {
  hud.showStart(false);
  hud.hideResult();
  input.clearPressed();
  mode = 'play';
}

document.getElementById('start-btn').addEventListener('click', startPlaying);
document.getElementById('again-btn').addEventListener('click', () => { resetRun(); startPlaying(); });

// ---- camera drag + settings UI
canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; idleSince = performance.now(); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const k = 0.005 * settings.sensitivity;
  camOffset -= e.movementX * k;
  camPitch = Math.max(0.05, Math.min(1.0, camPitch + e.movementY * k));
});

const sens = document.getElementById('set-sens');
const low = document.getElementById('set-low');
const calm = document.getElementById('set-calm');
sens.value = String(settings.sensitivity);
low.checked = settings.lowGraphics;
calm.checked = settings.reducedMotion;
sens.addEventListener('input', () => { settings.sensitivity = parseFloat(sens.value); saveSettings(); });
low.addEventListener('change', () => { settings.lowGraphics = low.checked; saveSettings(); applyQuality(); });
calm.addEventListener('change', () => { settings.reducedMotion = calm.checked; saveSettings(); });
document.getElementById('settings-btn').addEventListener('click', () => document.getElementById('settings').classList.toggle('hidden'));

function loadSettings() {
  const d = { sensitivity: 1, lowGraphics: false, reducedMotion: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem('bwc-settings') || '{}') }; } catch { return d; }
}
function saveSettings() { try { localStorage.setItem('bwc-settings', JSON.stringify(settings)); } catch { /* storage unavailable */ } }

// ---- simulation tick
function tick(dt) {
  time += dt;
  if (mode !== 'play') return;
  const inp = input.read();
  stepVessel(vessel, inp, P, dt);
  const col = resolveCollisions(vessel, P, obstacles);
  if (col.hit) {
    if (col.impact > 1.5) { hits += 1; hud.warn(`Collision: ${col.name || 'obstacle'}`, 1500); }
    stuckTime += dt;
    if (stuckTime > 4) respawn('Grounded: returned to last safe point');
  } else {
    stuckTime = 0;
  }
  const edge = edgeStatus(vessel);
  if (edge === 'warn') hud.warn('Leaving the chart area: turn back', 600);
  if (edge === 'out') respawn('Out of bounds: returned to last safe point');

  const reached = updateRoute(route, ROUTE, vessel, dt);
  if (reached >= 0 && !route.finished) hud.warn(`Checkpoint: ${ROUTE[reached].name}`, 1500);
  if (route.finished) {
    mode = 'finished';
    hud.showResult(route.time, hits);
  }
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }

  const inp = input.read();
  if (input.wasPressed('KeyR') || inp.padRespawn) { if (mode === 'play') respawn('Respawned at last safe point'); }
  if (input.wasPressed('Escape')) document.getElementById('settings').classList.add('hidden');
  if ((input.wasPressed('Enter') || input.wasPressed('Space'))) {
    if (mode === 'menu') startPlaying();
    else if (mode === 'finished') { resetRun(); startPlaying(); }
  }

  // visuals
  water.userData.update(time);
  poseBoat(boat, vessel, time);
  const active = route.finished ? -1 : route.next;
  updateBuoys(buoys, time, active);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

function updateCamera(dt) {
  const lag = settings.reducedMotion ? 6 : 2.5;
  camHeading += angleDiff(vessel.heading, camHeading) * Math.min(1, dt * lag);
  if (!dragging && performance.now() - idleSince > 2000) camOffset *= Math.max(0, 1 - dt * 1.5);
  const yaw = camHeading + camOffset;
  const dist = 16;
  const bx = vessel.x, bz = vessel.z;
  const hy = boat.position.y;
  camera.position.set(bx - Math.sin(yaw) * dist * Math.cos(camPitch), hy + 2 + dist * Math.sin(camPitch) + 2.5, bz + Math.cos(yaw) * dist * Math.cos(camPitch));
  camera.lookAt(bx, hy + 1.5, bz);
  const targetFov = settings.reducedMotion ? 60 : 60 + Math.min(10, Math.abs(vessel.u) * 0.7);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 2);
  camera.updateProjectionMatrix();
}

function updateHud() {
  const cp = ROUTE[Math.min(route.next, ROUTE.length - 1)];
  const dx = cp.x - vessel.x, dz = cp.z - vessel.z;
  const dist = Math.hypot(dx, dz);
  const bearing = Math.atan2(dx, -dz);
  const rel = (angleDiff(bearing, vessel.heading) * 180) / Math.PI;
  const objective = route.finished
    ? 'Route complete'
    : `${route.next + 1}/${ROUTE.length}  ${cp.name}  ${Math.round(dist)} m`;
  hud.update({
    knots: speedKnots(vessel),
    heading: headingDegrees(vessel),
    throttle: vessel.throttle,
    objective,
    timer: route.started ? formatTime(route.time) : '--:--',
    bearingRel: rel,
  });
}

// Test/debug hook: read-only view of state; used by the headless smoke test.
window.__bwc = { vessel, get mode() { return mode; }, get route() { return route; }, get hits() { return hits; }, ROUTE };

hud.showStart(true);
requestAnimationFrame(frame);
