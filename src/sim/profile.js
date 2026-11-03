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

// ---- Backup file: save your progress to a file and load it on another browser or device.
// The file is plain JSON, validated on load (size, app tag, version) and passed through sanitizeProfile.
export const EXPORT_APP = 'bluewater-captain';
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 200 * 1024;

export function exportProfile(profile, now = Date.now()) {
  return JSON.stringify({ app: EXPORT_APP, exportVersion: EXPORT_VERSION, exportedAt: now, profile: sanitizeProfile(profile) }, null, 2);
}

// Returns { ok: true, profile } or { ok: false, error } (error is a sentence for the player).
export function importProfile(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'The file is too large to be a Bluewater Captain backup.' };
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'The file is not valid JSON.' }; }
  if (!raw || raw.app !== EXPORT_APP) return { ok: false, error: 'This is not a Bluewater Captain backup file.' };
  if (raw.exportVersion !== EXPORT_VERSION) return { ok: false, error: 'This backup comes from a different version of the game.' };
  const p = raw.profile;
  if (!p || typeof p !== 'object' || ![1, 2, PROFILE_VERSION].includes(p.version)) return { ok: false, error: 'The saved progress inside the file is missing or too old to read.' };
  return { ok: true, profile: sanitizeProfile(p) };
}

// One line for the confirmation step: what you are about to load.
export function describeProfile(p) {
  const licenses = Object.values(p.licenses).filter((l) => l.held).length;
  const plays = Object.values(p.completed).reduce((a, c) => a + c.plays, 0);
  return `${p.credits} credits, reputation ${p.reputation}, ${licenses} license${licenses === 1 ? '' : 's'}, ${plays} job${plays === 1 ? '' : 's'} completed`;
}
