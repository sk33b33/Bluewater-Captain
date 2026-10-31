// Fictional in-game credentials. Not real-world licenses and not legal or safety advice.
export const VESSEL_CLASSES = {
  'small-motorboat': 'Small motorboat',
  workboat: 'Workboat',
  'coastal-passenger': 'Coastal passenger craft',
  tug: 'Tug',
  ferry: 'Ferry',
  'cargo-ship': 'General cargo ship',
  'container-carrier': 'Container carrier',
};

// Vessel classes anyone may use for training missions (sailing under instruction).
export const TRAINING_VESSELS = ['small-motorboat'];

export const LICENSES = [
  {
    id: 'small-craft-permit',
    name: 'Small Craft Permit',
    tier: 1,
    summary: 'Basic handling, safety and docking in sheltered waters.',
    prerequisites: { licenses: [], reputation: 0 },
    training: [
      { mission: 'training-loop', minScore: 50 },
      { mission: 'dock-drill', minScore: 50 },
    ],
    written: { questions: 5, passMark: 4 },
    exam: { mission: 'small-craft-exam', fee: 100, minScore: 70, maxCollisions: 2 },
    permits: ['small-motorboat'],
    unlocks: ['Paid contracts: Pine Isle Supply Run and Island Produce Return', 'The harbor skiff on contracts'],
    bonus: { reputation: 5, xp: 100 },
    comingSoon: null,
  },
  {
    id: 'coastal-skipper',
    name: 'Coastal Skipper',
    tier: 2,
    summary: 'Heavier vessels and passengers: longer stopping distances, wider turns and wind that matters.',
    prerequisites: { licenses: ['small-craft-permit'], reputation: 10 },
    training: [
      { mission: 'workboat-trials', minScore: 50 },
      { mission: 'passenger-trials', minScore: 50 },
    ],
    written: { questions: 5, passMark: 4 },
    exam: { mission: 'coastal-skipper-exam', fee: 250, minScore: 70, maxCollisions: 2 },
    permits: ['workboat', 'coastal-passenger'],
    unlocks: ['The Harbor Workboat and the Coastal Cat passenger craft', 'Contracts that need them: Heavy Gear Haul and Pine Isle Passenger Shuttle'],
    bonus: { reputation: 10, xp: 200 },
    comingSoon: null,
  },
  {
    id: 'large-vessel',
    name: 'Large Vessel Endorsement',
    tier: 3,
    summary: 'Heavy-vessel inertia, deep-water channels and shoals, long berths and cargo that shifts if you turn hard.',
    prerequisites: { licenses: ['coastal-skipper'], reputation: 30 },
    training: [
      { mission: 'cargo-trials', minScore: 50 },
      { mission: 'container-trials', minScore: 50 },
    ],
    written: { questions: 5, passMark: 4 },
    exam: { mission: 'large-vessel-exam', fee: 800, minScore: 70, maxCollisions: 1 },
    permits: ['cargo-ship', 'container-carrier'],
    unlocks: ['The Coastal Freighter and the Feeder Carrier', 'Deep-water contracts between Cape Terminal and Driftwood Terminal'],
    bonus: { reputation: 20, xp: 400 },
    comingSoon: null,
  },
];

export function getLicense(id) {
  return LICENSES.find((l) => l.id === id) || null;
}
