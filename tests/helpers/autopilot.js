// Scripted captain used by the tests: steers to each waypoint, then eases into the berth.
// Works for any vessel and wind, so tests can prove each mission is completable with each vessel.
import { createVesselState, stepVessel } from '../../src/sim/vessel.js';
import { staticObstacles, resolveCollisions, shoalsFor } from '../../src/sim/world.js';
import { BERTHS } from '../../src/data/missions.js';
import { createRun, stepRun, applyImpact, PORT_ZONES, zoneAt } from '../../src/sim/mission.js';
import { windVector } from '../../src/sim/wind.js';
import { windAt, seaEffect } from '../../src/sim/weather.js';
import { getWeather } from '../../src/data/weather.js';

const DT = 1 / 60;

// A steppable scripted captain. Pass `run`, `s` (vessel state) and `tick` to resume from a saved state.
export function createPilot(mission, vessel, { weather = getWeather(mission.weather), run: run0, s: s0, tick: tick0 = 0 } = {}) {
  const run = run0 || createRun(mission, vessel);
  const s = s0 || createVesselState(mission.start.x, mission.start.z, mission.start.heading);
  const obs = [...staticObstacles(), ...shoalsFor(vessel)];
  const sea = seaEffect(weather, vessel);
  const dockB = mission.dock ? BERTHS[mission.dock] : null;
  const cruise = vessel.length > 40 ? vessel.maxSpeed * 0.8 : Math.min(8, vessel.maxSpeed * sea.speedFactor * 0.8);
  const pilot = {
    run, s, events: [], tick: tick0,
    get done() { return run.phase === 'complete' || run.phase === 'failed'; },
    get time() { return pilot.tick * DT; },
    step() {
      const i = pilot.tick++;
      // Follow the line from the previous mark (or the start) to the next one, aiming a little ahead on it,
      // so the boat passes through the middle of each gate instead of cutting the corner.
      let vt;
      let from, to;
      if (run.phase === 'docking') {
        from = mission.waypoints[mission.waypoints.length - 1];
        to = { x: dockB.cx, z: dockB.cz };
        const dist = Math.hypot(to.x - s.x, to.z - s.z);
        const slow = Math.max(45, vessel.length * 3);
        vt = dist > slow ? cruise * 0.75 : Math.max(0.6, dist * (45 / slow) * 0.1);
      } else {
        const idx = run.route.next;
        from = idx === 0 ? mission.start : mission.waypoints[idx - 1];
        to = mission.waypoints[idx];
        vt = cruise;
      }
      const zone = zoneAt(s, PORT_ZONES);
      if (zone) vt = Math.min(vt, zone.limit * 0.9); // keep to the port speed limit
      const sx = to.x - from.x, sz = to.z - from.z;
      const segLen = Math.hypot(sx, sz) || 1;
      const t = Math.max(0, Math.min(1, ((s.x - from.x) * sx + (s.z - from.z) * sz) / (segLen * segLen)));
      const ahead = Math.min(vessel.length * 2.5, segLen * (1 - t));
      const tx = from.x + sx * t + (sx / segLen) * ahead;
      const tz = from.z + sz * t + (sz / segLen) * ahead;
      const want = Math.atan2(tx - s.x, -(tz - s.z));
      // Big ships slide sideways in turns, so steer by the track over the water, not the bow direction.
      const course = vessel.length > 40 && Math.hypot(s.u, s.v) > 1 ? s.heading + Math.atan2(s.v, Math.max(0.5, s.u)) : s.heading;
      const err = Math.atan2(Math.sin(want - course), Math.cos(want - course));
      const speed = Math.hypot(s.u, s.v);
      const target = Math.abs(err) > 0.7 ? Math.min(vt, 3) : vt;
      const throttle = Math.max(-1, Math.min(1, (target - speed) * 0.6));
      // Steer toward the aim point; big, slow-turning ships also damp against their own turn rate to avoid overshooting.
      const damp = vessel.length > 40 ? (s.r / vessel.maxYawRate) * 2.2 : 0;
      let steer = Math.max(-1, Math.min(1, err * (vessel.length > 40 ? 1.6 : 2.5) - damp));
      // Cargo jobs: keep the helm gentle enough that sideways acceleration (speed x turn rate) stays under the cargo limit.
      if (run.cargoLimit) {
        const authority = Math.min(1, Math.max(0.2, Math.abs(s.u) / vessel.yawRefSpeed));
        const cap = Math.min(1, (run.cargoLimit * 0.85) / (Math.max(1, Math.abs(s.u)) * vessel.maxYawRate * authority));
        steer = Math.max(-cap, Math.min(cap, steer));
      }
      stepVessel(s, { throttle, steer }, vessel, DT, windVector(windAt(weather, i * DT)), sea);
      const col = resolveCollisions(s, vessel, obs);
      if (col.hit) { const e = applyImpact(run, col.impact, vessel.hullStrength); if (e) pilot.events.push(e); }
      pilot.events.push(...stepRun(run, s, DT, BERTHS));
    },
  };
  return pilot;
}

export function autopilot(mission, vessel, { weather = getWeather(mission.weather), maxSeconds = 1500 } = {}) {
  const pilot = createPilot(mission, vessel, { weather });
  while (!pilot.done && pilot.tick < 60 * maxSeconds) pilot.step();
  return { run: pilot.run, s: pilot.s, events: pilot.events };
}
