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
    summary: 'Navigation marks, tides and currents, docking under pressure.',
    prerequisites: { licenses: ['small-craft-permit'], reputation: 10 },
    training: [],
    written: null,
    exam: null,
    permits: ['workboat', 'coastal-passenger'],
    unlocks: ['Workboats and coastal passenger craft (arrive with Stage 4 vessels)'],
    bonus: { reputation: 10, xp: 200 },
    comingSoon: 'Its exam and training arrive in a later stage. The prerequisites listed above are already enforced.',
  },
];

export function getLicense(id) {
  return LICENSES.find((l) => l.id === id) || null;
}
