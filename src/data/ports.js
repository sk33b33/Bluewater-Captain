// Ports of Bluewater Bay: berths, approach routes, harbor speed limits and vessel size limits.
// A port's `fairway` is the chart marker where open-sea routes begin and end; `inbound` are the waypoints
// from the fairway to the berth approach (harbor mouths, basins). Departures start at `start`, inside the berth.
export const BERTHS = {
  harborN: { name: 'Harbor Pier north berth', cx: -740, cz: 137.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  pine: { name: 'Pine Isle Landing berth', cx: 385, cz: 262.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  cape: { name: 'Cape Quay berth', cx: 2640, cz: 287.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  southgate: { name: 'Southgate Marina berth', cx: 412.5, cz: 2650, heading: 0, halfLength: 9, halfWidth: 4.5 },
};

// speedLimit: slow zone around the berth, in knots. maxLength: longest vessel the berth takes, in metres.
export const PORTS = {
  harbor: {
    id: 'harbor', name: 'Bluewater Harbor', berth: 'harborN', fairway: 'H',
    start: { x: -740, z: 137.5, heading: Math.PI / 2 },
    inbound: [
      { name: 'Harbor mouth', x: -640, z: 50, radius: 30 },
      { name: 'Inner basin', x: -690, z: 135, radius: 25, spread: 8 },
    ],
    speedLimit: { radius: 170, knots: 14 }, maxLength: 20,
    blurb: 'The home port: a walled harbor on the west coast.',
    beacon: { x: -692, z: 150, color: 0xd9453d },
  },
  pine: {
    id: 'pine', name: 'Pine Isle Landing', berth: 'pine', fairway: 'P',
    start: { x: 385, z: 262.5, heading: (3 * Math.PI) / 2 },
    inbound: [],
    speedLimit: { radius: 120, knots: 14 }, maxLength: 16,
    blurb: 'A small landing on the west side of Pine Isle.',
    beacon: { x: 362, z: 250, color: 0x3fae5a },
  },
  cape: {
    id: 'cape', name: 'Cape Quay', berth: 'cape', fairway: 'C',
    start: { x: 2640, z: 287.5, heading: (3 * Math.PI) / 2 },
    inbound: [],
    speedLimit: { radius: 140, knots: 12 }, maxLength: 30,
    blurb: 'A commercial quay on the east coast. Takes the biggest vessels.',
    beacon: { x: 2602, z: 300, color: 0xf0903a },
  },
  southgate: {
    id: 'southgate', name: 'Southgate Marina', berth: 'southgate', fairway: 'S',
    start: { x: 412.5, z: 2650, heading: 0 },
    inbound: [],
    speedLimit: { radius: 130, knots: 10 }, maxLength: 12,
    blurb: 'A small marina on the south coast. Slow zone, and no vessels over 12 m.',
    beacon: { x: 400, z: 2602, color: 0x3d7bd9 },
  },
};

export function getPort(id) { return PORTS[id] || null; }
export function portByBerth(key) { return Object.values(PORTS).find((p) => p.berth === key) || null; }
export const knotsToMps = (k) => k / 1.943844;

// Slow zones for every port, as circles around the berth.
export function portZones() {
  return Object.values(PORTS).map((p) => ({ port: p.id, name: p.name, x: BERTHS[p.berth].cx, z: BERTHS[p.berth].cz, radius: p.speedLimit.radius, limit: knotsToMps(p.speedLimit.knots), knots: p.speedLimit.knots }));
}
