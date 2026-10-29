// Mission and berth definitions (data-driven). Coordinates in metres, see sim/world.js.
// Heading 0 = north, clockwise; a berth's heading is the pier's long axis (docking accepts either direction).
import { ROUTE, SPAWN } from '../sim/world.js';

export const BERTHS = {
  harborN: { name: 'Harbor Pier north berth', cx: -740, cz: 137.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  harbor: { name: 'Harbor Pier berth', cx: -740, cz: 162.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  pine: { name: 'Pine Isle Landing berth', cx: 385, cz: 262.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
};

const WEATHER = 'Calm, light breeze, good visibility';

export const KIND_LABEL = { training: 'Training', contract: 'Contract', exam: 'Exam' };

export const MISSIONS = [
  {
    id: 'supply-run',
    kind: 'contract',
    license: 'small-craft-permit',
    vesselClass: 'small-motorboat',
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
    kind: 'contract',
    license: 'small-craft-permit',
    vesselClass: 'small-motorboat',
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
    kind: 'training',
    license: null,
    vesselClass: 'small-motorboat',
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
    weather: WEATHER,
    start: { x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading },
    waypoints: ROUTE,
    dock: null,
  },
  {
    id: 'dock-drill',
    kind: 'training',
    license: null,
    vesselClass: 'small-motorboat',
    title: 'Harbor Docking Drill',
    summary: 'Practice the skill every contract ends with: slow down, line up with the pier and hold still inside the berth.',
    from: 'Bluewater Harbor',
    to: 'Harbor Pier north berth',
    cargo: 'None (training)',
    deadline: 90,
    reward: 120,
    rep: 1,
    xp: 40,
    risk: 'None',
    weather: WEATHER,
    start: { x: -660, z: 60, heading: Math.PI },
    waypoints: [{ name: 'Practice buoy', x: -690, z: 135, radius: 25, spread: 8 }],
    dock: 'harborN',
  },
  {
    id: 'small-craft-exam',
    kind: 'exam',
    license: 'small-craft-permit',
    vesselClass: 'small-motorboat',
    title: 'Small Craft Permit: Practical Exam',
    summary: 'Leave the harbor, round two marks in open water, return through the harbor mouth and dock at the pier. Pass mark and collision limit are on the briefing.',
    from: 'Bluewater Harbor',
    to: 'Harbor Pier north berth',
    cargo: 'None (examiner aboard)',
    deadline: 180,
    reward: 0,
    rep: 0,
    xp: 0,
    risk: 'Exam',
    weather: WEATHER,
    start: { x: -720, z: 60, heading: Math.PI / 2 },
    waypoints: [
      { name: 'Marker 1', x: -450, z: -40, radius: 30 },
      { name: 'Marker 2', x: -330, z: 170, radius: 30 },
      { name: 'Harbor mouth', x: -640, z: 60, radius: 30 },
      { name: 'Basin mark', x: -690, z: 135, radius: 25, spread: 8 },
    ],
    dock: 'harborN',
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

// Positions of the two buoys that mark waypoint i (a gate across the route).
// `start` gives the first waypoint a direction of travel (and single-waypoint missions their only one).
export function gateBuoys(waypoints, i, start) {
  const cp = waypoints[i];
  const prev = i > 0 ? waypoints[i - 1] : start || cp;
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
