// Kestrel Run — shared tuning, colours and world constants.
// One job: every number the rest of the game agrees on lives here.

export const GAME_NAME = 'Kestrel Run';
export const GAME_TITLE = 'KESTREL RUN';
export const GAME_TAGLINE = 'a ridge-running flight rally';

// World units are metres. Display uses knots (speed) and feet (altitude).
export const METRES_TO_KNOTS = 1.94384;
export const METRES_TO_FEET = 3.28084;

// Flight tuning.
export const FLIGHT = {
  maxSpeed: 78, // m/s at full throttle, about 152 kt
  minSpeed: 12, // m/s, below this the wing gives up
  stallSpeed: 22, // m/s, about 43 kt
  cruiseSpeed: 46,
  accelRate: 7, // m/s^2 when the throttle is open
  dragRate: 3.5, // m/s^2 when the throttle is closed
  maxPitch: 0.38, // rad, about 22 degrees
  maxRoll: 0.95, // rad, about 54 degrees
  pitchRate: 1.6, // rad/s toward the commanded pitch
  rollRate: 2.4, // rad/s toward the commanded roll
  maxClimb: 10, // m/s
  maxSink: 13, // m/s
  fuelDrainIdle: 0.0016, // fraction per second
  fuelDrainFull: 0.0018, // extra fraction per second at full throttle
  throttleRate: 0.55, // throttle travel per second
  flapDrag: 6, // extra drag m/s^2 with flaps out
  brakeDrag: 14, // extra drag m/s^2 with the airbrake out
  gearDrag: 2.5, // extra drag m/s^2 with the gear down
  // Landing limits.
  landMaxSink: 3.6, // m/s, harder than this is a hard landing
  landMaxSpeed: 42, // m/s, faster than this is a fast landing
  fieldMaxSpeed: 12, // m/s, the fastest survivable field landing
  fieldMaxSink: 2.0, // m/s, the hardest survivable field landing
};

// Runway: a 600 m grass strip at the airfield, heading north (+z).
export const RUNWAY = {
  x: 0,
  zStart: 200,
  zEnd: 800,
  width: 26,
  heading: 0, // rad, along +z
  elevation: 0,
};

// World bounds the plane may fly in.
export const WORLD = {
  minX: -2600,
  maxX: 2600,
  minZ: -3200,
  maxZ: 12500,
  farDistance: 1500, // m, how far the horizon samples reach
  treeCount: 100,
  ringRadius: 20, // m, target rings
  ringPassRadius: 16, // m, how close to the centre counts as through
};

// One coherent stylised look: warm late-afternoon sky, green valley, amber rings.
export const PALETTE = {
  skyTop: 0x6fb7ef,
  skyMid: 0xa8d4f0,
  skyHorizon: 0xffe0ae,
  sun: 0xffd76a,
  sunGlow: 0xfff2c0,
  cloud: 0xffffff,
  cloudShade: 0xdfeaf2,
  groundNear: 0x79a94b,
  groundMid: 0x8cb85e,
  groundFar: 0xb5cf92,
  groundRidge: 0x6d9a44,
  groundValley: 0x5d8f3e,
  haze: 0xd8e6d2,
  river: 0x4fa8d8,
  riverDeep: 0x2f7fb8,
  riverBank: 0xc9b078,
  runway: 0x8d9299,
  runwayEdge: 0xf2f2ea,
  runwayMark: 0xffffff,
  tree: 0x3d7a33,
  treeDark: 0x2c5c26,
  treeTrunk: 0x6b4a2b,
  ring: 0xffb020,
  ringGlow: 0xffd76a,
  ringPassed: 0x7be36b,
  planeBody: 0xe8542f,
  planeWing: 0xf2f2ea,
  planeTrim: 0x2f3a4a,
  planeGlass: 0x9fd8ef,
  hudAmber: 0xffb020,
  hudGreen: 0x7be36b,
  hudRed: 0xff5a4a,
  hudPanel: 0x141a22,
  hudText: 0xf5f0e1,
};

// Screenshot states (?shot=...). The game reads these in shots.js.
export const SHOT_NAMES = ['cover', 'valley', 'landing', 'menu'];
