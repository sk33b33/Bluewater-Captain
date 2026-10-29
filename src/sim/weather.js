// Weather in motion: gusts, wind veer, the wave field it raises, and what the sea does to a vessel.
// All of it is a pure function of the preset, the vessel and the clock, so it is deterministic and testable.
import { waveSet } from './waves.js';

// Tunable constants: how hard the sea bites. Change these to rebalance every vessel and mission at once.
export const SEA_TUNING = {
  waveToLength: 0.18, // "one hull-length of sea" = wave height of this fraction of the hull length
  calmThreshold: 0.3, // seas below this fraction of that are harmless (calm water costs nothing)
  speedLoss: 0.18, // top-speed fraction lost per unit of severity
  steerLoss: 0.15, // steering authority lost per unit of severity
  maxSeverity: 1.7, // cap, so even a skiff in a storm stays controllable
};

// Wind now: speed in m/s and the direction it blows from. Gusts and veer are slow sine sums (deterministic).
export function windAt(weather, t) {
  const base = weather.windKnots / 1.943844;
  const g = 0.5 * Math.sin(0.37 * t) + 0.3 * Math.sin(0.91 * t + 1.3) + 0.2 * Math.sin(2.3 * t + 0.4); // -1..1
  const speed = Math.max(0, base * (1 + weather.gust * g));
  const fromDeg = weather.fromDeg + weather.veerDeg * Math.sin(0.11 * t + 0.7);
  return { fromDeg, speed };
}

// Sea effect on one vessel. Severity compares wave height with the hull length, ignoring small waves.
export function seaEffect(weather, vessel) {
  const rel = weather.waveHs / (vessel.length * SEA_TUNING.waveToLength);
  const severity = Math.min(SEA_TUNING.maxSeverity, Math.max(0, rel - SEA_TUNING.calmThreshold) / (1 - SEA_TUNING.calmThreshold));
  return {
    severity,
    speedFactor: 1 - SEA_TUNING.speedLoss * severity,
    steerFactor: 1 - SEA_TUNING.steerLoss * severity,
  };
}

export const NO_SEA = { severity: 0, speedFactor: 1, steerFactor: 1 };

// Mission deadlines are written for the skiff in calm weather. Slower vessels and rougher seas get more time.
export function deadlineFor(mission, vessel, weather) {
  const sea = seaEffect(weather, vessel);
  return Math.round((mission.deadline * vessel.deadlineFactor) / sea.speedFactor);
}

export function waveSetFor(weather, count = 4) {
  return waveSet(weather).slice(0, count);
}

const pct = (x) => `${Math.round(x * 100)}%`;

export function forecastText(weather) {
  const kn = Math.round(weather.windKnots);
  const vis = weather.visibility >= 1000 ? `${(weather.visibility / 1000).toFixed(0)} km` : `${weather.visibility} m`;
  return `${weather.name}: wind ${kn} kn gusting ${Math.round(kn * (1 + weather.gust))} kn from the north-west, waves ${weather.waveHs.toFixed(1)} m, visibility ${vis}.`;
}

export function seaEffectText(weather, vessel) {
  const s = seaEffect(weather, vessel);
  if (s.severity < 0.05) return `No noticeable sea effect on the ${vessel.name}.`;
  return `On the ${vessel.name}: top speed ${pct(s.speedFactor - 1)}, steering ${pct(s.steerFactor - 1)}.`;
}
