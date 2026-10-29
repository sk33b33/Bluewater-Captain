// Mission and berth definitions (data-driven). Coordinates in metres, see sim/world.js.
// Heading 0 = north, clockwise; a berth's heading is the pier's long axis (docking accepts either direction).
// kind: training (open to all) | contract (needs a license) | exam (earns a license).
// vesselClasses: which classes may be used; the player picks among those their licenses permit.
// planned: true means fromPort/toPort name ports and the player plans the route on the chart; start, dock,
// waypoints and deadline are filled in below from the default (shortest) route. minReputation gates far jobs.
// weather: id from data/weather.js. Deadlines are for the skiff in calm weather and scale with vessel and sea.
import { ROUTE, SPAWN } from '../sim/world.js';
import { BERTHS, PORTS } from './ports.js';
import { shortestRoute } from '../sim/routes.js';

export { BERTHS };

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

// The Coastal Skipper exam is a fixed course (exams are not route-planning exercises).
const EXAM_TO_PINE = [
  { name: 'Harbor exit', x: -600, z: 50, radius: 30 },
  { name: 'Open water', x: -100, z: 150, radius: 35 },
  { name: 'Landing approach', x: 290, z: 275, radius: 30 },
];

export const MISSIONS = [
  {
    id: 'supply-run',
    kind: 'contract', planned: true, fromPort: 'harbor', toPort: 'pine',
    license: 'small-craft-permit',
    vesselClasses: ALL,
    title: 'Pine Isle Supply Run',
    summary: 'Carry harbor supplies to the landing on Pine Isle and tie up at the pier. Any vessel you are licensed for will do.',
    cargo: 'Harbor supplies (12 crates)',
    reward: 600, rep: 5, xp: 100, risk: 'Low',
    weather: 'breezy',
  },
  {
    id: 'return-run',
    kind: 'contract', planned: true, fromPort: 'pine', toPort: 'harbor',
    license: 'small-craft-permit',
    vesselClasses: ALL,
    title: 'Island Produce Return',
    summary: 'Pick up island produce at Pine Isle and bring it back to the Harbor Pier, with fog about. Any vessel you are licensed for will do.',
    cargo: 'Island produce (8 crates)',
    reward: 650, rep: 5, xp: 100, risk: 'Low',
    weather: 'foggy',
  },
  {
    id: 'workboat-haul',
    kind: 'contract', planned: true, fromPort: 'harbor', toPort: 'pine',
    license: 'small-craft-permit',
    vesselClasses: ['workboat'],
    title: 'Heavy Gear Haul',
    summary: 'Move a pallet of heavy harbor gear to Pine Isle. Too much for a skiff: this job needs a workboat.',
    cargo: 'Heavy gear (4 t)',
    reward: 800, rep: 6, xp: 120, risk: 'Medium',
    weather: 'choppy',
  },
  {
    id: 'passenger-shuttle',
    kind: 'contract', planned: true, fromPort: 'pine', toPort: 'harbor',
    license: 'small-craft-permit',
    vesselClasses: ['coastal-passenger'],
    title: 'Pine Isle Passenger Shuttle',
    summary: 'Bring 24 passengers back from Pine Isle to the Harbor Pier. A passenger craft is required, and passengers expect a careful docking.',
    cargo: 'Passengers (24)',
    reward: 900, rep: 7, xp: 140, risk: 'Medium',
    weather: 'breezy',
  },
  {
    id: 'cape-parcels',
    kind: 'contract', planned: true, fromPort: 'harbor', toPort: 'cape',
    license: 'small-craft-permit', minReputation: 5,
    vesselClasses: ALL,
    title: 'Cape Quay Parcel Run',
    summary: 'Take parcels across the bay to the commercial quay on the east coast. A long passage: choose your route on the chart, and watch for the narrow gap between the Seal Rocks.',
    cargo: 'Parcels and mail (30 bags)',
    reward: 1300, rep: 8, xp: 160, risk: 'Medium',
    weather: 'breezy',
  },
  {
    id: 'island-hop',
    kind: 'contract', planned: true, fromPort: 'pine', toPort: 'southgate',
    license: 'small-craft-permit', minReputation: 5,
    vesselClasses: ['small-motorboat', 'workboat'],
    title: 'Island Hop to Southgate',
    summary: 'Run mail from Pine Isle down the west side of the bay to the marina on the south coast. The marina has a slow zone and takes vessels up to 12 m only.',
    cargo: 'Island mail (10 bags)',
    reward: 1100, rep: 7, xp: 130, risk: 'Medium',
    weather: 'calm',
  },
  {
    id: 'marina-mail',
    kind: 'contract', planned: true, fromPort: 'southgate', toPort: 'harbor',
    license: 'small-craft-permit', minReputation: 5,
    vesselClasses: ['small-motorboat', 'workboat'],
    title: 'Marina Mail Run',
    summary: 'Bring the marina mail back up the coast to Bluewater Harbor.',
    cargo: 'Marina mail (14 bags)',
    reward: 1200, rep: 7, xp: 130, risk: 'Low',
    weather: 'breezy',
  },
  {
    id: 'marina-fuel',
    kind: 'contract', planned: true, fromPort: 'harbor', toPort: 'southgate',
    license: 'small-craft-permit', minReputation: 8,
    vesselClasses: ['workboat'],
    title: 'Marina Fuel Delivery',
    summary: 'Deliver fuel drums to Southgate Marina. Heavy cargo for a workboat, and the marina slow zone is strictly enforced.',
    cargo: 'Fuel drums (12 t)',
    reward: 1500, rep: 9, xp: 170, risk: 'Medium',
    weather: 'choppy',
  },
  {
    id: 'quay-passengers',
    kind: 'contract', planned: true, fromPort: 'cape', toPort: 'pine',
    license: 'small-craft-permit', minReputation: 10,
    vesselClasses: ['coastal-passenger'],
    title: 'Quay to Island Passenger Run',
    summary: 'Carry 30 passengers from Cape Quay across the bay to Pine Isle. Only a passenger craft will do, and passengers expect a smooth ride.',
    cargo: 'Passengers (30)',
    reward: 1600, rep: 10, xp: 190, risk: 'Medium',
    weather: 'calm',
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
    waypoints: EXAM_TO_PINE,
    dock: 'pine',
  },
];

// Fill in what a planned mission derives from its ports: names, start pose, berth and the default
// (shortest) route with its deadline. The player may replace the route on the chart (see sim/routes.js planMission).
for (const m of MISSIONS) {
  if (!m.planned) continue;
  const from = PORTS[m.fromPort], to = PORTS[m.toPort];
  const route = shortestRoute(m.fromPort, m.toPort);
  m.from = from.name;
  m.to = to.name;
  m.start = from.start;
  m.dock = to.berth;
  m.waypoints = route.waypoints;
  m.deadline = route.deadline;
  m.routeName = route.name;
  m.routeId = route.id;
  m.routeLength = route.length;
}

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
