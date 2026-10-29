import test from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER, getWeather, DEFAULT_WEATHER } from '../src/data/weather.js';
import { VESSELS, getVessel } from '../src/data/vessels.js';
import { MISSIONS, getMission } from '../src/data/missions.js';
import { windAt, seaEffect, deadlineFor, waveSetFor, forecastText, seaEffectText, NO_SEA, SEA_TUNING } from '../src/sim/weather.js';
import { waveSet, getWaterHeight } from '../src/sim/waves.js';
import { createVesselState, stepVessel } from '../src/sim/vessel.js';
import { windVector, windKnots } from '../src/sim/wind.js';
import { turnRadius } from '../src/sim/handling.js';
import { createRun } from '../src/sim/mission.js';

const DT = 1 / 60;
const [skiff, workboat, cat] = VESSELS;
const ORDER = ['calm', 'breezy', 'choppy', 'rough'];

test('presets are complete and sea states escalate: wind, waves, cloud up; visibility down', () => {
  for (const w of Object.values(WEATHER)) {
    for (const k of ['id', 'name', 'windKnots', 'gust', 'fromDeg', 'veerDeg', 'waveHs', 'visibility', 'cloud', 'tip']) assert.ok(w[k] !== undefined, `${w.id}.${k}`);
    assert.ok(w.gust >= 0 && w.gust < 1 && w.cloud >= 0 && w.cloud <= 1 && w.visibility > 100);
  }
  for (let i = 1; i < ORDER.length; i++) {
    const [a, b] = [WEATHER[ORDER[i - 1]], WEATHER[ORDER[i]]];
    assert.ok(b.windKnots > a.windKnots && b.waveHs > a.waveHs && b.cloud >= a.cloud && b.visibility < a.visibility, `${a.id} -> ${b.id}`);
  }
  assert.ok(WEATHER.foggy.visibility < 500 && WEATHER.foggy.waveHs < 1, 'fog is about visibility, not waves');
  assert.equal(getWeather('nope').id, DEFAULT_WEATHER);
});

test('every mission names a real weather preset', () => {
  for (const m of MISSIONS) assert.ok(WEATHER[m.weather], `${m.id}: ${m.weather}`);
  assert.ok(new Set(MISSIONS.map((m) => m.weather)).size >= 4, 'missions use a range of conditions');
});

// ---- wind
test('wind is deterministic and stays inside its gust and veer bounds', () => {
  for (const w of Object.values(WEATHER)) {
    const base = w.windKnots / 1.943844;
    let sum = 0, n = 0;
    for (let t = 0; t < 600; t += 0.5) {
      const a = windAt(w, t);
      assert.deepEqual(a, windAt(w, t));
      assert.ok(a.speed >= base * (1 - w.gust) - 1e-9 && a.speed <= base * (1 + w.gust) + 1e-9, `${w.id} t=${t}`);
      assert.ok(Math.abs(a.fromDeg - w.fromDeg) <= w.veerDeg + 1e-9);
      sum += a.speed; n++;
    }
    assert.ok(Math.abs(sum / n - base) < base * 0.12, `${w.id} mean speed near base`);
  }
});

test('wind actually varies (gusts), more in rougher weather', () => {
  const spread = (w) => { let lo = 99, hi = 0; for (let t = 0; t < 300; t += 0.25) { const s = windAt(w, t).speed; lo = Math.min(lo, s); hi = Math.max(hi, s); } return (hi - lo) / (w.windKnots / 1.943844); };
  assert.ok(spread(WEATHER.rough) > 0.3 && spread(WEATHER.calm) < 0.2);
});

// ---- waves
test('wave energy matches the significant wave height', () => {
  for (const w of Object.values(WEATHER)) {
    const sigma2 = waveSet(w).reduce((a, k) => a + (k.amp * k.amp) / 2, 0);
    assert.ok(Math.abs(Math.sqrt(sigma2) * 4 - w.waveHs) < 1e-9, w.id);
  }
});

test('measured wave height in the water field is close to the preset (std dev ~ Hs / 4)', () => {
  for (const id of ['calm', 'choppy', 'rough']) {
    const w = WEATHER[id], waves = waveSet(w);
    let s = 0, s2 = 0, n = 0;
    for (let x = -500; x < 500; x += 13) for (let z = -500; z < 500; z += 17) for (let t = 0; t < 30; t += 5) { const h = getWaterHeight(x, z, t, waves); s += h; s2 += h * h; n++; }
    const sd = Math.sqrt(s2 / n - (s / n) ** 2);
    assert.ok(Math.abs(sd * 4 - w.waveHs) < w.waveHs * 0.2, `${id}: Hs~${(sd * 4).toFixed(2)} vs ${w.waveHs}`);
  }
});

test('waves are directional: they travel downwind and are longer in bigger seas', () => {
  const w = { ...WEATHER.choppy, fromDeg: 270 }; // wind from the west: waves move east (+x)
  const dom = waveSet(w)[0];
  assert.ok(Math.abs(Math.sin(dom.dir)) < 1e-9 && Math.cos(dom.dir) > 0, 'dominant wave direction is +x');
  // A crest at x=0, z=0 moves to larger x over time.
  const one = [dom];
  let x0 = null, x1 = null;
  const crestNear = (t, from) => { let best = from, bh = -9; for (let x = from; x < from + dom.length; x += 0.1) { const h = getWaterHeight(x, 0, t, one); if (h > bh) { bh = h; best = x; } } return best; };
  x0 = crestNear(0, 0);
  x1 = crestNear(1, x0 - 2);
  assert.ok(x1 > x0, `crest moved from ${x0.toFixed(1)} to ${x1.toFixed(1)}`);
  assert.ok(waveSet(WEATHER.rough)[0].length > waveSet(WEATHER.calm)[0].length);
});

