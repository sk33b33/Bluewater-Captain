import * as THREE from 'three';
import { createVesselState, stepVessel, speedKnots, headingDegrees } from './sim/vessel.js';
import { windVector, windArrow } from './sim/wind.js';
import { getWeather } from './data/weather.js';
import { windAt, seaEffect, seaEffectText, forecastText, deadlineFor, waveSetFor, NO_SEA } from './sim/weather.js';
import { getQuality, AUTO_START, lowerQuality, pixelRatioFor } from './data/quality.js';
import { createFrameStats, createGovernor, recommendQuality } from './sim/perf.js';
import { createWake, stepWake, clearWake } from './sim/wake.js';
import { getVessel, DEFAULT_VESSEL } from './data/vessels.js';
import { BUOY_RADIUS, staticObstacles, resolveCollisions, edgeStatus } from './sim/world.js';
import { MISSIONS, BERTHS, getMission } from './data/missions.js';
import { LICENSES, getLicense } from './data/licenses.js';
import { SMALL_CRAFT_QUESTIONS, COASTAL_SKIPPER_QUESTIONS } from './data/quiz.js';
import { createRun, stepRun, applyImpact, registerRespawn, abortRun, respawnPose, scoreRun, evaluateDock, zoneAt, PORT_ZONES, DOCK } from './sim/mission.js';
import { findRoutes, routeFromPath, nextMarkers, isComplete, validatePath, planMission, estimateSeconds } from './sim/routes.js';
import { PORTS } from './data/ports.js';
import { createChart } from './ui/chart.js';
import { loadProfile, saveProfile, recordResult, clearProfile, safeStorage } from './sim/profile.js';
import { formatTime } from './sim/route.js';
import { pickQuestions, scoreQuiz } from './sim/quiz.js';
import { evaluateLicense, missionAccess, isHeld, examFor, chooseVessel, usableVessels, fleetStatus, selectVessel, startExam, judgeExam, applyExamOutcome, recordWritten, coachingTips } from './sim/licenses.js';
import { createSky } from './render/sky.js';
import { makeShoreTexture } from './render/shore.js';
import { createWakeMesh } from './render/wake.js';
import { applyAtmosphere } from './render/atmosphere.js';
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
const lights = addLights(scene, sky.sunDir);
const baseObstacles = staticObstacles();
const shoreTexture = makeShoreTexture(baseObstacles);

let qualityId = settings.quality === 'auto' ? AUTO_START : settings.quality;
let q = getQuality(qualityId);
let weather = getWeather('calm');
let seaWaves = waveSetFor(weather, q.waves);
let water = createWater(sky, q, shoreTexture);
scene.add(water);
scene.add(buildStatic());
let vp = getVessel(profile.vessel) || getVessel(DEFAULT_VESSEL); // vessel being driven / shown
let boat = buildBoat(vp);
scene.add(boat);
let sea = NO_SEA; // what the current weather does to the current vessel
let wake = createWake(q.wake);
let wakeMesh = null;
if (q.wake > 0) { wakeMesh = createWakeMesh(q.wake); scene.add(wakeMesh); }

function setVessel(v) {
  if (v.id === vp.id && boat) return;
  scene.remove(boat);
  disposeObject(boat);
  vp = v;
  boat = buildBoat(vp);
  scene.add(boat);
  sea = seaEffect(weather, vp);
}

// Weather: waves (cut to the quality's wave count), sky, fog/visibility, light and the effect on the vessel.
function applyWeather(w) {
  weather = w;
  seaWaves = waveSetFor(w, q.waves);
  water.userData.setWaves(seaWaves);
  applyAtmosphere({ scene, sky, water, hemi: lights.hemi, sun: lights.sun }, w);
  sea = seaEffect(w, vp);
}

