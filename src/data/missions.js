// Mission and berth definitions (data-driven). Coordinates in metres, see sim/world.js.
// Heading 0 = north, clockwise; a berth's heading is the pier's long axis (docking accepts either direction).
import { ROUTE, SPAWN } from '../sim/world.js';

export const BERTHS = {
  harbor: { name: 'Harbor Pier berth', cx: -740, cz: 162.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  pine: { name: 'Pine Isle Landing berth', cx: 385, cz: 262.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
};

const REQUIRES = { vessel: 'Harbor Skiff', license: 'None yet (licenses arrive in a later stage)' };
const WEATHER = 'Calm, light breeze, good visibility';

export const MISSIONS = [
  {
    id: 'supply-run',
    title: 'Pine Isle Supply Run',
    summary: 'Carry harbor supplies to the landing on Pine Isle and tie up at the pier.',
    from: 'Bluewater Harbor',
    to: 'Pine Isle Landing',
    cargo: 'Harbor supplies (12 crates)',
    deadline: 210,
    reward: 600,
    rep: 5,
    xp: 100,
    risk: 'Low',
    requires: REQUIRES,
    weather: WEATHER,
    start: { x: -740, z: 162.5, heading: Math.PI / 2 },
    waypoints: [
      { name: 'Harbor exit', x: -600, z: 50, radius: 30 },
      { name: 'Open water', x: -100, z: 150, radius: 35 },
      { name: 'Landing approach', x: 290, z: 275, radius: 30 },
    ],
    dock: 'pine',
  },
  {
    id: 'return-run',
    title: 'Island Produce Return',
    summary: 'Pick up island produce at Pine Isle and bring it back to the Harbor Pier.',
    from: 'Pine Isle Landing',
    to: 'Bluewater Harbor',
    cargo: 'Island produce (8 crates)',
    deadline: 210,
    reward: 650,
    rep: 5,
    xp: 100,
    risk: 'Low',
    requires: REQUIRES,
    weather: WEATHER,
    start: { x: 385, z: 262.5, heading: (3 * Math.PI) / 2 },
    waypoints: [
      { name: 'Clear the landing', x: 300, z: 285, radius: 30 },
      { name: 'Open water', x: -100, z: 150, radius: 35 },
      { name: 'Harbor mouth', x: -640, z: 50, radius: 30 },
      { name: 'Inner basin', x: -690, z: 175, radius: 25, spread: 8 },
    ],
    dock: 'harbor',
  },
  {
    id: 'training-loop',
    title: 'Coastal Training Loop',
    summary: 'Sail the marked buoy course around the islands. No cargo and no docking.',
    from: 'Bluewater Harbor',
    to: 'Open water',
    cargo: 'None (training)',
    deadline: 300,
    reward: 150,
    rep: 1,
    xp: 30,
    risk: 'None',
    requires: REQUIRES,
    weather: WEATHER,
    start: { x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading },
    waypoints: ROUTE,
    dock: null,
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

// Positions of the two buoys that mark waypoint i (a gate across the route).
export function gateBuoys(waypoints, i) {
  const cp = waypoints[i];
  const prev = waypoints[Math.max(i - 1, 0)];
  const next = waypoints[Math.min(i + 1, waypoints.length - 1)];
  let dx = next.x - prev.x;
  let dz = next.z - prev.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const spread = cp.spread ?? 18;
  const px = -dz * spread;
  const pz = dx * spread;
  return [
    { x: cp.x + px, z: cp.z + pz },
    { x: cp.x - px, z: cp.z - pz },
  ];
}
