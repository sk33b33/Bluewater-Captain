import test from 'node:test';
import assert from 'node:assert/strict';
import { LICENSES, getLicense, VESSEL_CLASSES } from '../src/data/licenses.js';
import { MISSIONS, getMission } from '../src/data/missions.js';
import { SMALL_CRAFT_QUESTIONS } from '../src/data/quiz.js';
import { pickQuestions, scoreQuiz } from '../src/sim/quiz.js';
import { createRun } from '../src/sim/mission.js';
import { defaultProfile, sanitizeProfile, loadProfile, saveProfile, recordResult } from '../src/sim/profile.js';
import { evaluateLicense, missionAccess, canUseVessel, classUsableForMission, permittedClasses, startExam, judgeExam, applyExamOutcome, recordWritten, coachingTips, examFor, isHeld } from '../src/sim/licenses.js';

const permit = getLicense('small-craft-permit');
const skipper = getLicense('coastal-skipper');
const exam = getMission('small-craft-exam');
const supply = getMission('supply-run');
const loop = getMission('training-loop');
const drill = getMission('dock-drill');

function done(p, id, score = 80, grade = 'B') {
  recordResult(p, id, { reward: 0, reputation: 0, xp: 0, total: score, grade, time: 100 });
}
// A profile that has finished training and the written test, with fee money.
function ready() {
  const p = defaultProfile();
  done(p, 'training-loop');
  done(p, 'dock-drill');
  recordWritten(p, permit.id, { correct: 5, passed: true });
  p.credits = 150;
  return p;
}
const fakeResult = (total, cats = []) => ({ total, categories: cats });

// ---- data integrity
test('every license references real missions and vessel classes', () => {
  for (const l of LICENSES) {
    for (const t of l.training) assert.ok(getMission(t.mission), `${l.id} training ${t.mission}`);
    if (l.exam) { const m = getMission(l.exam.mission); assert.ok(m && m.kind === 'exam' && m.license === l.id); }
    for (const c of l.permits) assert.ok(VESSEL_CLASSES[c], c);
    for (const id of l.prerequisites.licenses) assert.ok(getLicense(id));
  }
  for (const m of MISSIONS) {
    assert.ok(['training', 'contract', 'exam'].includes(m.kind), m.id);
    if (m.kind !== 'training') assert.ok(getLicense(m.license), `${m.id} license`);
    for (const c of m.vesselClasses) assert.ok(VESSEL_CLASSES[c], `${m.id} class ${c}`);
  }
});

test('next-tier license is represented in data with prerequisites enforced', () => {
  assert.deepEqual(skipper.prerequisites.licenses, ['small-craft-permit']);
  const p = defaultProfile();
  assert.equal(evaluateLicense(p, skipper).status, 'locked');
  p.licenses['small-craft-permit'] = { held: true, heldAt: 1, grandfathered: false, written: {}, practical: {} };
  assert.equal(evaluateLicense(p, skipper).status, 'locked', 'reputation still short');
  p.reputation = 10;
  const ev = evaluateLicense(p, skipper);
  assert.equal(ev.status, 'available');
  assert.equal(ev.canPractical, false, 'training, written test and fee still missing');
  assert.ok(ev.practicalBlockers.some((b) => /training/i.test(b)));
});

// ---- requirements
test('fresh profile: permit is available, nothing met, practical blocked with reasons', () => {
  const ev = evaluateLicense(defaultProfile(), permit);
  assert.equal(ev.status, 'available');
  assert.equal(ev.canWritten, true);
  assert.equal(ev.canPractical, false);
  assert.ok(ev.practicalBlockers.some((b) => /training/i.test(b)));
  assert.ok(ev.practicalBlockers.some((b) => /written/i.test(b)));
  assert.ok(ev.practicalBlockers.some((b) => /fee/i.test(b)));
  assert.ok(ev.requirements.every((r) => !r.met));
});

test('training counts only when the best score reaches the minimum', () => {
  const p = defaultProfile();
  done(p, 'training-loop', 40, 'D');
  assert.equal(evaluateLicense(p, permit).trainingDone, false);
  done(p, 'training-loop', 55, 'C');
  done(p, 'dock-drill', 60, 'C');
  assert.equal(evaluateLicense(p, permit).trainingDone, true);
});

test('practical exam opens only with training + written test + fee', () => {
  const p = ready();
  assert.equal(evaluateLicense(p, permit).canPractical, true);
  p.credits = 99;
  assert.equal(evaluateLicense(p, permit).canPractical, false, 'fee short');
  p.credits = 150;
  p.licenses[permit.id].written.passed = false;
  assert.equal(evaluateLicense(p, permit).canPractical, false, 'written not passed');
});

