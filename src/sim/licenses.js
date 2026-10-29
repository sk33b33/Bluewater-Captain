// License rules: requirements, mission/vessel access, exam fee and judging. Pure logic.
import { LICENSES, getLicense, TRAINING_VESSELS } from '../data/licenses.js';
import { getMission } from '../data/missions.js';

export function emptyLicenseState() {
  return { held: false, heldAt: null, grandfathered: false, written: { attempts: 0, bestScore: 0, passed: false }, practical: { attempts: 0, bestScore: 0, passed: false } };
}

export function licenseState(profile, id) {
  return profile.licenses[id] || emptyLicenseState();
}

function ensureState(profile, id) {
  if (!profile.licenses[id]) profile.licenses[id] = emptyLicenseState();
  return profile.licenses[id];
}

export const isHeld = (profile, id) => !!(profile.licenses[id] && profile.licenses[id].held);

// Everything the Licenses screen and the gates need to know about one license.
export function evaluateLicense(profile, lic) {
  const st = licenseState(profile, lic.id);
  const held = st.held;
  const reqs = [];
  for (const id of lic.prerequisites.licenses) {
    reqs.push({ group: 'unlock', label: `Hold the ${getLicense(id).name}`, met: held || isHeld(profile, id) });
  }
  if (lic.prerequisites.reputation > 0) {
    reqs.push({ group: 'unlock', label: `Reputation ${lic.prerequisites.reputation} or more (you have ${profile.reputation})`, met: held || profile.reputation >= lic.prerequisites.reputation });
  }
  const unlocked = reqs.every((r) => r.met);
  for (const t of lic.training) {
    const best = profile.completed[t.mission] ? profile.completed[t.mission].bestScore : null;
    reqs.push({ group: 'training', label: `Training: ${getMission(t.mission).title}, score ${t.minScore} or more${best === null ? '' : ` (best ${best})`}`, met: held || (best !== null && best >= t.minScore) });
  }
  if (lic.written) reqs.push({ group: 'written', label: `Written test: ${lic.written.passMark} of ${lic.written.questions} correct`, met: held || st.written.passed });
  if (lic.exam) reqs.push({ group: 'exam', label: `Practical exam: score ${lic.exam.minScore} or more, at most ${lic.exam.maxCollisions} collisions`, met: held || st.practical.passed });

  const trainingDone = reqs.filter((r) => r.group === 'training').every((r) => r.met);
  const writtenDone = !lic.written || held || st.written.passed;
  const blockers = [];
  if (!unlocked) blockers.push('Meet the prerequisites first');
  if (!trainingDone) blockers.push('Finish the training tasks');
  if (!writtenDone) blockers.push('Pass the written test');
  if (lic.exam && profile.credits < lic.exam.fee) blockers.push(`Exam fee is ${lic.exam.fee} credits (you have ${profile.credits})`);
  return {
    id: lic.id,
    status: held ? 'held' : unlocked ? 'available' : 'locked',
    requirements: reqs,
    unlocked,
    trainingDone,
    canWritten: !held && unlocked && !!lic.written,
    canPractical: !held && !!lic.exam && blockers.length === 0,
    practicalBlockers: held ? [] : lic.exam ? blockers : ['Exam not available yet'],
    comingSoon: lic.comingSoon,
    state: st,
  };
}

export function permittedClasses(profile) {
  const set = new Set();
  for (const lic of LICENSES) if (isHeld(profile, lic.id)) lic.permits.forEach((c) => set.add(c));
  return set;
}

// Vessel gate used by missions now and by vessel selection in a later stage.
export function canUseVessel(profile, vesselClass, { training = false } = {}) {
  if (training && TRAINING_VESSELS.includes(vesselClass)) return true;
  return permittedClasses(profile).has(vesselClass);
}

// Can the player start this mission right now? { ok, reason }
export function missionAccess(profile, mission) {
  if (mission.kind === 'training') return { ok: true, reason: '' };
  const lic = getLicense(mission.license);
  if (mission.kind === 'contract') {
    if (!isHeld(profile, lic.id)) return { ok: false, reason: `Requires the ${lic.name}. Earn it on the Licenses screen.` };
    if (!canUseVessel(profile, mission.vesselClass)) return { ok: false, reason: `Your licenses do not permit this vessel class.` };
    return { ok: true, reason: '' };
  }
  const ev = evaluateLicense(profile, lic);
  if (ev.status === 'held') return { ok: false, reason: `You already hold the ${lic.name}.` };
  if (!ev.canPractical) return { ok: false, reason: ev.practicalBlockers.join('. ') + '.' };
  return { ok: true, reason: '' };
}

export function examFor(mission) {
  const lic = getLicense(mission.license);
  return lic && lic.exam && lic.exam.mission === mission.id ? { lic, exam: lic.exam } : null;
}

// Charge the fee and count the attempt. Fee is not refunded if the player aborts or fails.
export function startExam(profile, mission) {
  const ex = examFor(mission);
  if (!ex) return { ok: false, reason: 'Not an exam.' };
  const access = missionAccess(profile, mission);
  if (!access.ok) return access;
  profile.credits -= ex.exam.fee;
  ensureState(profile, ex.lic.id).practical.attempts += 1;
  return { ok: true, reason: '' };
}

// Pass/fail with the reasons shown to the player.
export function judgeExam(run, result, exam) {
  const checks = [
    { ok: result.total >= exam.minScore, label: `Score ${result.total} (pass mark ${exam.minScore})` },
    { ok: run.collisions <= exam.maxCollisions, label: `${run.collisions} damaging collision${run.collisions === 1 ? '' : 's'} (limit ${exam.maxCollisions})` },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

// Apply a finished exam to the profile. Returns { awarded }.
export function applyExamOutcome(profile, lic, result, judged, now = Date.now()) {
  const st = ensureState(profile, lic.id);
  st.practical.bestScore = Math.max(st.practical.bestScore, result.total);
  if (!judged.passed || st.held) return { awarded: false };
  st.practical.passed = true;
  st.held = true;
  st.heldAt = now;
  profile.reputation += lic.bonus.reputation;
  profile.xp += lic.bonus.xp;
  return { awarded: true };
}

export function recordWritten(profile, licId, outcome) {
  const st = ensureState(profile, licId);
  st.written.attempts += 1;
  st.written.bestScore = Math.max(st.written.bestScore, outcome.correct);
  if (outcome.passed) st.written.passed = true;
  return st;
}

const TIPS = {
  Safety: 'Ease off before obstacles. Contact above 1 m/s damages the hull, so reverse (S) to brake early.',
  Navigation: 'Each respawn costs points. Follow the yellow beams and keep clear of piers, buoys and islands.',
  Timing: 'Hold a steady cruising speed between gates. Only slow down for the berth.',
  Docking: 'Approach slowly and in line with the pier. Get under 3 knots, then reverse to stop inside the green box.',
};

// Up to two tips for the weakest categories (below 80%). Empty list means a clean run.
export function coachingTips(result) {
  return result.categories
    .filter((c) => c.points / c.max < 0.8 && TIPS[c.name])
    .sort((a, b) => a.points / a.max - b.points / b.max)
    .slice(0, 2)
    .map((c) => `${c.name}: ${TIPS[c.name]}`);
}
