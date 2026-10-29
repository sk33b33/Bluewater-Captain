import { getVessel, DEFAULT_VESSEL } from '../data/vessels.js';

// Career profile: credits, reputation, XP, best results per mission and licenses.
// v1 (Stage 2) had no licenses and v2 (Stage 3) no vessel choice; older saves are migrated on load. Storage is injected so it can be tested.
const KEY = 'bwc-profile';
export const PROFILE_VERSION = 3;
const LEGACY_CONTRACT_IDS = ['supply-run', 'return-run']; // v1 players who ran these keep access to them

export function defaultProfile() {
  return { version: PROFILE_VERSION, credits: 0, reputation: 0, xp: 0, completed: {}, licenses: {}, vessel: DEFAULT_VESSEL };
}

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function sanitizeProfile(raw) {
  const p = defaultProfile();
  if (!raw || typeof raw !== 'object' || (raw.version !== 1 && raw.version !== 2 && raw.version !== PROFILE_VERSION)) return p;
  p.credits = Math.max(0, num(raw.credits));
  p.reputation = Math.max(0, num(raw.reputation));
  p.xp = Math.max(0, num(raw.xp));
  if (raw.completed && typeof raw.completed === 'object') {
    for (const [id, r] of Object.entries(raw.completed)) {
      if (!r || typeof r !== 'object') continue;
      p.completed[id] = {
        plays: Math.max(0, Math.floor(num(r.plays))),
        bestScore: num(r.bestScore),
        bestGrade: typeof r.bestGrade === 'string' ? r.bestGrade.slice(0, 1) : 'D',
        bestTime: num(r.bestTime, null),
      };
    }
  }
  if (typeof raw.vessel === 'string' && getVessel(raw.vessel)) p.vessel = raw.vessel;
  if (raw.version === 1) {
    // Migration: Stage 2 had no licenses. Grant the permit to anyone who already completed a contract run.
    if (LEGACY_CONTRACT_IDS.some((id) => p.completed[id])) {
      p.licenses['small-craft-permit'] = { held: true, heldAt: null, grandfathered: true, written: { attempts: 0, bestScore: 0, passed: true }, practical: { attempts: 0, bestScore: 0, passed: true } };
    }
  } else if (raw.licenses && typeof raw.licenses === 'object') {
    for (const [id, l] of Object.entries(raw.licenses)) {
      if (!l || typeof l !== 'object') continue;
      const part = (x) => ({ attempts: Math.max(0, Math.floor(num(x && x.attempts))), bestScore: Math.max(0, num(x && x.bestScore)), passed: !!(x && x.passed) });
      p.licenses[id] = { held: !!l.held, heldAt: num(l.heldAt, null), grandfathered: !!l.grandfathered, written: part(l.written), practical: part(l.practical) };
    }
  }
  return p;
}

export function loadProfile(storage) {
  try {
    const raw = storage.getItem(KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(storage, profile) {
  try {
    storage.setItem(KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile(storage) {
  try { storage.removeItem(KEY); } catch { /* storage unavailable */ }
  return defaultProfile();
}

const GRADE_ORDER = ['D', 'C', 'B', 'A', 'S'];

export function recordResult(profile, missionId, result) {
  profile.credits += result.reward;
  profile.reputation += result.reputation;
  profile.xp += result.xp;
  const prev = profile.completed[missionId];
  const bestScore = prev ? Math.max(prev.bestScore, result.total) : result.total;
  const bestGrade = prev && GRADE_ORDER.indexOf(prev.bestGrade) > GRADE_ORDER.indexOf(result.grade) ? prev.bestGrade : result.grade;
  const bestTime = prev && prev.bestTime !== null ? Math.min(prev.bestTime, result.time) : result.time;
  profile.completed[missionId] = { plays: (prev ? prev.plays : 0) + 1, bestScore, bestGrade, bestTime };
  return profile;
}

// localStorage that never throws (private windows, blocked storage).
export function safeStorage() {
  try {
    const s = window.localStorage;
    s.getItem(KEY);
    return s;
  } catch {
    const mem = new Map();
    return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
}
