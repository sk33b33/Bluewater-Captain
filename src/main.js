import * as THREE from 'three';
import { SMALL_MOTORBOAT as P, createVesselState, stepVessel, speedKnots, headingDegrees } from './sim/vessel.js';
import { BUOY_RADIUS, staticObstacles, resolveCollisions, edgeStatus } from './sim/world.js';
import { MISSIONS, BERTHS, getMission } from './data/missions.js';
import { LICENSES, getLicense } from './data/licenses.js';
import { SMALL_CRAFT_QUESTIONS } from './data/quiz.js';
import { createRun, stepRun, applyImpact, registerRespawn, abortRun, respawnPose, scoreRun, evaluateDock, DOCK } from './sim/mission.js';
import { loadProfile, saveProfile, recordResult, clearProfile, safeStorage } from './sim/profile.js';
import { formatTime } from './sim/route.js';
import { pickQuestions, scoreQuiz } from './sim/quiz.js';
import { evaluateLicense, missionAccess, isHeld, examFor, startExam, judgeExam, applyExamOutcome, recordWritten, coachingTips } from './sim/licenses.js';
import { createSky } from './render/sky.js';
import { createWater } from './render/water.js';
import { buildStatic, buildBoat, buildBuoys, buildBerth, disposeObject, updateBuoys, poseBoat, addLights } from './render/scene.js';
import { createInput } from './input.js';
import { createHud } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { setupTouchControls } from './ui/touch.js';

const STEP = 1 / 60;
const settings = loadSettings();
const storage = safeStorage();
let profile = loadProfile(storage);

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
const touchUi = setupTouchControls(input);
const baseObstacles = staticObstacles();

const vessel = createVesselState(MISSIONS[0].start.x, MISSIONS[0].start.z, MISSIONS[0].start.heading);
let mode = 'menu'; // menu | board | briefing | licenses | quiz | play | paused | settings | result
const QUIZ_POOLS = { 'small-craft-permit': SMALL_CRAFT_QUESTIONS };
let quizLic = null;
let quizQuestions = [];
let mission = null;
let run = null;
let buoys = null;
let berthGroup = null;
let obstacles = baseObstacles;
let selected = null;
let stuckTime = 0;
let time = 0;
let acc = 0;
let last = performance.now();
let camHeading = vessel.heading;
let camOffset = 0;
let camPitch = 0.28;
let dragging = false;
let idleSince = 0;
let settingsReturn = 'menu';

function setPlaying(v) { document.body.classList.toggle('playing', v); }

function placeVessel(p) {
  vessel.x = p.x; vessel.z = p.z; vessel.heading = p.heading;
  vessel.u = vessel.v = vessel.r = vessel.throttle = vessel.rudder = 0;
  camHeading = p.heading;
  camOffset = 0;
  stuckTime = 0;
  if (touchUi) touchUi.reset();
}

function clearMission() {
  if (buoys) { scene.remove(buoys.group); disposeObject(buoys.group); buoys = null; }
  if (berthGroup) { scene.remove(berthGroup); disposeObject(berthGroup); berthGroup = null; }
  obstacles = baseObstacles;
  run = null;
}

function startMission(m) {
  clearMission();
  mission = m;
  run = createRun(m);
  buoys = buildBuoys(m.waypoints, m.start);
  scene.add(buoys.group);
  obstacles = [...baseObstacles];
  for (const g of buoys.gates) for (const p of g.positions) obstacles.push({ type: 'circle', name: 'Buoy', cx: p.x, cz: p.z, r: BUOY_RADIUS });
  if (m.dock) { berthGroup = buildBerth(BERTHS[m.dock]); scene.add(berthGroup); }
  placeVessel(m.start);
  menus.hideAll();
  setPlaying(true);
  input.clearPressed();
  mode = 'play';
  hud.warn(m.dock ? 'Underway: head for the first yellow beam' : 'Follow the yellow beams', 3000);
}

const KIND_ORDER = { training: 0, contract: 1, exam: 2 };
function boardEntries() {
  return [...MISSIONS].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]).map((m) => ({ mission: m, access: missionAccess(profile, m) }));
}
function heldNames() {
  return LICENSES.filter((l) => isHeld(profile, l.id)).map((l) => l.name);
}
function showBoard() {
  mode = 'board';
  menus.showBoard(profile, boardEntries(), heldNames());
}

function enterBoard() {
  clearMission();
  mission = null;
  placeVessel(MISSIONS[0].start);
  setPlaying(false);
  showBoard();
}

function showBriefing(m) {
  selected = m;
  mode = 'briefing';
  const ex = examFor(m);
  const lic = getLicense(m.license);
  menus.showBriefing(m, {
    dockName: m.dock ? BERTHS[m.dock].name : null,
    access: missionAccess(profile, m),
    exam: ex ? ex.exam : null,
    licenseName: lic ? lic.name : '',
  });
}

function showLicenses() {
  clearMission();
  setPlaying(false);
  mode = 'licenses';
  menus.showLicenses(profile, LICENSES.map((lic) => ({ lic, ev: evaluateLicense(profile, lic) })));
}

