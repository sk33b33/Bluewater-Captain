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
