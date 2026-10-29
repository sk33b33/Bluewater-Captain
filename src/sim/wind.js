// Steady wind (Stage 4). Direction is where the wind blows FROM, in degrees clockwise from north.
// Stage 5 replaces this with changing weather behind the same functions.
export const WIND = { fromDeg: 300, speed: 4 }; // 4 m/s, about 8 knots, from the north-west

// Velocity the wind pushes things toward, in world axes (x east, z south), m/s.
export function windVector(w = WIND) {
  const toward = ((w.fromDeg + 180) * Math.PI) / 180;
  return { x: Math.sin(toward) * w.speed, z: -Math.cos(toward) * w.speed };
}

export const windKnots = (w = WIND) => w.speed * 1.943844;

// Which way the wind pushes relative to the bow: 0 = straight ahead, 90 = to starboard, 180 = astern.
export function windPushAngleDeg(heading, w = WIND) {
  const toward = ((w.fromDeg + 180) * Math.PI) / 180;
  let d = ((toward - heading) * 180) / Math.PI;
  d = ((d % 360) + 360) % 360;
  return d;
}

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
export function windArrow(heading, w = WIND) {
  return ARROWS[Math.round(windPushAngleDeg(heading, w) / 45) % 8];
}
