// Mission and berth definitions (data-driven). Coordinates in metres, see sim/world.js.
// Heading 0 = north, clockwise; a berth's heading is the pier's long axis (docking accepts either direction).
// kind: training (open to all) | contract (needs a license) | exam (earns a license).
// vesselClasses: which classes may be used; the player picks among those their licenses permit.
// weather: id from data/weather.js. Deadlines are for the skiff in calm weather and scale with vessel and sea.
import { ROUTE, SPAWN } from '../sim/world.js';

export const BERTHS = {
  harborN: { name: 'Harbor Pier north berth', cx: -740, cz: 137.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  pine: { name: 'Pine Isle Landing berth', cx: 385, cz: 262.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
};

const ALL = ['small-motorboat', 'workboat', 'coastal-passenger'];

export const KIND_LABEL = { training: 'Training', contract: 'Contract', exam: 'Exam' };

// Harbor circuit shared by the permit exam and the vessel trials: two marks, back through the mouth, dock.
const CIRCUIT = [
  { name: 'Marker 1', x: -450, z: -40, radius: 30 },
  { name: 'Marker 2', x: -330, z: 170, radius: 30 },
  { name: 'Harbor mouth', x: -640, z: 60, radius: 30 },
  { name: 'Basin mark', x: -690, z: 135, radius: 25, spread: 8 },
];
const CIRCUIT_START = { x: -720, z: 60, heading: Math.PI / 2 };

const TO_PINE = [
  { name: 'Harbor exit', x: -600, z: 50, radius: 30 },
  { name: 'Open water', x: -100, z: 150, radius: 35 },
  { name: 'Landing approach', x: 290, z: 275, radius: 30 },
];
const TO_HARBOR = [
  { name: 'Clear the landing', x: 300, z: 285, radius: 30 },
  { name: 'Open water', x: -100, z: 150, radius: 35 },
  { name: 'Harbor mouth', x: -640, z: 50, radius: 30 },
  { name: 'Inner basin', x: -690, z: 135, radius: 25, spread: 8 },
];

export const MISSIONS = [
  {
    id: 'supply-run',
    kind: 'contract',
    license: 'small-craft-permit',
    vesselClasses: ALL,
    title: 'Pine Isle Supply Run',
    summary: 'Carry harbor supplies to the landing on Pine Isle and tie up at the pier. Any vessel you are licensed for will do.',
    from: 'Bluewater Harbor',
    to: 'Pine Isle Landing',
    cargo: 'Harbor supplies (12 crates)',
    deadline: 210,
    reward: 600,
    rep: 5,
    xp: 100,
    risk: 'Low',
    weather: 'breezy',
    start: { x: -740, z: 137.5, heading: Math.PI / 2 },
    waypoints: TO_PINE,
    dock: 'pine',
  },
  {
    id: 'return-run',
    kind: 'contract',
    license: 'small-craft-permit',
    vesselClasses: ALL,
    title: 'Island Produce Return',
    summary: 'Pick up island produce at Pine Isle and bring it back to the Harbor Pier. Any vessel you are licensed for will do.',
    from: 'Pine Isle Landing',
    to: 'Bluewater Harbor',
    cargo: 'Island produce (8 crates)',
    deadline: 210,
    reward: 650,
    rep: 5,
    xp: 100,
    risk: 'Low',
    weather: 'foggy',
    start: { x: 385, z: 262.5, heading: (3 * Math.PI) / 2 },
    waypoints: TO_HARBOR,
    dock: 'harborN',
  },
  {
    id: 'workboat-haul',
    kind: 'contract',
    license: 'small-craft-permit',
    vesselClasses: ['workboat'],
    title: 'Heavy Gear Haul',
    summary: 'Move a pallet of heavy harbor gear to Pine Isle. Too much for a skiff: this job needs a workboat.',
    from: 'Bluewater Harbor',
    to: 'Pine Isle Landing',
    cargo: 'Heavy gear (4 t)',
    deadline: 200,
    reward: 800,
    rep: 6,
    xp: 120,
    risk: 'Medium',
    weather: 'choppy',
    start: { x: -740, z: 137.5, heading: Math.PI / 2 },
    waypoints: TO_PINE,
    dock: 'pine',
  },
  {
    id: 'passenger-shuttle',
    kind: 'contract',
    license: 'small-craft-permit',
    vesselClasses: ['coastal-passenger'],
    title: 'Pine Isle Passenger Shuttle',
    summary: 'Bring 24 passengers back from Pine Isle to the Harbor Pier. A passenger craft is required, and passengers expect a careful docking.',
    from: 'Pine Isle Landing',
    to: 'Bluewater Harbor',
    cargo: 'Passengers (24)',
    deadline: 200,
    reward: 900,
    rep: 7,
    xp: 140,
    risk: 'Medium',
    weather: 'breezy',
    start: { x: 385, z: 262.5, heading: (3 * Math.PI) / 2 },
    waypoints: TO_HARBOR,
    dock: 'harborN',
  },
  {
    id: 'training-loop',
    kind: 'training',
    license: null,
    vesselClasses: ['small-motorboat'],
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
    weather: 'calm',
    start: { x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading },
    waypoints: ROUTE,
    dock: null,
  },
  {
    id: 'dock-drill',
    kind: 'training',
    license: null,
    vesselClasses: ['small-motorboat'],
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
    weather: 'calm',
    start: { x: -660, z: 60, heading: Math.PI },
    waypoints: [{ name: 'Practice buoy', x: -690, z: 135, radius: 25, spread: 8 }],
    dock: 'harborN',
  },
  {
    id: 'workboat-trials',
    kind: 'training',
    license: null,
    vesselClasses: ['workboat'],
    title: 'Workboat Sea Trials',
    summary: 'Learn how a heavy workboat turns, slows and docks: it takes more room and more patience than the skiff.',
    from: 'Bluewater Harbor',
    to: 'Harbor Pier north berth',
    cargo: 'None (training)',
    deadline: 160,
    reward: 150,
    rep: 1,
    xp: 40,
    risk: 'None',
    weather: 'breezy',
    start: CIRCUIT_START,
    waypoints: CIRCUIT,
    dock: 'harborN',
  },
  {
    id: 'passenger-trials',
    kind: 'training',
    license: null,
    vesselClasses: ['coastal-passenger'],
    title: 'Passenger Craft Sea Trials',
    summary: 'Get the feel of a long passenger craft: wide turns, long stopping distance and plenty of windage.',
    from: 'Bluewater Harbor',
    to: 'Harbor Pier north berth',
    cargo: 'None (training)',
    deadline: 190,
    reward: 150,
    rep: 1,
    xp: 40,
    risk: 'None',
    weather: 'calm',
    start: CIRCUIT_START,
    waypoints: CIRCUIT,
    dock: 'harborN',
  },
  {
    id: 'small-craft-exam',
    kind: 'exam',
    license: 'small-craft-permit',
    vesselClasses: ['small-motorboat'],
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
    weather: 'calm',
    start: CIRCUIT_START,
    waypoints: CIRCUIT,
    dock: 'harborN',
  },
  {
    id: 'coastal-skipper-exam',
    kind: 'exam',
    license: 'coastal-skipper',
    vesselClasses: ['workboat'],
    title: 'Coastal Skipper: Practical Exam',
    summary: 'Take the workboat out of the harbor, cross open water to Pine Isle and dock at the landing. A heavier boat, a longer passage.',
    from: 'Bluewater Harbor',
    to: 'Pine Isle Landing',
    cargo: 'None (examiner aboard)',
    deadline: 185,
    reward: 0,
    rep: 0,
    xp: 0,
    risk: 'Exam',
    weather: 'choppy',
    start: CIRCUIT_START,
    waypoints: TO_PINE,
    dock: 'pine',
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
