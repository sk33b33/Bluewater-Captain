// Career economy: hull wear and repairs, vessel upgrades, featured contracts and ranks.
// Pure functions over the profile so they can be unit tested; the profile fields are
// `hull` ({vesselId: percent}), `upgrades` ({vesselId: [upgradeId]}) and `jobs` (jobs finished, drives the featured rotation).
import { UPGRADES, getUpgrade } from '../data/upgrades.js';

export const REPAIR_RATE = 4;          // credits per hull percent on a 1.0-cost-factor vessel
export const PATCH_LEVEL = 50;         // an emergency patch brings a wrecked hull back to this much
export const WRECK_FLOOR = 20;         // a vessel that is lost on a mission is towed in at this hull level
export const FEATURED_COUNT = 2;
export const FEATURED_BONUS = 1.35;    // reward multiplier on a featured contract

export const RANKS = [
  { min: 0, name: 'Deckhand' },
  { min: 5, name: 'Helmsman' },
  { min: 15, name: 'Skipper' },
  { min: 30, name: 'First Mate' },
  { min: 50, name: 'Captain' },
  { min: 80, name: 'Commodore' },
];

export function rankFor(reputation) {
  let r = RANKS[0];
  for (const x of RANKS) if (reputation >= x.min) r = x;
  const next = RANKS.find((x) => x.min > reputation) || null;
  return { name: r.name, next: next ? { name: next.name, needs: next.min - reputation } : null };
}

// Bigger vessels cost more to repair and upgrade.
export function costFactor(vessel) {
  return Math.max(1, Math.round((Math.pow(vessel.massTonnes, 0.22) / 1.09) * 100) / 100);
}

export function hullOf(profile, vesselId) {
  const h = profile.hull && profile.hull[vesselId];
  return typeof h === 'number' ? Math.min(100, Math.max(0, h)) : 100;
}

export function repairCost(profile, vessel) {
  const missing = 100 - hullOf(profile, vessel.id);
  return Math.ceil(missing * REPAIR_RATE * costFactor(vessel));
}

// Repair as much as the player can afford, up to full. Returns { ok, spent, hull }.
export function repairHull(profile, vessel) {
  const missing = 100 - hullOf(profile, vessel.id);
  if (missing <= 0) return { ok: false, spent: 0, hull: 100, reason: 'The hull is already in perfect shape.' };
  const unit = REPAIR_RATE * costFactor(vessel);
  const percent = Math.min(missing, Math.floor(profile.credits / unit));
  if (percent <= 0) return { ok: false, spent: 0, hull: hullOf(profile, vessel.id), reason: 'You cannot afford any repairs right now.' };
  const spent = Math.ceil(percent * unit);
  profile.credits -= spent;
  profile.hull = { ...(profile.hull || {}), [vessel.id]: hullOf(profile, vessel.id) + percent };
  return { ok: true, spent, hull: profile.hull[vessel.id] };
}

// Never leave the player stuck: a badly damaged hull with no money gets a free patch.
export function canPatch(profile, vessel) {
  return hullOf(profile, vessel.id) < PATCH_LEVEL && profile.credits < repairCost(profile, vessel);
}
export function patchHull(profile, vessel) {
  if (!canPatch(profile, vessel)) return false;
  profile.hull = { ...(profile.hull || {}), [vessel.id]: PATCH_LEVEL };
  return true;
}

// Record what a mission did to the hull. `hullNow` is the final hull percent; `lost` means the vessel was wrecked.
export function recordHull(profile, vesselId, hullNow, lost = false) {
  profile.hull = { ...(profile.hull || {}), [vesselId]: lost ? WRECK_FLOOR : Math.max(1, Math.min(100, Math.round(hullNow * 10) / 10)) };
}

export function upgradesOf(profile, vesselId) {
  const u = profile.upgrades && profile.upgrades[vesselId];
  return Array.isArray(u) ? u.filter((id) => getUpgrade(id)) : [];
}

export function upgradePrice(upgrade, vessel) {
  return Math.round((upgrade.cost * costFactor(vessel)) / 10) * 10;
}

export function buyUpgrade(profile, vessel, upgradeId) {
  const up = getUpgrade(upgradeId);
  if (!up) return { ok: false, reason: 'Unknown upgrade.' };
  if (upgradesOf(profile, vessel.id).includes(upgradeId)) return { ok: false, reason: 'Already fitted.' };
  const price = upgradePrice(up, vessel);
  if (profile.credits < price) return { ok: false, reason: `You need ${price} credits.` };
  profile.credits -= price;
  profile.upgrades = { ...(profile.upgrades || {}), [vessel.id]: [...upgradesOf(profile, vessel.id), upgradeId] };
  return { ok: true, price };
}

// The vessel model with the player's fitted upgrades applied (a new object; the data is never mutated).
export function applyUpgrades(vessel, ids = []) {
  const out = { ...vessel };
  for (const id of ids) {
    const up = getUpgrade(id);
    if (!up) continue;
    for (const [k, m] of Object.entries(up.mult)) if (typeof out[k] === 'number') out[k] = out[k] * m;
  }
  return out;
}

// Featured contracts: a rotating pick of open contracts paying a bonus. The rotation advances with every finished job,
// so the board changes as you play. `open` lists the mission ids the player may start right now.
export function featuredIds(profile, openIds) {
  const ids = [...openIds].sort();
  if (ids.length === 0) return [];
  const n = Math.min(FEATURED_COUNT, ids.length);
  const start = ((profile.jobs || 0) * 7 + 3) % ids.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(ids[(start + i * 5) % ids.length]);
  return [...new Set(out)];
}
