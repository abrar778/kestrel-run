// Kestrel Run — the valley: ground height, the river, the runway, the trees,
// and the chase-view projection that turns world points into screen points.
// One job: everything about where the world is and how it is seen.

import { RUNWAY, WORLD } from './config.js';

// A small deterministic random generator, so the valley is the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261126);

// The river meanders down the valley, roughly north-south.
export function riverXAt(z) {
  return 430 * Math.sin(z * 0.00085) + 250 * Math.sin(z * 0.0021 + 2.0) - 120;
}

export const RIVER_HALF_WIDTH = 20;

// Rolling hills: layered sines give ridges that run across the valley.
export function hillHeight(x, z) {
  return (
    26 * Math.sin(x * 0.0038 + 1.7) * Math.cos(z * 0.0026) +
    14 * Math.sin(x * 0.011 + z * 0.0046 + 0.6) +
    9 * Math.sin(z * 0.012 + 0.4) * Math.cos(x * 0.006) +
    5 * Math.sin(x * 0.021 - z * 0.017)
  );
}

// Ground height at a world point. The airfield is flattened to the runway
// elevation and the river carves a shallow valley down to the water.
export function groundHeight(x, z) {
  let h = hillHeight(x, z);
  // River valley: dip toward the water near the river's line.
  const riverDistance = Math.abs(x - riverXAt(z));
  const valley = Math.max(0, 1 - riverDistance / 260);
  h = h * (1 - valley * 0.85) + 2.5 * valley;
  // Airfield: flat ground around the runway so takeoffs and landings are fair.
  // The flat corridor runs a long way past both runway ends along the
  // departure path, so a pilot who levels off after takeoff has room to
  // climb before the hills rise; the ring course sits over this valley floor.
  const airfieldX = Math.max(0, 1 - Math.abs(x - RUNWAY.x) / 700);
  const airfieldZ = Math.max(0, 1 - Math.max(0, Math.max(RUNWAY.zStart - 1500 - z, z - (RUNWAY.zEnd + 1500))) / 320);
  const flat = Math.min(airfieldX, airfieldZ);
  h = h * (1 - flat) + RUNWAY.elevation * flat;
  return Math.max(0, h);
}

// True when a world point is on the runway strip.
export function onRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 &&
    z >= RUNWAY.zStart &&
    z <= RUNWAY.zEnd
  );
}

// Distance from the runway centreline, for landing quality.
export function runwayOffset(x) {
  return Math.abs(x - RUNWAY.x);
}

// Trees, placed once with the seeded generator, kept off the runway and river.
export const TREES = (() => {
  const trees = [];
  let guard = 0;
  while (trees.length < WORLD.treeCount && guard < 4000) {
    guard += 1;
    const x = WORLD.minX + rng() * (WORLD.maxX - WORLD.minX);
    const z = WORLD.minZ + rng() * (WORLD.maxZ - WORLD.minZ);
    if (onRunway(x, z)) continue;
    if (Math.abs(x - RUNWAY.x) < 90 && z > RUNWAY.zStart - 400 && z < RUNWAY.zEnd + 400) continue;
    if (Math.abs(x - riverXAt(z)) < RIVER_HALF_WIDTH + 14) continue;
    const h = groundHeight(x, z);
    trees.push({ x, z, h, size: 7 + rng() * 9, shade: rng() });
  }
  return trees;
})();

// ---------------------------------------------------------------------------
// Chase-view projection. The camera sits at the plane and looks along its
// heading; the view direction also pitches with the plane and rolls with it.
// project() returns screen coordinates (already rolled around the centre) and
// a perspective scale, or null when the point is behind the camera.
// ---------------------------------------------------------------------------

export function makeCamera(plane, width, height) {
  return {
    x: plane.x,
    z: plane.z,
    alt: plane.alt,
    heading: plane.heading,
    pitch: plane.pitch,
    roll: plane.roll,
    width,
    height,
    cx: width / 2,
    cy: height * 0.46,
    focal: height * 0.92,
  };
}

// Rotate a screen point around the view centre by the bank angle.
function applyRoll(camera, sx, sy) {
  const cos = Math.cos(-camera.roll);
  const sin = Math.sin(-camera.roll);
  const dx = sx - camera.cx;
  const dy = sy - camera.cy;
  return {
    x: camera.cx + dx * cos - dy * sin,
    y: camera.cy + dx * sin + dy * cos,
  };
}

export function projectPoint(camera, x, y, z) {
  const dx = x - camera.x;
  const dz = z - camera.z;
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  const forward = dx * sinH + dz * cosH;
  if (forward < 3) return null;
  const right = dx * cosH - dz * sinH;
  const horizonY = camera.cy + camera.pitch * camera.focal;
  const sx = camera.cx + (right / forward) * camera.focal;
  const sy = horizonY - ((y - camera.alt) / forward) * camera.focal;
  const rolled = applyRoll(camera, sx, sy);
  return { x: rolled.x, y: rolled.y, scale: camera.focal / forward, forward };
}

// The horizon silhouette: for each screen column, the far terrain height
// along that column's view direction, projected to a screen row.
export function horizonRow(camera, screenX, farDistance) {
  const angle = Math.atan2(screenX - camera.cx, camera.focal);
  const dirHeading = camera.heading + angle;
  const farX = camera.x + Math.sin(dirHeading) * farDistance;
  const farZ = camera.z + Math.cos(dirHeading) * farDistance;
  const farY = groundHeight(farX, farZ);
  const horizonY = camera.cy + camera.pitch * camera.focal;
  const sy = horizonY - ((farY - camera.alt) / farDistance) * camera.focal;
  const rolled = applyRoll(camera, screenX, sy);
  return rolled.y;
}

// A ground colour for a point, blended toward haze with distance.
export function groundColourAt(x, z, distance) {
  const h = groundHeight(x, z);
  // Valleys read darker, ridges lighter.
  const t = Math.max(0, Math.min(1, h / 45));
  const near = [0x79, 0xa9, 0x4b];
  const ridge = [0x6d, 0x9a, 0x44];
  const valley = [0x5d, 0x8f, 0x3e];
  const base = t > 0.5 ? ridge : valley;
  const other = t > 0.5 ? near : near;
  const mix = t > 0.5 ? (t - 0.5) * 2 : t * 2;
  const r = Math.round(base[0] + (other[0] - base[0]) * mix);
  const g = Math.round(base[1] + (other[1] - base[1]) * mix);
  const b = Math.round(base[2] + (other[2] - base[2]) * mix);
  // Haze with distance.
  const haze = Math.max(0, Math.min(0.75, distance / 1600));
  const hr = Math.round(r + (0xd8 - r) * haze);
  const hg = Math.round(g + (0xe6 - g) * haze);
  const hb = Math.round(b + (0xd2 - b) * haze);
  return (hr << 16) | (hg << 8) | hb;
}
