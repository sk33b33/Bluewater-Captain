// Sound design as numbers: how engine pitch, water noise, wind and event sounds follow the boat and the weather.
// Pure functions so the mapping is testable; src/audio.js turns them into Web Audio.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Idle pitch of the engine by vessel (Hz): small boats buzz high, ships rumble low.
export function idlePitch(vessel) {
  return clamp(95 - 18 * Math.log10(Math.max(1, vessel.massTonnes)), 18, 95);
}

// Engine: pitch and loudness rise with load (throttle or speed, whichever is bigger).
export function engineParams(vessel, throttle, speed) {
  const load = clamp(Math.max(Math.abs(throttle), speed / vessel.maxSpeed), 0, 1);
  const base = idlePitch(vessel);
  return {
    load,
    freq: base * (1 + 1.1 * load),
    gain: 0.035 + 0.11 * load,
    cutoff: 260 + 900 * load,
  };
}

// Water rushing past the hull and wave slap: louder and brighter with speed and wave height.
export function waterParams(vessel, speed, waveHs) {
  const f = clamp(speed / vessel.maxSpeed, 0, 1);
  return { gain: 0.015 + 0.13 * f + 0.02 * clamp(waveHs, 0, 3), cutoff: 500 + 2600 * f };
}

// Wind in the rigging: speed in m/s.
export function windParams(windSpeed) {
  const w = clamp(windSpeed / 14, 0, 1);
  return { gain: 0.01 + 0.1 * w * w, cutoff: 350 + 1500 * w };
}

// A collision: a thump whose size follows the impact speed (m/s). Returns { gain, seconds }.
export function impactParams(impact) {
  const k = clamp((Number.isFinite(impact) ? impact : 1) / 8, 0.05, 1);
  return { gain: 0.15 + 0.5 * k, seconds: 0.18 + 0.5 * k };
}

// Horn pitch by vessel size (Hz): bigger ships have deeper horns.
export function hornPitch(vessel) {
  return clamp(300 - 55 * Math.log10(Math.max(1, vessel.massTonnes)), 60, 300);
}

// The volume the player's setting asks for: a squared curve so the slider feels even.
export function masterLevel(volume, muted) {
  return muted ? 0 : clamp(volume, 0, 1) ** 2;
}
