// Ports of Bluewater Bay: berths, approach routes, harbor speed limits and vessel size limits.
// A port's `fairway` is the chart marker where open-sea routes begin and end; `inbound` are the waypoints
// from the fairway to the berth approach (harbor mouths, channels). Departures start at `start`, inside the berth.
// Big ports also have a `deep` variant: a long quay for large vessels with its own fairway, channel and limits.
// A vessel is shown the variant that fits it (see portView): small craft use the small berth, ships the deep one.
export const BERTHS = {
  harborN: { name: 'Harbor Pier north berth', cx: -740, cz: 137.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  pine: { name: 'Pine Isle Landing berth', cx: 385, cz: 262.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  cape: { name: 'Cape Quay berth', cx: 2640, cz: 287.5, heading: Math.PI / 2, halfLength: 9, halfWidth: 4.5 },
  southgate: { name: 'Southgate Marina berth', cx: 412.5, cz: 2650, heading: 0, halfLength: 9, halfWidth: 4.5 },
  // Deep-water terminal berths: 220 m long, 40 m wide; docking is scored against a 40 m offset.
  capeDeep: { name: 'Cape Terminal berth', cx: 2570, cz: 488, heading: Math.PI / 2, halfLength: 110, halfWidth: 20, maxOffset: 40 },
  driftwood: { name: 'Driftwood Terminal berth', cx: 2269, cz: 2480, heading: 0, halfLength: 110, halfWidth: 20, maxOffset: 40 },
};

// speedLimit: slow zone around the berth, in knots. maxLength: longest vessel the berth takes, in metres.
// minLength: shortest vessel (commercial terminals do not take small craft).
export const PORTS = {
  harbor: {
    id: 'harbor', name: 'Bluewater Harbor', berth: 'harborN', fairway: 'H',
    start: { x: -740, z: 137.5, heading: Math.PI / 2 },
    inbound: [
      { name: 'Harbor mouth', x: -640, z: 50, radius: 30 },
      { name: 'Inner basin', x: -690, z: 135, radius: 25, spread: 8 },
    ],
    speedLimit: { radius: 170, knots: 14 }, minLength: 0, maxLength: 20,
    blurb: 'The home port: a walled harbor on the west coast.',
    beacon: { x: -692, z: 150, color: 0xd9453d },
  },
  pine: {
    id: 'pine', name: 'Pine Isle Landing', berth: 'pine', fairway: 'P',
    start: { x: 385, z: 262.5, heading: (3 * Math.PI) / 2 },
    inbound: [],
    speedLimit: { radius: 120, knots: 14 }, minLength: 0, maxLength: 16,
    blurb: 'A small landing on the west side of Pine Isle.',
    beacon: { x: 362, z: 250, color: 0x3fae5a },
  },
  cape: {
    id: 'cape', name: 'Cape Quay', berth: 'cape', fairway: 'C',
    start: { x: 2640, z: 287.5, heading: (3 * Math.PI) / 2 },
    inbound: [],
    speedLimit: { radius: 140, knots: 12 }, minLength: 0, maxLength: 30,
    blurb: 'A commercial quay on the east coast. Small craft use the old pier; ships use the deep-water terminal.',
    beacon: { x: 2602, z: 300, color: 0xf0903a },
    deep: {
      berth: 'capeDeep', fairway: 'CT',
      start: { x: 2570, z: 488, heading: (3 * Math.PI) / 2 },
      inbound: [{ name: 'Terminal channel', x: 2330, z: 488, radius: 45, spread: 45 }],
      speedLimit: { radius: 320, knots: 10 }, minLength: 30, maxLength: 250,
    },
  },
  southgate: {
    id: 'southgate', name: 'Southgate Marina', berth: 'southgate', fairway: 'S',
    start: { x: 412.5, z: 2650, heading: 0 },
    inbound: [],
    speedLimit: { radius: 130, knots: 10 }, minLength: 0, maxLength: 12,
    blurb: 'A small marina on the south coast. Slow zone, and no vessels over 12 m.',
    beacon: { x: 400, z: 2602, color: 0x3d7bd9 },
  },
  driftwood: {
    id: 'driftwood', name: 'Driftwood Terminal', berth: 'driftwood', fairway: 'D',
    start: { x: 2269, z: 2480, heading: 0 },
    inbound: [{ name: 'Terminal channel', x: 2269, z: 2250, radius: 45, spread: 45 }],
    speedLimit: { radius: 320, knots: 10 }, minLength: 30, maxLength: 250,
    blurb: 'A container and bulk terminal in the sheltered south-east bay. Ships of 30 m and up only, with a dredged channel from the north.',
    beacon: { x: 2300, z: 2262, color: 0x9b59b6 },
  },
};

export function getPort(id) { return PORTS[id] || null; }

// The variant of a port that serves this vessel: the deep terminal for ships too long for the small berth.
// With no vessel (or a small one) it is the port itself.
export function portView(portOrId, vessel) {
  const p = typeof portOrId === 'string' ? PORTS[portOrId] : portOrId;
  if (vessel && p.deep && vessel.length > p.maxLength) return { ...p, ...p.deep, id: p.id, name: p.name, blurb: p.blurb, beacon: p.beacon, deep: p.deep, isDeep: true };
  return p;
}

export function portAccepts(portOrId, vessel) {
  const v = portView(portOrId, vessel);
  return vessel.length >= (v.minLength || 0) && vessel.length <= v.maxLength;
}

// Largest vessel the port can ever take (any variant), for messages.
export function portMaxLength(p) { return Math.max(p.maxLength, p.deep ? p.deep.maxLength : 0); }

export function portByBerth(key) {
  return Object.values(PORTS).find((p) => p.berth === key || (p.deep && p.deep.berth === key)) || null;
}
export const knotsToMps = (k) => k / 1.943844;

// Slow zones around every berth (small and deep), as circles.
export function portZones() {
  const out = [];
  for (const p of Object.values(PORTS)) {
    for (const v of [p, p.deep].filter(Boolean)) {
      const b = BERTHS[v.berth];
      out.push({ port: p.id, name: p.name, x: b.cx, z: b.cz, radius: v.speedLimit.radius, limit: knotsToMps(v.speedLimit.knots), knots: v.speedLimit.knots, deep: v === p.deep });
    }
  }
  return out;
}
