// Contextual first-time hints: each shows once (remembered in profile.hintsSeen), when the situation first calls for it.
// ctx: { jobs, time, speed, steered, throttled, phase, cargo, weatherId, damaged }
export const HINTS = [
  { id: 'throttle', text: 'Push W, or the throttle lever, to get moving.', early: true, when: (c) => c.time > 5 && !c.throttled },
  { id: 'steer', text: 'Steer with A and D. A boat only turns once it is moving.', early: true, when: (c) => c.time > 12 && c.speed > 3 && !c.steered },
  { id: 'brake', text: 'Too fast for the berth! Boats keep coasting: ease off, or reverse with S to brake.', early: true, when: (c) => c.phase === 'docking' && c.speed > 3 },
  { id: 'cargo', text: 'Cargo job: turn gently. Hard turns at speed shift the load and cost points.', early: false, when: (c) => c.cargo && c.time > 6 },
  { id: 'weather', text: 'Heavy sea: you will be slower and steering is sluggish. Allow more room.', early: false, when: (c) => (c.weatherId === 'rough' || c.weatherId === 'choppy') && c.time > 4 },
  { id: 'fog', text: 'Fog: trust the compass arrow and the distance readout, and keep your speed down.', early: false, when: (c) => c.weatherId === 'foggy' && c.time > 4 },
  { id: 'hull', text: 'Hull damage carries over to your next job. Repair it on the Fleet screen.', early: false, when: (c) => c.damaged },
];

export const EARLY_JOBS = 4; // the basic hints stop appearing once you have finished this many jobs

export function nextHint(seen, ctx) {
  const done = new Set(seen || []);
  for (const h of HINTS) {
    if (done.has(h.id)) continue;
    if (h.early && ctx.jobs >= EARLY_JOBS) continue;
    if (h.when(ctx)) return h;
  }
  return null;
}