// ---- access and permissions
test('training is open to all; contracts and exam are gated', () => {
  const p = defaultProfile();
  assert.equal(missionAccess(p, loop).ok, true);
  assert.equal(missionAccess(p, drill).ok, true);
  const c = missionAccess(p, supply);
  assert.equal(c.ok, false);
  assert.match(c.reason, /Small Craft Permit/);
  assert.equal(missionAccess(p, exam).ok, false);
  assert.equal(missionAccess(ready(), exam).ok, true);
});

test('vessel permissions follow the licenses held', () => {
  const p = defaultProfile();
  assert.equal(canUseVessel(p, 'small-motorboat'), false);
  assert.equal(classUsableForMission(p, loop, 'small-motorboat'), true, 'training uses the skiff under instruction');
  assert.equal(classUsableForMission(p, supply, 'small-motorboat'), false, 'but not for contracts');
  assert.equal(classUsableForMission(p, getMission('workboat-trials'), 'workboat'), false, 'workboat trials locked until Skipper prerequisites');
  p.licenses[permit.id] = { held: true };
  assert.equal(canUseVessel(p, 'small-motorboat'), true);
  assert.equal(canUseVessel(p, 'workboat'), false, 'next tier not held');
  assert.deepEqual([...permittedClasses(p)], ['small-motorboat']);
});

// ---- exam fee, judging, outcomes (the stage gate)
test('starting an exam charges the fee once and counts the attempt', () => {
  const p = ready();
  const r = startExam(p, exam);
  assert.equal(r.ok, true);
  assert.equal(p.credits, 50);
  assert.equal(p.licenses[permit.id].practical.attempts, 1);
  assert.equal(startExam(p, exam).ok, false, 'cannot start again with 50 credits');
  assert.equal(p.credits, 50);
  assert.equal(startExam(defaultProfile(), supply).ok, false, 'not an exam');
  assert.ok(examFor(exam));
});

test('judgeExam: needs both the score and the collision limit', () => {
  const run = createRun(exam);
  assert.equal(judgeExam(run, fakeResult(85), permit.exam).passed, true);
  assert.equal(judgeExam(run, fakeResult(69), permit.exam).passed, false);
  run.collisions = 3;
  const j = judgeExam(run, fakeResult(95), permit.exam);
  assert.equal(j.passed, false);
  assert.equal(j.checks[0].ok, true);
  assert.equal(j.checks[1].ok, false);
});

test('GATE: passing the exam awards the license, unlocks contracts and vessel access, pays the bonus', () => {
  const p = ready();
  startExam(p, exam);
  const rep0 = p.reputation, xp0 = p.xp;
  assert.equal(missionAccess(p, supply).ok, false);
  const run = createRun(exam);
  const j = judgeExam(run, fakeResult(88), permit.exam);
  const out = applyExamOutcome(p, permit, fakeResult(88), j, 1234);
  assert.equal(out.awarded, true);
  assert.equal(isHeld(p, permit.id), true);
  assert.equal(p.licenses[permit.id].heldAt, 1234);
  assert.equal(p.reputation, rep0 + permit.bonus.reputation);
  assert.equal(p.xp, xp0 + permit.bonus.xp);
  assert.equal(missionAccess(p, supply).ok, true);
  assert.equal(canUseVessel(p, 'small-motorboat'), true);
  assert.equal(missionAccess(p, exam).ok, false, 'cannot re-sit a held exam');
  assert.equal(applyExamOutcome(p, permit, fakeResult(99), j, 99).awarded, false, 'no double bonus');
  assert.equal(p.reputation, rep0 + permit.bonus.reputation);
});

test('GATE: failing the exam changes nothing but the attempt count and best score; a retake costs another fee', () => {
  const p = ready();
  p.credits = 250;
  startExam(p, exam);
  const run = createRun(exam);
  const j = judgeExam(run, fakeResult(60), permit.exam);
  const out = applyExamOutcome(p, permit, fakeResult(60), j);
  assert.equal(out.awarded, false);
  assert.equal(isHeld(p, permit.id), false);
  assert.equal(missionAccess(p, supply).ok, false, 'contracts stay locked');
  assert.equal(canUseVessel(p, 'small-motorboat'), false);
  assert.equal(p.licenses[permit.id].practical.bestScore, 60);
  assert.equal(p.licenses[permit.id].practical.attempts, 1);
  assert.equal(p.credits, 150);
  assert.equal(startExam(p, exam).ok, true, 'retake allowed');
  assert.equal(p.credits, 50);
  assert.equal(p.licenses[permit.id].practical.attempts, 2);
});

// ---- written test
test('quiz: draws the requested count, no duplicates, answers stay correct after shuffling', () => {
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const qs = pickQuestions(SMALL_CRAFT_QUESTIONS, 5, rng);
  assert.equal(qs.length, 5);
  assert.equal(new Set(qs.map((q) => q.id)).size, 5);
  for (const q of qs) {
    const orig = SMALL_CRAFT_QUESTIONS.find((o) => o.id === q.id);
    assert.equal(q.options[q.answer], orig.options[orig.answer]);
    assert.equal(new Set(q.options).size, q.options.length);
  }
});

