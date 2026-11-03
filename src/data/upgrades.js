// Vessel upgrades bought with credits. Each one changes how the boat drives (multipliers on the vessel's own numbers).
// `cost` is the base price; career.js scales it by the size of the vessel. Hull plating makes every hit hurt less.
export const UPGRADES = [
  { id: 'engine-tune', name: 'Engine tune-up', cost: 400, blurb: 'More push and a higher top speed. Heavier to stop, so brake earlier.', mult: { thrustAccel: 1.15, maxSpeed: 1.08 } },
  { id: 'hull-plating', name: 'Hull plating', cost: 350, blurb: 'Thicker plates: collisions and groundings do about a quarter less damage.', mult: { hullStrength: 0.75 } },
  { id: 'rudder-kit', name: 'Rudder kit', cost: 300, blurb: 'A bigger rudder: the boat turns faster and answers the helm sooner.', mult: { maxYawRate: 1.12, yawResponse: 1.15, rudderResponse: 1.15 } },
];

export function getUpgrade(id) {
  return UPGRADES.find((u) => u.id === id) || null;
}
