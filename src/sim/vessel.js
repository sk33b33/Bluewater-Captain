// Surface vessel model: surge, lateral slip and yaw. Fixed-step, no rendering deps.
// Heading 0 = north (-z), increasing clockwise (east = +PI/2). World axes: x east, z south.
export const SMALL_MOTORBOAT = {
  id: 'small-motorboat',
  name: 'Harbor Skiff (placeholder)',
  maxSpeed: 14, // m/s forward at full throttle (~27 kn)
  maxReverse: 4, // m/s
  thrustAccel: 3.5, // m/s^2 at full throttle
  maxYawRate: 0.9, // rad/s at full rudder, at reference speed
  yawRefSpeed: 5, // m/s at which rudder reaches full authority
  yawResponse: 2.2, // 1/s, how quickly yaw rate follows the target
  rudderResponse: 3.0, // 1/s, how quickly the rudder follows input
  throttleResponse: 1.6, // 1/s
  lateralDamping: 1.4, // 1/s, how fast sideways slip decays
  length: 6.5,
  hullRadius: 1.4,
};

export function createVesselState(x = 0, z = 0, heading = 0) {
  return { x, z, heading, u: 0, v: 0, r: 0, throttle: 0, rudder: 0 };
}

// Light linear resistance so the boat does not coast forever at tiny speeds.
const LINEAR_RESISTANCE = 0.05;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const approach = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, rate * dt);

// input: { throttle: -1..1, steer: -1..1 }  (steer +1 = turn to starboard / right)
export function stepVessel(s, input, p, dt) {
  const throttleIn = clamp(input.throttle, -1, 1);
  const steerIn = clamp(input.steer, -1, 1);
  s.throttle = approach(s.throttle, throttleIn, p.throttleResponse, dt);
  s.rudder = approach(s.rudder, steerIn, p.rudderResponse, dt);

  // Surge: thrust vs quadratic drag tuned so full throttle settles at maxSpeed.
  const dragFwd = (p.thrustAccel - LINEAR_RESISTANCE * p.maxSpeed) / (p.maxSpeed * p.maxSpeed);
  const dragRev = (p.thrustAccel - LINEAR_RESISTANCE * p.maxReverse) / (p.maxReverse * p.maxReverse);
  const thrust = s.throttle * p.thrustAccel;
  const drag = s.u >= 0 ? dragFwd * s.u * s.u : -dragRev * s.u * s.u;
  s.u += (thrust - drag) * dt;
  s.u -= s.u * LINEAR_RESISTANCE * dt;

  // Yaw: authority grows with speed, reverses when going astern.
  const authority = clamp(s.u / p.yawRefSpeed, -1, 1);
  const targetR = s.rudder * p.maxYawRate * authority;
  s.r = approach(s.r, targetR, p.yawResponse, dt);
  s.heading += s.r * dt;
  s.heading = ((s.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Lateral slip: turning throws the stern out, then it damps away.
  s.v += -s.u * s.r * dt;
  s.v -= s.v * p.lateralDamping * dt;

  const sin = Math.sin(s.heading);
  const cos = Math.cos(s.heading);
  // forward = (sin, -cos); starboard = (cos, sin)
  s.x += (s.u * sin + s.v * cos) * dt;
  s.z += (-s.u * cos + s.v * sin) * dt;
  return s;
}

export function speedKnots(s) {
  return Math.hypot(s.u, s.v) * 1.943844;
}

export function headingDegrees(s) {
  return (s.heading * 180) / Math.PI;
}