function beginWritten(licId) {
  quizLic = getLicense(licId);
  if (!quizLic || !quizLic.written || !QUIZ_POOLS[licId]) return;
  quizQuestions = pickQuestions(QUIZ_POOLS[licId], quizLic.written.questions);
  mode = 'quiz';
  menus.showQuiz(quizLic, quizQuestions);
}

function submitQuiz(answers) {
  const outcome = scoreQuiz(quizQuestions, answers, quizLic.written.passMark);
  recordWritten(profile, quizLic.id, outcome);
  saveProfile(storage, profile);
  menus.showQuizResult(quizLic, quizQuestions, answers, outcome);
}

// Depart from the briefing: re-check access, charge the exam fee, then sail.
function depart() {
  if (!selected) return;
  const access = missionAccess(profile, selected);
  if (!access.ok) { showBriefing(selected); return; }
  if (selected.kind === 'exam') {
    const paid = startExam(profile, selected);
    if (!paid.ok) { showBriefing(selected); return; }
    saveProfile(storage, profile);
  }
  startMission(selected);
}

function respawn(reason, manual = false) {
  if (!run) return;
  registerRespawn(run);
  placeVessel(respawnPose(run, BERTHS));
  hud.warn(reason, 2000);
}

function finish() {
  const result = scoreRun(run);
  const prev = profile.completed[mission.id];
  const newBest = !prev || result.total > prev.bestScore;
  recordResult(profile, mission.id, result);
  saveProfile(storage, profile);
  const rec = profile.completed[mission.id];
  let exam = null;
  const ex = examFor(mission);
  if (ex) {
    const judged = judgeExam(run, result, ex.exam);
    const out = applyExamOutcome(profile, ex.lic, result, judged);
    saveProfile(storage, profile);
    exam = { judged, awarded: out.awarded, licenseName: ex.lic.name, unlocks: ex.lic.unlocks, bonus: ex.lic.bonus };
  }
  mode = 'result';
  setPlaying(false);
  menus.showResult(mission, result, { newBest, bestGrade: rec.bestGrade, bestScore: rec.bestScore, bestTime: rec.bestTime, plays: rec.plays, credits: profile.credits, tips: coachingTips(result), exam });
}

function failMission(reason) {
  mode = 'result';
  setPlaying(false);
  menus.showFail(mission, reason);
}

function handleEvents(events) {
  for (const e of events) {
    if (mode !== 'play') return;
    if (e.type === 'waypoint') {
      const wp = mission.waypoints[e.index];
      if (e.last && mission.dock) hud.warn(`Docking: ease into the green berth at ${BERTHS[mission.dock].name}`, 3500);
      else if (!e.last) hud.warn(`Checkpoint: ${wp.name}`, 1500);
    } else if (e.type === 'damage') {
      hud.warn(`Collision! Hull ${Math.round(e.integrity)}%`, 1500);
    } else if (e.type === 'complete') {
      finish();
    } else if (e.type === 'failed') {
      failMission(e.reason);
    }
  }
}

// ---- menus
const menus = createMenus({
  onStart: () => enterBoard(),
  onSelect: (id) => showBriefing(getMission(id)),
  onDepart: () => depart(),
  onBoard: () => enterBoard(),
  onRetry: () => { if (!mission) return; if (mission.kind === 'exam') showBriefing(mission); else startMission(mission); },
  onLicenses: () => showLicenses(),
  onWritten: (id) => beginWritten(id),
  onQuizRetake: () => { if (quizLic) beginWritten(quizLic.id); },
  onQuizSubmit: (answers) => submitQuiz(answers),
  onExam: (id) => { const lic = getLicense(id); if (lic && lic.exam) showBriefing(getMission(lic.exam.mission)); },
  onMenu: () => openPause(),
  onResume: () => closePause(),
  onRestart: () => { if (mission && mission.kind !== 'exam') startMission(mission); },
  onAbort: () => { const e = run && abortRun(run); closePauseUi(); if (e) failMission(e.reason); else enterBoard(); },
  onSettings: () => { settingsReturn = mode; mode = 'settings'; menus.showPause(false); },
  onReset: () => { profile = clearProfile(storage); enterBoard(); },
});

function openPause() {
  if (mode !== 'play') return;
  mode = 'paused';
  menus.showPause(true, { canRestart: mission.kind !== 'exam', abortLabel: mission.kind === 'exam' ? 'Abort exam (fee not refunded)' : 'Abort mission' });
}
function closePauseUi() { document.getElementById('pause').classList.add('hidden'); }
function closePause() {
  closePauseUi();
  if (mode === 'paused') { mode = 'play'; input.clearPressed(); }
  else if (mode === 'settings') {
    mode = settingsReturn;
    if (mode === 'board') showBoard();
    else menus.showStart();
  }
}

// ---- camera drag + settings UI
let dragId = null, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (dragId !== null) return;
  dragId = e.pointerId; dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
