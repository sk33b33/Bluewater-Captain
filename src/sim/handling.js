// Handling numbers measured by running the real vessel model, shown on the fleet screen and tested.
// Nothing here is hand-typed per vessel, so the screen can never disagree with how the boat drives.
import { createVesselState, stepVessel } from './vessel.js';
import { windVector } from './wind.js';

const DT = 1 / 60;
const cache = new Map();

function settleAt(v, target) {
  const s = createVesselState(0, 0, 0);
  for (let i = 0; i < 60 * 40; i++) stepVessel(s, { throttle: Math.max(-1, Math.min(1, (target - s.u) * 0.8)), steer: 0 }, v, DT);
  return s;
}

export function brakingDistance(v, from = 6) {
  const s = settleAt(v, from);
  const z0 = s.z;
  for (let i = 0; i < 60 * 60 && s.u > 0.3; i++) stepVessel(s, { throttle: -1, steer: 0 }, v, DT);
  return Math.abs(s.z - z0);
}

export function turnRadius(v, speed = 6) {
  const s = settleAt(v, speed);
  for (let i = 0; i < 60 * 12; i++) stepVessel(s, { throttle: Math.max(-1, Math.min(1, (speed - s.u) * 0.8)), steer: 1 }, v, DT);
  return s.u / Math.abs(s.r);
}

export function timeTo90(v) {
  const s = createVesselState(0, 0, 0);
  for (let i = 0; i < 60 * 120; i++) {
    stepVessel(s, { throttle: 1, steer: 0 }, v, DT);
    if (s.u >= 0.9 * v.maxSpeed) return i * DT;
  }
  return Infinity;
}

// How far a stopped boat is carried in one minute of the given wind.
export function driftPerMinute(v, wind = windVector()) {
  const s = createVesselState(0, 0, 0);
  for (let i = 0; i < 60 * 60; i++) stepVessel(s, { throttle: 0, steer: 0 }, v, DT, wind);
  return Math.hypot(s.x, s.z);
}

export function handlingProfile(v) {
  if (!cache.has(v.id)) {
    cache.set(v.id, {
      topKnots: v.maxSpeed * 1.943844,
      timeTo90: timeTo90(v),
      brakeDistance: brakingDistance(v),
      turnRadius: turnRadius(v),
      driftPerMinute: driftPerMinute(v),
      toughness: 1 / v.hullStrength,
    });
  }
  return cache.get(v.id);
}

// Rows for the fleet screen. `better` says which direction is good, so bars can be read at a glance.
export function statRows(v, fleet) {
  const h = handlingProfile(v);
  const all = fleet.map(handlingProfile);
  const row = (label, value, display, key, better) => {
    const vals = all.map((a) => a[key]);
    const max = Math.max(...vals);
    return { label, display, ratio: value / max, better };
  };
  return [
    row('Top speed', h.topKnots, `${h.topKnots.toFixed(0)} kn`, 'topKnots', 'higher'),
    row('Pick-up (0 to 90% speed)', h.timeTo90, `${h.timeTo90.toFixed(1)} s`, 'timeTo90', 'lower'),
    row('Stopping from 12 kn', h.brakeDistance, `${h.brakeDistance.toFixed(0)} m`, 'brakeDistance', 'lower'),
    row('Turning circle at 12 kn', h.turnRadius, `${h.turnRadius.toFixed(0)} m radius`, 'turnRadius', 'lower'),
    row('Wind drift (1 min)', h.driftPerMinute, `${h.driftPerMinute.toFixed(0)} m`, 'driftPerMinute', 'lower'),
    row('Hull toughness', h.toughness, `${h.toughness.toFixed(1)}x`, 'toughness', 'higher'),
  ];
}
