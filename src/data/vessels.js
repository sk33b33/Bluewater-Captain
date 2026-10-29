// Vessel classes. Every number below changes how the boat drives; none is cosmetic.
// Speeds in m/s, accelerations in m/s^2, rates in rad/s or 1/s, dimensions in metres.
//  maxSpeed / maxReverse  top speed ahead / astern at full throttle
//  thrustAccel / reverseAccel  push at full throttle ahead / astern (reverse is weaker on heavy boats)
//  linearResistance   low-speed drag: lower means the boat coasts further
//  maxYawRate, yawRefSpeed, yawResponse, rudderResponse  turning authority and how quickly it builds
//  lateralDamping     how fast sideways slip dies away (low = slides more in turns)
//  windage            leeway: sideways/downwind drift in m/s per m/s of wind
//  hullRadius, hullStrength  collision size and damage taken per hit (lower = tougher)
//  deadlineFactor     mission deadlines are written for the skiff; slower vessels get proportionally more time
export const VESSELS = [
  {
    id: 'small-motorboat',
    class: 'small-motorboat',
    name: 'Harbor Skiff',
    blurb: 'Light, quick and nimble. Turns on a dime but gets pushed around by the wind.',
    length: 6.5, beam: 2.4, draft: 0.5, massTonnes: 1.5,
    maxSpeed: 14, maxReverse: 4, thrustAccel: 3.5, reverseAccel: 3.5, linearResistance: 0.05,
    maxYawRate: 0.9, yawRefSpeed: 5, yawResponse: 2.2, rudderResponse: 3.0, throttleResponse: 1.6, lateralDamping: 1.4,
    hullRadius: 1.4, hullStrength: 1.0, windage: 0.03, deadlineFactor: 1.0, cameraDistance: 16,
    look: { hull: 0xe8eef2, stripe: 0xc0392b, cabin: 0x2d3e50, roof: 0xe8eef2 },
  },
  {
    id: 'workboat',
    class: 'workboat',
    name: 'Harbor Workboat',
    blurb: 'Heavy, tough and steady. Slow to turn and slow to stop, but shrugs off wind and bumps.',
    length: 11, beam: 3.8, draft: 1.2, massTonnes: 14,
    maxSpeed: 9, maxReverse: 3, thrustAccel: 1.6, reverseAccel: 1.1, linearResistance: 0.03,
    maxYawRate: 0.55, yawRefSpeed: 4, yawResponse: 1.1, rudderResponse: 2.0, throttleResponse: 1.0, lateralDamping: 2.0,
    hullRadius: 2.0, hullStrength: 0.55, windage: 0.012, deadlineFactor: 1.3, cameraDistance: 24,
    look: { hull: 0xd8a02f, stripe: 0x2c3e50, cabin: 0xf2f2f2, roof: 0x2c3e50 },
  },
  {
    id: 'coastal-passenger',
    class: 'coastal-passenger',
    name: 'Coastal Cat',
    blurb: 'Long passenger craft. Fast in a straight line, wide to turn, takes a long time to stop and catches a lot of wind.',
    length: 15, beam: 5.2, draft: 1.0, massTonnes: 22,
    maxSpeed: 11, maxReverse: 3, thrustAccel: 2.0, reverseAccel: 0.75, linearResistance: 0.025,
    maxYawRate: 0.42, yawRefSpeed: 5, yawResponse: 0.8, rudderResponse: 1.8, throttleResponse: 0.9, lateralDamping: 1.0,
    hullRadius: 2.5, hullStrength: 0.8, windage: 0.07, deadlineFactor: 1.1, cameraDistance: 28,
    look: { hull: 0xf2f2f2, stripe: 0x1f6fb2, cabin: 0x9fd3f5, roof: 0xf2f2f2 },
  },
];

export const DEFAULT_VESSEL = 'small-motorboat';

export function getVessel(id) {
  return VESSELS.find((v) => v.id === id) || null;
}

export function vesselForClass(cls) {
  return VESSELS.find((v) => v.class === cls) || null;
}
