import test from 'node:test';
import assert from 'node:assert/strict';
import { VESSELS, getVessel } from '../src/data/vessels.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { MISSIONS, getMission } from '../src/data/missions.js';
import {
  rankFor, costFactor, hullOf, repairCost, repairHull, canPatch, patchHull, recordHull, WRECK_FLOOR, PATCH_LEVEL,
  upgradesOf, upgradePrice, buyUpgrade, applyUpgrades, featuredIds, FEATURED_COUNT,
} from '../src/sim/career.js';
import { defaultProfile, sanitizeProfile, recordResult, importProfile, exportProfile } from '../src/sim/profile.js';
import { createRun, applyImpact, hullNow, scoreRun } from '../src/sim/mission.js';
import { snapshot, sanitizeSnapshot } from '../src/sim/save.js';
import { nextHint, HINTS, EARLY_JOBS } from '../src/sim/hints.js';
import { autopilot, createPilot } from './helpers/autopilot.js';

const skiff = getVessel('small-motorboat');
const ship = getVessel('cargo-ship');
const fresh = (extra = {}) => ({ ...defaultProfile(), ...extra });

test('ranks follow reputation and name the next step', () => {
  assert.equal(rankFor(0).name, 'Deckhand');
  assert.equal(rankFor(15).name, 'Skipper');
  assert.equal(rankFor(200).name, 'Commodore');
  assert.deepEqual(rankFor(4).next, { name: 'Helmsman', needs: 1 });
  assert.equal(rankFor(200).next, null);
});

test('bigger vessels cost more to repair and upgrade, in order', () => {
  const f = VESSELS.map(costFactor);
  assert.equal(f[0], 1);
  for (let i = 1; i < f.length; i++) assert.ok(f[i] >= f[i - 1], 'cost rises with size');
  assert.ok(upgradePrice(UPGRADES[0], ship) > upgradePrice(UPGRADES[0], skiff));
});

test('hull defaults to 100 and is read safely', () => {
  assert.equal(hullOf(fresh(), 'workboat'), 100);
  assert.equal(hullOf({ hull: { workboat: 'x' } }, 'workboat'), 100);
  assert.equal(hullOf({ hull: { workboat: 500 } }, 'workboat'), 100);
});

test('recording a hull keeps damage; a lost vessel is towed in at the wreck floor', () => {
  const p = fresh();
  recordHull(p, skiff.id, 63.27);
  assert.equal(hullOf(p, skiff.id), 63.3);
  recordHull(p, skiff.id, 0, true);
  assert.equal(hullOf(p, skiff.id), WRECK_FLOOR);
  recordHull(p, skiff.id, 0);
  assert.ok(hullOf(p, skiff.id) >= 1, 'never recorded as exactly zero');
});

test('repairs cost credits, partial repairs work, and nothing is charged when the hull is whole', () => {
  const p = fresh({ credits: 100 });
  recordHull(p, skiff.id, 50);
  const full = repairCost(p, skiff);
  assert.equal(full, 200);
  const r = repairHull(p, skiff);
  assert.ok(r.ok);
  assert.equal(p.credits, 0, 'spent what it had');
  assert.equal(hullOf(p, skiff.id), 75, 'partial repair: 100 credits buys 25 percent');
  assert.equal(repairHull(p, skiff).ok, false, 'no credits left');
  p.credits = 5000;
  assert.ok(repairHull(p, skiff).ok);
  assert.equal(hullOf(p, skiff.id), 100);
  assert.equal(p.credits, 5000 - 100);
  const again = repairHull(p, skiff);
  assert.equal(again.ok, false);
  assert.equal(p.credits, 4900);
});

test('a broke player with a wrecked hull gets a free patch, but a solvent one does not', () => {
  const p = fresh({ credits: 0 });
  recordHull(p, skiff.id, 20);
  assert.ok(canPatch(p, skiff));
  assert.ok(patchHull(p, skiff));
  assert.equal(hullOf(p, skiff.id), PATCH_LEVEL);
  assert.equal(canPatch(p, skiff), false, 'only below the patch level');
  const rich = fresh({ credits: 10000 });
  recordHull(rich, skiff.id, 20);
  assert.equal(canPatch(rich, skiff), false);
  assert.equal(patchHull(rich, skiff), false);
});

test('buying an upgrade charges once and cannot be repeated or afforded without credits', () => {
  const p = fresh({ credits: 500 });
  const price = upgradePrice(UPGRADES[1], skiff);
  assert.ok(buyUpgrade(p, skiff, 'hull-plating').ok);
  assert.equal(p.credits, 500 - price);
  assert.deepEqual(upgradesOf(p, skiff.id), ['hull-plating']);
  assert.equal(buyUpgrade(p, skiff, 'hull-plating').ok, false, 'already fitted');
  assert.equal(buyUpgrade(p, skiff, 'engine-tune').ok, false, 'not enough credits left');
  assert.equal(buyUpgrade(p, skiff, 'warp-drive').ok, false, 'unknown upgrade');
  assert.deepEqual(upgradesOf(p, ship.id), [], 'upgrades are per vessel');
});

