// The navigation chart: markers (nodes) and the safe legs between them. Routes between ports are paths through
// this graph. A leg's length and clearance are computed from the real obstacles (see sim/routes.js).
// radius: how close counts as "reached"; spread: half-width of the buoy gate across the route.
export const NODES = [
  { id: 'H', name: 'Harbor entrance', x: -600, z: 50 },
  { id: 'A', name: 'Open water', x: -100, z: 150, radius: 35 },
  { id: 'P', name: 'Landing approach', x: 290, z: 275 },
  { id: 'G', name: 'Gull channel', x: 250, z: -60 },
  { id: 'N', name: 'Pine north', x: 800, z: -80 },
  { id: 'SN', name: 'Seal north', x: 1450, z: -150 },
  { id: 'SGW', name: 'Seal gap west', x: 1380, z: 105, spread: 9 },
  { id: 'SGE', name: 'Seal gap east', x: 1620, z: 105, spread: 9 },
  { id: 'SS', name: 'Seal south', x: 1500, z: 450 },
  { id: 'CO', name: 'Cape offing', x: 2100, z: 200 },
  { id: 'C', name: 'Cape approach', x: 2400, z: 285 },
  { id: 'W1', name: 'West passage', x: 150, z: 900 },
  { id: 'W2', name: 'Marina offing', x: 420, z: 1700 },
  { id: 'S', name: 'Marina approach', x: 420, z: 2400 },
  { id: 'R1', name: 'Reef east', x: 1400, z: 1100 },
  { id: 'R2', name: 'Reef south', x: 1000, z: 1900 },
  { id: 'T1', name: 'Tern north', x: 2300, z: 1000 },
  { id: 'TW', name: 'Tern west', x: 1950, z: 1500 },
  // The deep-water channel: wide, dredged, and clear of the shoals. Only ships need it.
  { id: 'CT', name: 'Terminal approach', x: 2150, z: 488, radius: 50, spread: 45 },
  { id: 'CW', name: 'Channel west', x: 1500, z: 520, radius: 50, spread: 45 },
  { id: 'DS1', name: 'Reef channel', x: 1500, z: 1500, radius: 50, spread: 45 },
  { id: 'DS2', name: 'Driftwood channel north', x: 2300, z: 1760, radius: 50, spread: 45 },
  { id: 'DT', name: 'Tern northwest', x: 1550, z: 1000, radius: 50, spread: 45 },
  { id: 'TE', name: 'Tern east', x: 2600, z: 1500, radius: 50, spread: 45 },
  { id: 'D', name: 'Driftwood approach', x: 2269, z: 2050, radius: 50, spread: 45 },
];

export const EDGES = [
  ['H', 'A'], ['H', 'G'], ['A', 'G'], ['A', 'P'], ['G', 'P'],
  ['A', 'W1'], ['P', 'W1'], ['W1', 'W2'], ['W2', 'S'],
  ['G', 'N'],
  ['N', 'SN'], ['N', 'SGW'], ['N', 'SS'],
  ['SGW', 'SGE'], ['SN', 'CO'], ['SGE', 'CO'], ['SS', 'CO'],
  ['CO', 'C'],
  ['SS', 'R1'], ['R1', 'R2'], ['R2', 'S'], ['W2', 'R2'],
  ['CO', 'T1'], ['T1', 'TW'], ['TW', 'R2'], ['T1', 'R1'],
  ['CT', 'CW'], ['CW', 'DS1'], ['CW', 'DT'], ['DS1', 'DS2'], ['DS2', 'D'], ['DT', 'TE'], ['TE', 'D'], ['DS1', 'R1'],
];
