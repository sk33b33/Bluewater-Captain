// Performance tooling: frame statistics, the automatic quality governor and the benchmark recommendation.
// Pure logic (times are passed in), so it is deterministic and testable without a GPU.
import { QUALITY_ORDER, lowerQuality } from '../data/quality.js';

export function createFrameStats(capacity = 240) {
  const buf = [];
  return {
    push(ms) {
      buf.push(ms);
      if (buf.length > capacity) buf.shift();
    },
    clear() { buf.length = 0; },
    get count() { return buf.length; },
    summary() {
      if (!buf.length) return { fps: 0, avgMs: 0, p95Ms: 0, p99Ms: 0, low1Fps: 0, samples: 0 };
      const sorted = buf.slice().sort((a, b) => a - b);
      const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      return { fps: 1000 / avg, avgMs: avg, p95Ms: at(0.95), p99Ms: at(0.99), low1Fps: 1000 / at(0.99), samples: buf.length };
    },
  };
}

// Watches frame times and says when to drop a quality level. Only ever steps down: stepping back up
// automatically would make quality flicker, so going up is the player's choice.
//   window: ms per judgement; strikes: consecutive slow windows needed; cooldown: ms to settle after a change.
export function createGovernor({ targetFps = 30, windowMs = 2000, strikes = 2, cooldownMs = 6000, ignoreOverMs = 250 } = {}) {
  let sum = 0, n = 0, elapsed = 0, bad = 0, cooldown = 0;
  return {
    // Returns 'down' when quality should drop, else null.
    feed(frameMs) {
      if (frameMs > ignoreOverMs) return null; // tab was hidden or the page was loading: not a real frame
      if (cooldown > 0) { cooldown -= frameMs; return null; }
      sum += frameMs; n += 1; elapsed += frameMs;
      if (elapsed < windowMs) return null;
      const fps = 1000 / (sum / n);
      sum = 0; n = 0; elapsed = 0;
      bad = fps < targetFps ? bad + 1 : 0;
      if (bad >= strikes) { bad = 0; cooldown = cooldownMs; return 'down'; }
      return null;
    },
    reset() { sum = n = elapsed = bad = 0; cooldown = 0; },
  };
}

// results: { low: {avgFps, low1Fps}, medium: {...}, high: {...} } -> best preset the machine handles.
//   comfortable: avg >= 50 and 1% low >= 30. Otherwise playable: avg >= 30. Otherwise the lowest.
export function recommendQuality(results) {
  const order = QUALITY_ORDER.slice().reverse(); // high first
  for (const id of order) {
    const r = results[id];
    if (r && r.avgFps >= 50 && r.low1Fps >= 30) return id;
  }
  for (const id of order) {
    const r = results[id];
    if (r && r.avgFps >= 30) return id;
  }
  return QUALITY_ORDER[0];
}

export { lowerQuality };
