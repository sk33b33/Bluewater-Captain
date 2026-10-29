// Boat wake: a trail of foam particles dropped behind the stern. Pure particle bookkeeping (a ring buffer),
// so it is testable and the renderer only has to draw what is here. No randomness: jitter comes from a hash.
const LIFETIME = 7; // seconds a particle lives

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function createWake(capacity) {
  return {
    capacity,
    x: new Float32Array(capacity), z: new Float32Array(capacity),
    age: new Float32Array(capacity).fill(LIFETIME), // starts expired
    size: new Float32Array(capacity),
    head: 0, carry: 0, counter: 0,
  };
}

export function aliveCount(w) {
  let n = 0;
  for (let i = 0; i < w.capacity; i++) if (w.age[i] < LIFETIME) n++;
  return n;
}

// Advance particles and drop new ones for a vessel moving at `speed` (m/s) with its stern at (sx, sz),
// heading `heading` and beam `beam`. `active` false (e.g. wake turned off) only ages what exists.
export function stepWake(w, dt, { sx, sz, heading, speed, beam, active = true }) {
  for (let i = 0; i < w.capacity; i++) if (w.age[i] < LIFETIME) { w.age[i] += dt; w.size[i] += dt * 1.6; }
  if (!active || w.capacity === 0 || speed < 1.0) return;
  w.carry += dt * Math.min(60, 7 * speed); // more foam the faster you go
  const sin = Math.sin(heading), cos = Math.cos(heading);
  while (w.carry >= 1) {
    w.carry -= 1;
    const i = w.head;
    w.head = (w.head + 1) % w.capacity;
    const j = hash(++w.counter) - 0.5; // sideways jitter across the beam
    w.x[i] = sx + cos * j * beam * 0.7;
    w.z[i] = sz + sin * j * beam * 0.7;
    w.age[i] = 0;
    w.size[i] = beam * 0.5;
  }
}

export const WAKE_LIFETIME = LIFETIME;

export function clearWake(w) {
  w.age.fill(LIFETIME);
  w.carry = 0;
}
