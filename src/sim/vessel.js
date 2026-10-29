// Surface vessel model: surge, lateral slip and yaw. Fixed-step, no rendering deps.
// Heading 0 = north (-z), increasing clockwise (east = +PI/2). World axes: x east, z south.
import { VESSELS } from '../data/vessels.js';

// Default vessel, kept as a named export for tests and tools.
export const SMALL_MOTORBOAT = VESSELS[0];

export function createVesselState(x = 0, z = 0, heading = 0) {
  return { x, z, heading, u: 0, v: 0, r: 0, throttle: 0, rudder: 0 };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, rate * dt);

// input: { throttle: -1..1, steer: -1..1 }  (steer +1 = turn to starboard / right)
// wind: optional { x, z } velocity the wind pushes toward (see sim/wind.js windVector).
// sea: optional { speedFactor, steerFactor } from sim/weather.js seaEffect (waves slow and blunt the boat).
export function stepVessel(s, input, p, dt, wind, sea) {
  const speedF = sea ? sea.speedFactor : 1;
  const steerF = sea ? sea.steerFactor : 1;
  const maxSpeed = p.maxSpeed * speedF;
  const maxReverse = p.maxReverse * speedF;
  const throttleIn = clamp(input.throttle, -1, 1);
  const steerIn = clamp(input.steer, -1, 1);
  s.throttle = approach(s.throttle, throttleIn, p.throttleResponse, dt);
  s.rudder = approach(s.rudder, steerIn, p.rudderResponse, dt);

  // Surge: thrust vs quadratic drag tuned so full throttle settles at maxSpeed, plus low-speed resistance.
  // Astern uses its own (usually weaker) thrust, so heavy boats take longer to stop.
  const lin = p.linearResistance;
  const reverseAccel = p.reverseAccel ?? p.thrustAccel;
  const dragFwd = (p.thrustAccel - lin * maxSpeed) / (maxSpeed * maxSpeed);
  const dragRev = (reverseAccel - lin * maxReverse) / (maxReverse * maxReverse);
  const thrust = s.throttle >= 0 ? s.throttle * p.thrustAccel : s.throttle * reverseAccel;
  const drag = s.u >= 0 ? dragFwd * s.u * s.u : -dragRev * s.u * s.u;
  s.u += (thrust - drag - lin * s.u) * dt;

  // Yaw: authority grows with speed, reverses when going astern.
  const authority = clamp(s.u / p.yawRefSpeed, -1, 1);
  const targetR = s.rudder * p.maxYawRate * steerF * authority;
  s.r = approach(s.r, targetR, p.yawResponse, dt);
  s.heading += s.r * dt;
  s.heading = ((s.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Lateral slip: turning throws the stern out, then it damps away.
  s.v += -s.u * s.r * dt;
  s.v -= s.v * p.lateralDamping * dt;

  const sin = Math.sin(s.heading);
  const cos = Math.cos(s.heading);
  // Leeway: the wind carries the boat (and more so a boat with a lot of windage).
  const w = wind || { x: 0, z: 0 };
  const driftX = (p.windage || 0) * w.x;
  const driftZ = (p.windage || 0) * w.z;
  // forward = (sin, -cos); starboard = (cos, sin)
  s.x += (s.u * sin + s.v * cos + driftX) * dt;
  s.z += (-s.u * cos + s.v * sin + driftZ) * dt;
  return s;
}

export function speedKnots(s) {
  return Math.hypot(s.u, s.v) * 1.943844;
}

export function headingDegrees(s) {
  return (s.heading * 180) / Math.PI;
}
