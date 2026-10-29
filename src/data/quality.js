// Graphics presets. The game is built to run on old GPUs (GTX 770 class) in a browser, so every
// expensive thing has a dial.
//   scale/cap    render resolution = min(devicePixelRatio * scale, cap): the biggest lever for fill-rate
//   grid         water mesh segments per side (vertex cost)
//   waves        wave components used (the 4th and shortest is dropped on Low)
//   foam         crest and shore foam strength (0 = off, skips the noise work)
//   wake         particle capacity of the boat's wake (0 = off)
export const QUALITY = {
  low: { id: 'low', name: 'Low', scale: 0.6, cap: 1.0, grid: 160, waves: 3, foam: 0, wake: 0 },
  medium: { id: 'medium', name: 'Medium', scale: 0.85, cap: 1.25, grid: 240, waves: 4, foam: 0.6, wake: 120 },
  high: { id: 'high', name: 'High', scale: 1.0, cap: 2.0, grid: 360, waves: 4, foam: 1, wake: 320 },
};

export const QUALITY_ORDER = ['low', 'medium', 'high']; // lowest to highest
export const AUTO_START = 'medium';

export function getQuality(id) {
  return QUALITY[id] || QUALITY[AUTO_START];
}

export function lowerQuality(id) {
  const i = QUALITY_ORDER.indexOf(id);
  return i > 0 ? QUALITY_ORDER[i - 1] : null;
}

export function pixelRatioFor(q, devicePixelRatio) {
  return Math.min(devicePixelRatio * q.scale, q.cap);
}
