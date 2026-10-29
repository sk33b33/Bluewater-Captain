// Wave field shared by the simulation (buoyancy) and the water shader.
// Water height interface per docs/TECHNICAL_DESIGN.md: everything asks getWaterHeight().
// Each wave: direction angle (rad), wavelength (m), amplitude (m), speed scale.
export const WAVES = [
  { dir: 0.35, length: 62, amp: 0.45, speed: 1.0 },
  { dir: 1.05, length: 34, amp: 0.22, speed: 1.0 },
  { dir: -0.6, length: 18, amp: 0.1, speed: 1.0 },
];

const G = 9.81;

export function getWaterHeight(x, z, t, waves = WAVES) {
  let h = 0;
  for (const w of waves) {
    const k = (2 * Math.PI) / w.length;
    const omega = Math.sqrt(G * k) * w.speed;
    h += w.amp * Math.sin(k * (Math.cos(w.dir) * x + Math.sin(w.dir) * z) - omega * t);
  }
  return h;
}

// Wave field raised by a weather preset: four components around the wind direction.
// Energy follows significant wave height: sum(amp^2 / 2) = (Hs / 4)^2, so sum(amp^2) = Hs^2 / 8.
// Wave length grows with sea state; nothing is shorter than 14 m so the water mesh can resolve it.
const ENERGY = [0.55, 0.25, 0.15, 0.05];
const LENGTH_FRACTION = [1, 0.55, 0.32, 0.18];
const SPREAD = [0, 0.45, -0.6, 1.0]; // radians away from the wind direction

export function waveSet(weather) {
  const toward = ((weather.fromDeg + 180) * Math.PI) / 180; // heading the wind blows toward
  const base = Math.atan2(-Math.cos(toward), Math.sin(toward)); // as (cos dir, sin dir) in (x east, z south)
  const hs = weather.waveHs;
  return ENERGY.map((e, i) => ({
    dir: base + SPREAD[i],
    length: Math.max(14, (35 + 25 * hs) * LENGTH_FRACTION[i]),
    amp: Math.sqrt((e * hs * hs) / 8),
    speed: 1.0,
  }));
}
