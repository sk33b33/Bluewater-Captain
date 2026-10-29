// Minimal career profile (Stage 2): credits, reputation, XP and best results per mission.
// Versioned so Stage 3 can migrate it. Storage is injected so it can be tested.
const KEY = 'bwc-profile';
export const PROFILE_VERSION = 1;

export function defaultProfile() {
  return { version: PROFILE_VERSION, credits: 0, reputation: 0, xp: 0, completed: {} };
}

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function sanitizeProfile(raw) {
  const p = defaultProfile();
  if (!raw || typeof raw !== 'object' || raw.version !== PROFILE_VERSION) return p;
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