test('upgrades change the physics numbers without touching the data', () => {
  const before = JSON.stringify(skiff);
  const fast = applyUpgrades(skiff, ['engine-tune', 'hull-plating', 'rudder-kit']);
  assert.ok(fast.thrustAccel > skiff.thrustAccel && fast.maxSpeed > skiff.maxSpeed);
  assert.ok(fast.hullStrength < skiff.hullStrength);
  assert.ok(fast.maxYawRate > skiff.maxYawRate);
  assert.equal(fast.id, skiff.id);
  assert.equal(JSON.stringify(skiff), before, 'source data unchanged');
  assert.deepEqual(applyUpgrades(skiff, ['nonsense']), { ...skiff });
});

test('plating makes the same collision hurt less', () => {
  const m = getMission('dock-drill');
  const a = createRun(m, skiff), b = createRun(m, skiff);
  applyImpact(a, 4, skiff.hullStrength);
  applyImpact(b, 4, applyUpgrades(skiff, ['hull-plating']).hullStrength);
  assert.ok(b.integrity > a.integrity);
});

test('a worn hull is not punished twice in scoring, but real hull decides when you are wrecked', () => {
  const m = getMission('dock-drill');
  const worn = createRun(m, skiff, 40);
  assert.equal(worn.integrity, 100, 'scoring sees only this run');
  assert.equal(hullNow(worn), 40);
  applyImpact(worn, 4, 1);
  assert.equal(hullNow(worn), 40 - (100 - worn.integrity));
  // a hit that would not sink a fresh hull sinks one at 5 percent
  const frail = createRun(m, skiff, 5);
  const e = applyImpact(frail, 4, 1);
  assert.equal(e.type, 'failed');
  assert.equal(frail.failReason, 'hull');
  const fresh100 = createRun(m, skiff, 100);
  assert.equal(applyImpact(fresh100, 4, 1).type, 'damage');
});

test('hull0 survives a save snapshot and is sanitised', () => {
  const m = getMission('dock-drill');
  const run = createRun(m, skiff, 62);
  const pilot = createPilot(m, skiff, { run });
  for (let i = 0; i < 120; i++) pilot.step();
  const snap = snapshot(run, pilot.s, m, pilot.time, 1000);
  assert.equal(snap.run.hull0, 62);
  const back = sanitizeSnapshot(JSON.parse(JSON.stringify(snap)));
  assert.equal(back.run.hull0, 62);
  const old = JSON.parse(JSON.stringify(snap));
  delete old.run.hull0;
  assert.equal(sanitizeSnapshot(old).run.hull0, 100, 'saves from before Stage 8 resume with a whole hull');
  old.run.hull0 = 'lots';
  assert.equal(sanitizeSnapshot(old).run.hull0, 100);
});

test('profile v4: new fields default, v3 profiles migrate, bad data is dropped', () => {
  const v3 = { version: 3, credits: 300, reputation: 7, xp: 5, vessel: 'workboat', completed: {}, licenses: {} };
  const m = sanitizeProfile(v3);
  assert.equal(m.version, 4);
  assert.equal(m.credits, 300);
  assert.deepEqual(m.hull, {});
  assert.deepEqual(m.upgrades, {});
  assert.equal(m.jobs, 0);
  const dirty = sanitizeProfile({ version: 4, hull: { workboat: 40, 'death-star': 10, 'small-motorboat': 'x', 'cargo-ship': 9999 }, upgrades: { workboat: ['hull-plating', 'hull-plating', 'laser'], ghost: ['engine-tune'] }, jobs: -4.7, hintsSeen: ['a', 3, 'a', 'x'.repeat(100)] });
  assert.deepEqual(dirty.hull, { workboat: 40, 'cargo-ship': 100 });
  assert.deepEqual(dirty.upgrades, { workboat: ['hull-plating'] });
  assert.equal(dirty.jobs, 0);
  assert.equal(dirty.hintsSeen.length, 2);
  assert.equal(sanitizeProfile({ version: 99 }).version, 4, 'unknown versions fall back to a fresh profile');
});

test('backup files carry the new fields and still accept v3 profiles', () => {
  const p = fresh({ credits: 9 });
  recordHull(p, 'workboat', 33);
  p.upgrades = { workboat: ['rudder-kit'] };
  const out = importProfile(exportProfile(p));
  assert.ok(out.ok);
  assert.equal(out.profile.hull.workboat, 33);
  assert.deepEqual(out.profile.upgrades.workboat, ['rudder-kit']);
  const old = JSON.stringify({ app: 'bluewater-captain', exportVersion: 1, profile: { version: 3, credits: 12 } });
  const o = importProfile(old);
  assert.ok(o.ok);
  assert.equal(o.profile.credits, 12);
});

