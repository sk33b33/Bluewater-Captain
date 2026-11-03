import test from 'node:test';
import assert from 'node:assert/strict';
import { VESSELS } from '../src/data/vessels.js';
import { idlePitch, engineParams, waterParams, windParams, impactParams, hornPitch, masterLevel } from '../src/sim/audiomap.js';

const [skiff, workboat, cat, cargo, box] = VESSELS;

test('bigger vessels sound deeper: engine idle and horn pitch fall with mass', () => {
  const idles = VESSELS.map(idlePitch);
  for (let i = 1; i < idles.length; i++) assert.ok(idles[i] < idles[i - 1], `idle ${VESSELS[i].id}`);
  const horns = VESSELS.map(hornPitch);
  for (let i = 1; i < horns.length; i++) assert.ok(horns[i] < horns[i - 1], `horn ${VESSELS[i].id}`);
  for (const v of VESSELS) assert.ok(idlePitch(v) >= 18 && idlePitch(v) <= 95 && hornPitch(v) >= 60 && hornPitch(v) <= 300, v.id);
});

test('the engine gets higher and louder with load, whichever of throttle and speed is bigger', () => {
  for (const v of VESSELS) {
    const idle = engineParams(v, 0, 0), half = engineParams(v, 0.5, 0), full = engineParams(v, 1, v.maxSpeed);
    assert.ok(idle.freq < half.freq && half.freq < full.freq, `${v.id} pitch`);
    assert.ok(idle.gain < half.gain && half.gain < full.gain, `${v.id} gain`);
    assert.ok(idle.cutoff < full.cutoff);
    assert.ok(engineParams(v, 0, v.maxSpeed * 0.9).load > 0.85, 'coasting fast still sounds loaded');
    assert.ok(Math.abs(engineParams(v, -1, 0).load - 1) < 1e-9, 'full astern is full load');
    assert.ok(full.gain < 0.3, 'never painfully loud');
  }
});

test('water and wind get louder with speed, waves and wind speed, and stay bounded', () => {
  const a = waterParams(skiff, 0, 0), b = waterParams(skiff, 10, 0), c = waterParams(skiff, 10, 2);
  assert.ok(a.gain < b.gain && b.gain < c.gain && a.cutoff < b.cutoff);
  assert.ok(waterParams(skiff, 999, 99).gain < 0.3);
  assert.ok(windParams(0).gain < windParams(6).gain && windParams(6).gain < windParams(14).gain);
  assert.ok(windParams(100).gain === windParams(14).gain, 'capped');
});

test('impacts: a harder hit is louder and longer; tiny and huge values stay in range', () => {
  const soft = impactParams(1), hard = impactParams(6);
  assert.ok(hard.gain > soft.gain && hard.seconds > soft.seconds);
  for (const x of [0, -3, 1e9, NaN]) { const p = impactParams(x); assert.ok(p.gain > 0 && p.gain <= 0.65 + 1e-9 && p.seconds > 0 && p.seconds < 1, `impact ${x}`); }
});

test('master level: muted is silent, the volume slider is a squared curve, out of range is clamped', () => {
  assert.equal(masterLevel(1, true), 0);
  assert.equal(masterLevel(0, false), 0);
  assert.equal(masterLevel(1, false), 1);
  assert.equal(masterLevel(0.5, false), 0.25);
  assert.equal(masterLevel(5, false), 1);
  assert.equal(masterLevel(-1, false), 0);
});