function resize() {
  renderer.setPixelRatio(pixelRatioFor(q, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// Switch graphics preset: render resolution, water mesh, wave count, foam, wake.
function applyQuality(id) {
  const next = getQuality(id);
  qualityId = next.id;
  const rebuildWater = next.grid !== q.grid;
  const rebuildWake = next.wake !== q.wake;
  q = next;
  if (rebuildWater) {
    scene.remove(water);
    water.userData.dispose();
    water = createWater(sky, q, shoreTexture);
    scene.add(water);
  }
  water.userData.setFoam(q.foam);
  if (rebuildWake) {
    if (wakeMesh) { scene.remove(wakeMesh); wakeMesh.userData.dispose(); wakeMesh = null; }
    wake = createWake(q.wake);
    if (q.wake > 0) { wakeMesh = createWakeMesh(q.wake); scene.add(wakeMesh); }
  }
  applyWeather(weather);
  resize();
}
window.addEventListener('resize', resize);
resize();
applyWeather(weather);

// ---- game state
const input = createInput();
const hud = createHud();
const touchUi = setupTouchControls(input);

const vessel = createVesselState(MISSIONS[0].start.x, MISSIONS[0].start.z, MISSIONS[0].start.heading);
let mode = 'menu'; // menu | board | briefing | licenses | quiz | play | paused | settings | result
const QUIZ_POOLS = { 'small-craft-permit': SMALL_CRAFT_QUESTIONS, 'coastal-skipper': COASTAL_SKIPPER_QUESTIONS };
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
  clearWake(wake);
  if (touchUi) touchUi.reset();
}

function clearMission() {
  if (buoys) { scene.remove(buoys.group); disposeObject(buoys.group); buoys = null; }
  if (berthGroup) { scene.remove(berthGroup); disposeObject(berthGroup); berthGroup = null; }
  obstacles = baseObstacles;
  run = null;
}

function startMission(m, vessel) {
  clearMission();
  mission = m;
  setVessel(vessel);
  applyWeather(getWeather(m.weather));
  run = createRun(m, vessel);
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
  menus.showBoard(profile, boardEntries(), heldNames(), (getVessel(profile.vessel) || getVessel(DEFAULT_VESSEL)).name);
}

function enterBoard() {
  clearMission();
  mission = null;
  setVessel(getVessel(profile.vessel) || getVessel(DEFAULT_VESSEL));
  applyWeather(getWeather('calm'));
  placeVessel(MISSIONS[0].start);
  setPlaying(false);
  showBoard();
}

let briefingVessel = null;
let briefingRoute = null;
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

// Keep the player's chosen route if this vessel can still sail it, otherwise fall back to the shortest one.
function ensureRoute(m, vessel) {
  if (!m.planned || !vessel) { briefingRoute = null; return; }
  const keep = briefingRoute && briefingRoute.missionId === m.id && validatePath(m.fromPort, m.toPort, briefingRoute.path, vessel).ok;
  if (keep) return;
  const r = findRoutes(m.fromPort, m.toPort, { vessel, max: 1 })[0];
  briefingRoute = r ? { ...r, missionId: m.id } : null;
}

function showBriefing(m, keepVessel = false) {
  selected = m;
  mode = 'briefing';
  chart.hide();
  const ex = examFor(m);
  const lic = getLicense(m.license);
  const wx = getWeather(m.weather);
  const vessels = usableVessels(profile, m);
  if (!keepVessel || !briefingVessel || !vessels.some((v) => v.id === briefingVessel.id)) briefingVessel = chooseVessel(profile, m);
  ensureRoute(m, briefingVessel);
  const sailed = m.planned && briefingRoute ? planMission(m, briefingRoute) : m;
  menus.showBriefing(m, {
    dockName: m.dock ? BERTHS[m.dock].name : null,
    access: missionAccess(profile, m),
    exam: ex ? ex.exam : null,
    licenseName: lic ? lic.name : '',
    vessels,
    vessel: briefingVessel,
    deadline: briefingVessel ? deadlineFor(sailed, briefingVessel, wx) : sailed.deadline,
    routeText: briefingRoute ? `${briefingRoute.name}: ${km(briefingRoute.length)}${briefingRoute.hazards.length ? ', with a narrow passage' : ''}` : '',
    forecast: forecastText(wx),
    seaText: briefingVessel ? seaEffectText(wx, briefingVessel) : '',
    tip: wx.tip,
  });
}

// ---- chart / route planning
let planState = null; // { mission, vessel, path }
const chart = createChart({
  onMarker: (id) => {
    if (!planState) return;
    const opts = nextMarkers(planState.path, planState.mission.toPort, planState.vessel);
    if (opts.some((o) => o.id === id)) { planState.path.push(id); planState.message = ''; }
    else planState.message = 'That marker is not one leg from the end of your route.';
    renderChart();
  },
  onUndo: () => { if (planState && planState.path.length > 1) { planState.path.pop(); planState.message = ''; renderChart(); } },
  onReset: () => { if (planState) { planState.path = suggestedRoutes()[0].path.slice(); planState.message = ''; renderChart(); } },
  onPickRoute: (i) => { if (planState) { planState.path = suggestedRoutes()[i].path.slice(); planState.message = ''; renderChart(); } },
  onConfirm: () => {
    if (!planState) return;
    const { mission: m, vessel, path } = planState;
    const v = validatePath(m.fromPort, m.toPort, path, vessel);
    if (!v.ok || !isComplete(path, m.toPort)) { planState.message = v.reason || 'Finish the route at the destination port first.'; renderChart(); return; }
    const r = routeFromPath(m.fromPort, m.toPort, path);
    const match = suggestedRoutes().find((x) => x.id === r.id);
    briefingRoute = { ...r, name: match ? match.name : 'Custom route', via: match ? match.via : 'your own route', missionId: m.id };
    planState = null;
    showBriefing(m, true);
  },
  onCancel: () => {
    const m = planState && planState.mission;
    planState = null;
    if (m) showBriefing(m, true); else enterBoard();
  },
});

function suggestedRoutes() {
  return findRoutes(planState.mission.fromPort, planState.mission.toPort, { vessel: planState.vessel, max: 3 });
}

function renderChart() {
  const { mission: m, vessel, path } = planState;
  const routes = suggestedRoutes();
  const complete = isComplete(path, m.toPort);
  const wx = getWeather(m.weather);
  let summary = null;
  if (complete) {
    const r = routeFromPath(m.fromPort, m.toPort, path);
    summary = { length: r.length, seconds: estimateSeconds(r, vessel, wx), deadline: deadlineFor(planMission(m, r), vessel, wx), hazards: r.hazards };
  }
  const idx = routes.findIndex((r) => r.id === path.join('>'));
  menus.hideAll();
  chart.show({
    planning: true, mission: m, vessel, from: m.fromPort, to: m.toPort, routes, selectedIndex: idx, path, complete,
    next: nextMarkers(path, m.toPort, vessel), summary,
    message: planState.message || (complete ? '' : `Keep adding legs until you reach ${PORTS[m.toPort].name}.`),
  });
}

function openChart(planning) {
  if (planning) {
    if (!selected || !selected.planned || !briefingRoute || !briefingVessel) return;
    planState = { mission: selected, vessel: briefingVessel, path: briefingRoute.path.slice(), message: '' };
    mode = 'chart';
    renderChart();
  } else {
    planState = null;
    clearMission();
    setPlaying(false);
    mode = 'chart';
    menus.hideAll();
    chart.show({ planning: false, routes: [], path: [], next: [] });
  }
}

function showFleet() {
  clearMission();
  setPlaying(false);
  setVessel(getVessel(profile.vessel) || getVessel(DEFAULT_VESSEL));
  applyWeather(getWeather('calm'));
  mode = 'fleet';
  menus.showFleet(profile, fleetStatus(profile));
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
  startMission(selected.planned && briefingRoute ? planMission(selected, briefingRoute) : selected, briefingVessel);
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
  menus.showResult(mission, result, { newBest, bestGrade: rec.bestGrade, bestScore: rec.bestScore, bestTime: rec.bestTime, plays: rec.plays, credits: profile.credits, tips: coachingTips(result), exam, vesselName: vp.name, routeText: routeSummary(mission, result) });
}

function routeSummary(m, result) {
  if (!m.routeName) return '';
  const bonus = result.earlyBonusCredits > 0 ? ` Early-arrival bonus: +${result.earlyBonusCredits} credits.` : '';
  return `Route: ${m.routeName}, ${km(m.routeLength)}.${bonus}`;
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
    } else if (e.type === 'speeding') {
      hud.warn(`Slow down: ${e.zone.name} limit is ${Math.round(e.zone.knots)} knots`, 2500);
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
  onRetry: () => { if (!mission) return; if (mission.kind === 'exam') showBriefing(mission); else startMission(mission, vp); },
  onFleet: () => showFleet(),
  onChart: () => openChart(false),
  onPlanRoute: () => openChart(true),
  onBenchStart: () => benchStart(),
  onBenchApply: (id) => { settings.quality = id; qualitySel.value = id; saveSettings(); applyQuality(id); governor.reset(); enterBoard(); },
  onBenchClose: () => enterBoard(),
  onPickVessel: (id) => {
    const v = getVessel(id);
    if (!v || !usableVessels(profile, selected).some((u) => u.id === id)) return;
    briefingVessel = v;
    if (selectVessel(profile, id)) saveProfile(storage, profile);
    showBriefing(selected, true);
  },
  onUseVessel: (id) => {
    if (selectVessel(profile, id)) { saveProfile(storage, profile); setVessel(getVessel(id)); }
    showFleet();
  },
  onLicenses: () => showLicenses(),
  onWritten: (id) => beginWritten(id),
  onQuizRetake: () => { if (quizLic) beginWritten(quizLic.id); },
  onQuizSubmit: (answers) => submitQuiz(answers),
  onExam: (id) => { const lic = getLicense(id); if (lic && lic.exam) showBriefing(getMission(lic.exam.mission)); },
  onMenu: () => openPause(),
  onResume: () => closePause(),
  onRestart: () => { if (mission && mission.kind !== 'exam') startMission(mission, vp); },
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
const qualitySel = document.getElementById('set-quality');
const fpsBox = document.getElementById('set-fps');
const calm = document.getElementById('set-calm');
const perfEl = document.getElementById('perf');
sens.value = String(settings.sensitivity);
qualitySel.value = settings.quality;
fpsBox.checked = settings.showFps;
calm.checked = settings.reducedMotion;
perfEl.classList.toggle('hidden', !settings.showFps);
sens.addEventListener('input', () => { settings.sensitivity = parseFloat(sens.value); saveSettings(); });
qualitySel.addEventListener('change', () => {
  settings.quality = qualitySel.value;
  saveSettings();
  governor.reset();
  applyQuality(settings.quality === 'auto' ? (qualityId === 'high' ? 'high' : AUTO_START) : settings.quality);
});
fpsBox.addEventListener('change', () => { settings.showFps = fpsBox.checked; saveSettings(); perfEl.classList.toggle('hidden', !settings.showFps); });
calm.addEventListener('change', () => { settings.reducedMotion = calm.checked; saveSettings(); });

// Older saves used a Low graphics checkbox.
function loadSettings() {
  const d = { sensitivity: 1, quality: 'auto', showFps: false, reducedMotion: false };
  try {
    const raw = JSON.parse(localStorage.getItem('bwc-settings') || '{}');
    const out = { ...d, ...raw };
    if (raw.quality === undefined && raw.lowGraphics) out.quality = 'low';
    if (!['auto', 'low', 'medium', 'high'].includes(out.quality)) out.quality = 'auto';
    delete out.lowGraphics;
    return out;
  } catch { return d; }
}
function saveSettings() { try { localStorage.setItem('bwc-settings', JSON.stringify(settings)); } catch { /* storage unavailable */ } }

function toast(text, ms = 4000) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---- performance: frame statistics, automatic quality, benchmark
const stats = createFrameStats(240);
const governor = createGovernor();
let perfAcc = 0;
let bench = null;
const BENCH = { warmup: 1500, sample: 4000, order: ['low', 'medium', 'high'] };

function benchStart() {
  clearMission();
  mission = null;
  setPlaying(false);
  menus.hideAll();
  mode = 'bench';
  setVessel(getVessel('small-motorboat'));
  applyWeather(getWeather('choppy')); // rough enough to load the water, foam and wake
  placeVessel({ x: 0, z: 0, heading: 0.5 });
  bench = { i: 0, t0: performance.now(), samples: [], results: {}, restore: { quality: qualityId } };
  applyQuality(BENCH.order[0]);
  governor.reset();
  menus.showBenchProgress(`Testing ${getQuality(BENCH.order[0]).name} graphics...`);
}

function benchFrame(rawMs, now) {
  if (!bench) return;
  const t = now - bench.t0;
  if (t >= BENCH.warmup && rawMs < 1000) bench.samples.push(rawMs);
  const id = BENCH.order[bench.i];
  menus.showBenchProgress(`Testing ${getQuality(id).name} graphics (${bench.i + 1} of ${BENCH.order.length})... ${Math.max(0, Math.ceil((BENCH.warmup + BENCH.sample - t) / 1000))} s. Press Esc to cancel.`);
  if (t < BENCH.warmup + BENCH.sample) return;
  const st = createFrameStats(10000);
  bench.samples.forEach((ms) => st.push(ms));
  const r = st.summary();
  bench.results[id] = { avgFps: r.fps, low1Fps: r.low1Fps, avgMs: r.avgMs, samples: r.samples };
  bench.i += 1;
  bench.samples = [];
  bench.t0 = now;
  if (bench.i < BENCH.order.length) { applyQuality(BENCH.order[bench.i]); return; }
  const recommended = recommendQuality(bench.results);
  const results = bench.results;
  const restore = bench.restore.quality;
  bench = null;
  applyQuality(restore);
  mode = 'board';
  enterBoard();
  menus.showBenchResult(results, recommended, settings.quality);
}

function benchCancel() {
  if (!bench) return;
  const restore = bench.restore.quality;
  bench = null;
  applyQuality(restore);
  enterBoard();
}

// ---- simulation tick
function tick(dt) {
  time += dt;
  const moving = (mode === 'play' && run) || mode === 'bench';
  const sin = Math.sin(vessel.heading), cos = Math.cos(vessel.heading);
  stepWake(wake, dt, { sx: vessel.x - sin * vp.length * 0.45, sz: vessel.z + cos * vp.length * 0.45, heading: vessel.heading, speed: moving ? Math.hypot(vessel.u, vessel.v) : 0, beam: vp.beam, active: q.wake > 0 });
  if (mode === 'bench') {
    stepVessel(vessel, { throttle: 0.7, steer: 0.35 }, vp, dt, windVector(windAt(weather, time)), sea);
    resolveCollisions(vessel, vp, baseObstacles);
    return;
  }
  if (mode !== 'play' || !run) return;
  const inp = input.read();
  stepVessel(vessel, inp, vp, dt, windVector(windAt(weather, time)), sea);
  const col = resolveCollisions(vessel, vp, obstacles);
  const events = [];
  if (col.hit) {
    const dmg = applyImpact(run, col.impact, vp.hullStrength);
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
  const rawMs = now - last;
  const dt = Math.min(0.1, rawMs / 1000);
  last = now;
  if (mode === 'bench') benchFrame(rawMs, now);
  else if (now > 3000 && rawMs < 1000) {
    stats.push(rawMs);
    if (settings.quality === 'auto' && governor.feed(rawMs) === 'down') {
      const lower = lowerQuality(qualityId);
      if (lower) { applyQuality(lower); toast(`Running slowly: graphics lowered to ${getQuality(lower).name}. Change it in Settings.`); }
    }
  }
  if (settings.showFps) {
    perfAcc += rawMs;
    if (perfAcc > 500) {
      perfAcc = 0;
      const sm = stats.summary();
      perfEl.textContent = `${sm.fps.toFixed(0)} fps · 1% low ${sm.low1Fps.toFixed(0)} · ${sm.avgMs.toFixed(1)} ms · ${q.name}${settings.quality === 'auto' ? ' (auto)' : ''} · ${renderer.info.render.calls} calls`;
    }
  }
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }

  const inp = input.read();
  if (input.wasPressed('KeyR') || inp.padRespawn) { if (mode === 'play') respawn('Respawned at last safe point', true); }
  if (input.wasPressed('Escape')) {
    if (mode === 'play') openPause();
    else if (mode === 'paused' || mode === 'settings') closePause();
    else if (mode === 'briefing') enterBoard();
    else if (mode === 'licenses') enterBoard();
    else if (mode === 'fleet') enterBoard();
    else if (mode === 'chart') { const m = planState && planState.mission; planState = null; if (m) showBriefing(m, true); else enterBoard(); }
    else if (mode === 'quiz') showLicenses();
    else if (mode === 'bench') benchCancel();
  }
  if (input.wasPressed('Enter') || input.wasPressed('Space')) {
    if (mode === 'menu') enterBoard();
    else if (mode === 'briefing') depart();
    else if (mode === 'result') enterBoard();
  }

  // visuals
  water.userData.update(time);
  water.userData.follow(camera.position.x, camera.position.z);
  poseBoat(boat, vessel, time, vp, seaWaves);
  if (buoys) updateBuoys(buoys, time, run && run.phase === 'underway' ? run.route.next : -1, seaWaves);
  if (wakeMesh) wakeMesh.userData.sync(wake, time, seaWaves, camera, renderer.domElement.height);
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
  const dist = vp.cameraDistance;
  const bx = vessel.x, bz = vessel.z;
  const hy = boat.position.y;
  camera.position.set(bx - Math.sin(yaw) * dist * Math.cos(camPitch), hy + 2 + dist * Math.sin(camPitch) + 2.5 + vp.length * 0.15, bz + Math.cos(yaw) * dist * Math.cos(camPitch));
  camera.lookAt(bx, hy + 1.5 + vp.length * 0.08, bz);
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

function zoneInfo() {
  const z = zoneAt(vessel, PORT_ZONES);
  if (!z) return null;
  const speed = Math.hypot(vessel.u, vessel.v);
  return { text: `${z.name} slow zone: limit ${Math.round(z.knots)} kn`, over: speed > z.limit };
}

function windText() {
  const w = windAt(weather, time);
  const vis = weather.visibility < 1500 ? ` \u00b7 vis ${weather.visibility} m` : '';
  return `wind ${(w.speed * 1.943844).toFixed(0)} kn ${windArrow(vessel.heading, w)} \u00b7 sea ${weather.waveHs.toFixed(1)} m${vis}`;
}

function remainingMeters() {
  const wps = run.mission.waypoints;
  let d = 0, x = vessel.x, z = vessel.z;
  for (let i = run.route.next; i < wps.length; i++) { d += Math.hypot(wps[i].x - x, wps[i].z - z); x = wps[i].x; z = wps[i].z; }
  if (run.mission.dock) { const b = BERTHS[run.mission.dock]; d += Math.hypot(b.cx - x, b.cz - z); }
  return d;
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
    if (m.planned) objective += ` \u00b7 ${km(remainingMeters())} to go`;
  }
  const bearing = Math.atan2(tx - vessel.x, -(tz - vessel.z));
  hud.update({
    knots: speedKnots(vessel),
    heading: headingDegrees(vessel),
    throttle: vessel.throttle,
    objective,
    timer: run.departed ? formatTime(run.time) : '--:--',
    limit: `deadline ${formatTime(run.deadline)}`,
    wind: windText(),
    zone: zoneInfo(),
    late: run.time > run.deadline,
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
  get vesselId() { return vp.id; },
  get route() { return briefingRoute; },
  get plan() { return planState; },
  get quality() { return qualityId; },
  get weatherId() { return weather.id; },
  get seaWaves() { return seaWaves; },
  get sea() { return sea; },
  get wakeAlive() { let n = 0; for (let i = 0; i < wake.capacity; i++) if (wake.age[i] < 7) n++; return n; },
  get bench() { return bench; },
  applyQuality: (id) => applyQuality(id),
  setWeather: (id) => applyWeather(getWeather(id)),
  get fogFar() { return scene.fog.far; },
  get quiz() { return quizQuestions; }, // debug: lets the headless test read the correct answers
};

setPlaying(false);
menus.showStart();
requestAnimationFrame(frame);