test('no wave is too short for the water mesh to resolve', () => {
  for (const w of Object.values(WEATHER)) for (const k of waveSet(w)) assert.ok(k.length >= 14, `${w.id} ${k.length}`);
});

test('waveSetFor trims to the quality level', () => {
  assert.equal(waveSetFor(WEATHER.calm, 3).length, 3);
  assert.equal(waveSetFor(WEATHER.calm).length, 4);
});

// ---- the sea changes handling
test('relative sea: small boats suffer most, calm water is harmless', () => {
  const eff = (w, v) => seaEffect(WEATHER[w], v);
  for (const id of ['breezy', 'choppy', 'rough']) {
    assert.ok(eff(id, skiff).speedFactor < eff(id, workboat).speedFactor, `${id} skiff vs workboat`);
    assert.ok(eff(id, skiff).speedFactor < eff(id, cat).speedFactor, `${id} skiff vs cat`);
  }
  assert.equal(eff('calm', skiff).speedFactor, 1, 'calm water costs nothing');
  assert.equal(eff('calm', cat).speedFactor, 1);
  assert.ok(eff('rough', skiff).speedFactor < eff('choppy', skiff).speedFactor && eff('choppy', skiff).speedFactor < eff('breezy', skiff).speedFactor);
  assert.ok(eff('rough', skiff).severity <= SEA_TUNING.maxSeverity + 1e-9);
  assert.ok(eff('rough', skiff).speedFactor > 0.6, 'never uncontrollable');
});

function topSpeed(v, sea) { const s = createVesselState(0, 0, 0); for (let i = 0; i < 60 * 90; i++) stepVessel(s, { throttle: 1, steer: 0 }, v, DT, undefined, sea); return s.u; }

test('rough seas lower top speed by exactly the sea factor', () => {
  for (const v of VESSELS) {
    const sea = seaEffect(WEATHER.choppy, v);
    const u = topSpeed(v, sea);
    assert.ok(Math.abs(u - v.maxSpeed * sea.speedFactor) < 0.6, `${v.id}: ${u.toFixed(2)} vs ${(v.maxSpeed * sea.speedFactor).toFixed(2)}`);
    assert.ok(u < topSpeed(v, NO_SEA));
  }
});

test('rough seas blunt steering: wider turns, most for the small boat', () => {
  const radius = (v, sea) => { const s = createVesselState(0, 0, 0); for (let i = 0; i < 60 * 40; i++) stepVessel(s, { throttle: Math.max(-1, Math.min(1, (6 - s.u) * 0.8)), steer: 0 }, v, DT, undefined, sea); for (let i = 0; i < 60 * 12; i++) stepVessel(s, { throttle: Math.max(-1, Math.min(1, (6 - s.u) * 0.8)), steer: 1 }, v, DT, undefined, sea); return s.u / Math.abs(s.r); };
  for (const v of VESSELS) assert.ok(radius(v, seaEffect(WEATHER.rough, v)) > radius(v, NO_SEA) * 1.05, v.id);
  const gain = (v) => radius(v, seaEffect(WEATHER.rough, v)) / radius(v, NO_SEA);
  assert.ok(gain(skiff) > gain(cat));
  assert.ok(Math.abs(radius(skiff, NO_SEA) - turnRadius(skiff)) < 0.01, 'no sea = old behaviour');
});

test('gusts and veer change the leeway drift over time', () => {
  const w = WEATHER.breezy;
  const drift = (t0) => { const s = createVesselState(0, 0, 0); const v = windVector(windAt(w, t0)); for (let i = 0; i < 60 * 5; i++) stepVessel(s, { throttle: 0, steer: 0 }, skiff, DT, v); return Math.hypot(s.x, s.z); };
  const ds = [0, 3, 6, 9, 12].map(drift);
  assert.ok(Math.max(...ds) / Math.min(...ds) > 1.1, `drift varies: ${ds.map((d) => d.toFixed(2))}`);
});

// ---- deadlines and text
test('deadlines grow with rougher sea and slower vessels', () => {
  const m = getMission('training-loop');
  const d = (v, w) => deadlineFor(m, v, WEATHER[w]);
  assert.ok(d(skiff, 'calm') <= d(skiff, 'breezy') && d(skiff, 'breezy') < d(skiff, 'choppy') && d(skiff, 'choppy') < d(skiff, 'rough'));
  assert.ok(d(workboat, 'calm') > d(skiff, 'calm'));
  assert.equal(createRun(m, skiff).deadline, deadlineFor(m, skiff, getWeather(m.weather)));
});

test('forecast and sea-effect text are readable and specific', () => {
  const f = forecastText(WEATHER.choppy);
  assert.match(f, /Moderate sea/); assert.match(f, /18 kn/); assert.match(f, /1\.4 m/); assert.match(f, /3\.5 km|3 km|4 km/);
  assert.match(forecastText(WEATHER.foggy), /450 m/);
  assert.match(seaEffectText(WEATHER.rough, skiff), /Harbor Skiff: top speed -\d+%, steering -\d+%/);
  assert.match(seaEffectText(WEATHER.calm, cat), /No noticeable sea effect/);
  assert.ok(windKnots({ speed: 5 }) > 9);
});

// ---- every mission still works in its own weather with every vessel (see tests/mission.test.js autopilot loop)
test('the roughest mission conditions still leave every allowed vessel controllable', () => {
  for (const m of MISSIONS) for (const cls of m.vesselClasses) {
    const v = VESSELS.find((x) => x.class === cls);
    const s = seaEffect(getWeather(m.weather), v);
    assert.ok(s.speedFactor > 0.6 && s.steerFactor > 0.7, `${m.id}/${v.id}`);
  }
});