test('finishing a job counts toward the featured rotation', () => {
  const p = fresh();
  const res = { reward: 10, reputation: 1, xp: 1, total: 50, grade: 'C', time: 100 };
  recordResult(p, 'supply-run', res);
  recordResult(p, 'supply-run', res);
  assert.equal(p.jobs, 2);
});

test('featured contracts: a stable, bounded pick from the open list that rotates as you play', () => {
  const open = MISSIONS.filter((m) => m.kind === 'contract').map((m) => m.id);
  const a = featuredIds({ jobs: 0 }, open);
  assert.equal(a.length, FEATURED_COUNT);
  assert.deepEqual(featuredIds({ jobs: 0 }, open), a, 'same state, same pick');
  assert.ok(a.every((id) => open.includes(id)));
  assert.equal(new Set(a).size, a.length);
  const seen = new Set();
  for (let j = 0; j < 40; j++) featuredIds({ jobs: j }, open).forEach((id) => seen.add(id));
  assert.ok(seen.size >= Math.floor(open.length * 0.6), `rotation reaches most contracts (${seen.size}/${open.length})`);
  assert.deepEqual(featuredIds({ jobs: 3 }, []), []);
  assert.deepEqual(featuredIds({ jobs: 3 }, ['only']), ['only']);
});

test('heavy-weather contracts exist, are rough, pay more than their calm twins and are gated', () => {
  const storms = MISSIONS.filter((m) => m.storm);
  assert.ok(storms.length >= 2);
  for (const s of storms) {
    const calm = MISSIONS.find((m) => !m.storm && m.fromPort === s.fromPort && m.toPort === s.toPort && m.vesselClasses.some((c) => s.vesselClasses.includes(c)));
    assert.ok(calm, `${s.id} has a normal twin`);
    assert.ok(s.reward > calm.reward, `${s.id} pays more`);
    assert.ok(['rough', 'choppy'].includes(s.weather));
    assert.ok((s.minReputation || 0) >= (calm.minReputation || 0));
    assert.equal(s.kind, 'contract');
  }
});

test('storm contracts are completable by the scripted captain with their vessels', () => {
  for (const s of MISSIONS.filter((m) => m.storm)) {
    for (const cls of s.vesselClasses) {
      const v = VESSELS.find((x) => x.class === cls);
      const r = autopilot(s, v);
      assert.equal(r.run.phase, 'complete', `${s.id} with ${v.name}`);
      assert.ok(scoreRun(r.run).total > 40, `${s.id} scores something`);
    }
  }
});

test('a fully upgraded vessel is still completable on the hardest storm job', () => {
  const s = getMission('storm-haul');
  const v = applyUpgrades(getVessel('workboat'), UPGRADES.map((u) => u.id));
  const r = autopilot(s, v);
  assert.equal(r.run.phase, 'complete');
});

test('hints: each shows when its situation arises, early ones stop after a few jobs', () => {
  const base = { jobs: 0, time: 0, speed: 0, steered: false, throttled: false, phase: 'underway', cargo: false, weatherId: 'calm', damaged: false };
  assert.equal(nextHint([], base), null, 'nothing at the very start');
  assert.equal(nextHint([], { ...base, time: 6 }).id, 'throttle');
  assert.equal(nextHint(['throttle'], { ...base, time: 6 }), null, 'only once');
  assert.equal(nextHint([], { ...base, time: 6, throttled: true }), null);
  assert.equal(nextHint([], { ...base, time: 13, speed: 5, throttled: true }).id, 'steer');
  assert.equal(nextHint([], { ...base, phase: 'docking', speed: 5, throttled: true, steered: true }).id, 'brake');
  assert.equal(nextHint([], { ...base, time: 7, cargo: true, throttled: true, steered: true }).id, 'cargo');
  assert.equal(nextHint([], { ...base, time: 7, weatherId: 'rough', throttled: true, steered: true }).id, 'weather');
  assert.equal(nextHint([], { ...base, damaged: true, throttled: true, steered: true }).id, 'hull');
  assert.equal(nextHint([], { ...base, jobs: EARLY_JOBS, time: 6 }), null, 'basic hints stop for experienced captains');
  assert.equal(nextHint([], { ...base, jobs: 50, damaged: true }).id, 'hull', 'situational hints still show');
  assert.equal(new Set(HINTS.map((h) => h.id)).size, HINTS.length, 'unique ids');
  assert.ok(HINTS.every((h) => h.text.length > 10 && h.text.length < 120), 'short enough for the banner');
});