test('quiz data: every question is well formed', () => {
  assert.ok(SMALL_CRAFT_QUESTIONS.length >= permit.written.questions + 3, 'enough pool for variety');
  for (const q of SMALL_CRAFT_QUESTIONS) {
    assert.ok(q.options.length >= 3 && q.answer >= 0 && q.answer < q.options.length && q.explain.length > 10, q.id);
  }
});

test('quiz scoring: pass mark 4 of 5, wrong answers listed, blanks are wrong', () => {
  const qs = pickQuestions(SMALL_CRAFT_QUESTIONS, 5, () => 0.3);
  const right = qs.map((q) => q.answer);
  assert.deepEqual(scoreQuiz(qs, right, 4), { correct: 5, total: 5, wrong: [], passed: true });
  const one = right.slice(); one[2] = (qs[2].answer + 1) % qs[2].options.length;
  const r1 = scoreQuiz(qs, one, 4);
  assert.equal(r1.correct, 4); assert.equal(r1.passed, true); assert.deepEqual(r1.wrong, [2]);
  const blank = scoreQuiz(qs, [right[0], right[1], right[2]], 4);
  assert.equal(blank.passed, false); assert.equal(blank.correct, 3);
});

test('recordWritten keeps attempts and best score, and a pass sticks', () => {
  const p = defaultProfile();
  recordWritten(p, permit.id, { correct: 3, passed: false });
  recordWritten(p, permit.id, { correct: 5, passed: true });
  recordWritten(p, permit.id, { correct: 2, passed: false });
  const w = p.licenses[permit.id].written;
  assert.deepEqual(w, { attempts: 3, bestScore: 5, passed: true });
});

// ---- score feedback
test('coaching: tips for the weakest categories, none for a clean run', () => {
  const clean = fakeResult(100, [{ name: 'Safety', points: 30, max: 30 }, { name: 'Docking', points: 30, max: 30 }]);
  assert.deepEqual(coachingTips(clean), []);
  const messy = fakeResult(50, [{ name: 'Safety', points: 30, max: 30 }, { name: 'Navigation', points: 8, max: 20 }, { name: 'Timing', points: 14, max: 20 }, { name: 'Docking', points: 5, max: 30 }]);
  const tips = coachingTips(messy);
  assert.equal(tips.length, 2);
  assert.match(tips[0], /^Docking:/);
  assert.match(tips[1], /^Navigation:/);
});

// ---- profile save / migration
function store(initial) {
  const m = new Map(initial ? [['bwc-profile', initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('profile v2 round-trips licenses through save and load', () => {
  const st = store();
  const p = ready();
  startExam(p, exam);
  applyExamOutcome(p, permit, fakeResult(90), { passed: true }, 555);
  saveProfile(st, p);
  const q = loadProfile(st);
  assert.equal(q.version, 3);
  assert.equal(isHeld(q, permit.id), true);
  assert.equal(q.licenses[permit.id].heldAt, 555);
  assert.equal(q.licenses[permit.id].practical.attempts, 1);
  assert.equal(q.licenses[permit.id].written.passed, true);
  assert.equal(q.credits, 50);
});

test('migration: a Stage 2 save is kept, and players who ran contracts keep access', () => {
  const v1 = { version: 1, credits: 400, reputation: 7, xp: 120, completed: { 'supply-run': { plays: 2, bestScore: 90, bestGrade: 'S', bestTime: 100 } } };
  const p = loadProfile(store(JSON.stringify(v1)));
  assert.equal(p.version, 3);
  assert.equal(p.credits, 400);
  assert.equal(isHeld(p, 'small-craft-permit'), true);
  assert.equal(p.licenses['small-craft-permit'].grandfathered, true);
  assert.equal(missionAccess(p, supply).ok, true);
  const fresh = loadProfile(store(JSON.stringify({ version: 1, credits: 50, completed: { 'training-loop': { plays: 1, bestScore: 60, bestGrade: 'C', bestTime: 90 } } })));
  assert.equal(isHeld(fresh, 'small-craft-permit'), false, 'training alone does not grandfather');
  assert.equal(fresh.credits, 50);
});

test('hostile license data is sanitized', () => {
  const p = sanitizeProfile({ version: 2, credits: 5, licenses: { x: 5, 'small-craft-permit': { held: 'yes', heldAt: 'never', written: { attempts: -3, bestScore: 'many', passed: 1 }, practical: null } } });
  assert.equal(p.licenses.x, undefined);
  const l = p.licenses['small-craft-permit'];
  assert.equal(l.held, true);
  assert.equal(l.heldAt, null);
  assert.equal(l.written.attempts, 0);
  assert.equal(l.written.bestScore, 0);
  assert.equal(l.practical.attempts, 0);
});