const endDrag = (e) => { if (e.pointerId === dragId) { dragId = null; dragging = false; idleSince = performance.now(); } };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId) return;
  const k = 0.005 * settings.sensitivity;
  camOffset -= (e.clientX - lastX) * k;
  camPitch = Math.max(0.05, Math.min(1.0, camPitch + (e.clientY - lastY) * k));
  lastX = e.clientX; lastY = e.clientY;
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

function loadSettings() {
  const d = { sensitivity: 1, lowGraphics: false, reducedMotion: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem('bwc-settings') || '{}') }; } catch { return d; }
}
function saveSettings() { try { localStorage.setItem('bwc-settings', JSON.stringify(settings)); } catch { /* storage unavailable */ } }

// ---- simulation tick
function tick(dt) {
  time += dt;
  if (mode !== 'play' || !run) return;
  const inp = input.read();
  stepVessel(vessel, inp, P, dt);
  const col = resolveCollisions(vessel, P, obstacles);
  const events = [];
  if (col.hit) {
    const dmg = applyImpact(run, col.impact);
    if (dmg) events.push(dmg);
    stuckTime += dt;
    if (stuckTime > 4 && !dmg) respawn('Grounded: returned to last safe point');
  } else {
    stuckTime = 0;
  }
  const edge = edgeStatus(vessel);
  if (edge === 'warn') hud.warn('Leaving the chart area: turn back', 600);
  if (edge === 'out') respawn('Out of bounds: returned to last safe point');
  events.push(...stepRun(run, vessel, dt, BERTHS));
  handleEvents(events);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }

  const inp = input.read();
  if (input.wasPressed('KeyR') || inp.padRespawn) { if (mode === 'play') respawn('Respawned at last safe point', true); }
  if (input.wasPressed('Escape')) {
    if (mode === 'play') openPause();
    else if (mode === 'paused' || mode === 'settings') closePause();
    else if (mode === 'briefing') enterBoard();
    else if (mode === 'licenses') enterBoard();
    else if (mode === 'quiz') showLicenses();
  }
  if (input.wasPressed('Enter') || input.wasPressed('Space')) {
    if (mode === 'menu') enterBoard();
    else if (mode === 'briefing') depart();
    else if (mode === 'result') enterBoard();
  }

  // visuals
  water.userData.update(time);
  poseBoat(boat, vessel, time);
  if (buoys) updateBuoys(buoys, time, run && run.phase === 'underway' ? run.route.next : -1);
  updateCamera(dt);
  if (run) updateHud();
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

function dockHint(d, dist) {
  if (!d.inside) return `Berth ${Math.round(dist)} m away: line up with the pier and ease in`;
  if (!d.speedOk) return `Too fast: get under ${(DOCK.maxSpeed * 1.944).toFixed(0)} kn (reverse with S to brake)`;
  if (!d.angleOk) return 'Line up with the pier';
  return 'Hold steady...';
}

function updateHud() {
  const m = run.mission;
  let tx, tz, objective;
  const berth = m.dock ? BERTHS[m.dock] : null;
  let dock = null;
  if (run.phase === 'docking') {
    tx = berth.cx; tz = berth.cz;
    const dist = Math.hypot(tx - vessel.x, tz - vessel.z);
    objective = `Dock at ${berth.name}  ${Math.round(dist)} m`;
    const d = evaluateDock(vessel, berth);
    const holding = d.inside && d.speedOk && d.angleOk;
    if (berthGroup) berthGroup.userData.setState(holding ? 'hold' : dist < 45 ? 'near' : 'idle');
    dock = { name: berth.name, inside: d.inside, speedOk: d.speedOk, angleOk: d.angleOk, hint: dockHint(d, dist), hold: run.dockHold / DOCK.holdSeconds };
  } else {
    const wp = m.waypoints[Math.min(run.route.next, m.waypoints.length - 1)];
    tx = wp.x; tz = wp.z;
    objective = `${Math.min(run.route.next + 1, m.waypoints.length)}/${m.waypoints.length}  ${wp.name}  ${Math.round(Math.hypot(tx - vessel.x, tz - vessel.z))} m`;
  }
  const bearing = Math.atan2(tx - vessel.x, -(tz - vessel.z));
  hud.update({
    knots: speedKnots(vessel),
    heading: headingDegrees(vessel),
    throttle: vessel.throttle,
    objective,
    timer: run.departed ? formatTime(run.time) : '--:--',
    limit: `deadline ${formatTime(m.deadline)}`,
    late: run.time > m.deadline,
    hull: run.integrity,
    bearingRel: (angleDiff(bearing, vessel.heading) * 180) / Math.PI,
    dock,
  });
}

// Test/debug hook: read-only view of state; used by the headless smoke tests.
window.__bwc = {
  vessel,
  get mode() { return mode; },
  get run() { return run; },
  get profile() { return profile; },
  BERTHS,
  LICENSES,
  get quiz() { return quizQuestions; }, // debug: lets the headless test read the correct answers
};

setPlaying(false);
menus.showStart();
requestAnimationFrame(frame);
