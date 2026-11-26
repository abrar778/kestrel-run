// Kestrel Run — screenshot states. The ?shot= query puts the game into a
// chosen moment so a screenshot is a real render of a good flight, not a
// lucky frame. The states are fixed, so the shots are reproducible.
// One job: set the scene up for each named screenshot.

import { RUNWAY } from './config.js';
import { PLANE_STATES } from './flight-model.js';

function setFlying(plane, values) {
  Object.assign(plane, values);
  plane.state = PLANE_STATES.FLYING;
  plane.onGround = false;
  plane.verticalSpeed = 0;
}

export function applyShot(scene, name) {
  const plane = scene.plane;
  const run = scene.run;
  if (name === 'cover') {
    // Mid-flight, ring one ahead, the valley below, the runway behind.
    setFlying(plane, {
      x: 0, z: 1150, alt: 118, heading: 0.02, pitch: 0.02, roll: 0,
      speed: 54, throttle: 0.78, fuel: 0.92, gear: false, flaps: false,
    });
    run.time = 42;
    run.score = 0;
    scene.hud.showMessage('RING 1/8 — thread the amber ring', 30);
  } else if (name === 'valley') {
    // Low over the river valley, two rings already flown, turning for the next.
    setFlying(plane, {
      x: -320, z: 3300, alt: 140, heading: -0.35, pitch: 0.01, roll: -0.25,
      speed: 60, throttle: 0.85, fuel: 0.7, gear: false, flaps: false,
    });
    run.rings[0].passed = true;
    run.rings[1].passed = true;
    run.ringsPassed = 2;
    run.score = 200;
    run.time = 95;
    scene.hud.showMessage('RING 3/8 — follow the river north', 30);
  } else if (name === 'landing') {
    // On final: gear down, flaps down, the runway 650 m ahead.
    setFlying(plane, {
      x: 6, z: RUNWAY.zStart - 650, alt: 68, heading: 0, pitch: -0.02, roll: 0,
      speed: 37, throttle: 0.32, fuel: 0.42, gear: true, flaps: true,
    });
    run.time = 38;
    run.score = 0;
    scene.hud.buttons.gear.setLit(true);
    scene.hud.buttons.flaps.setLit(true);
    scene.hud.showMessage('FINAL — runway ahead, gear down, flaps down', 30);
  }
  // 'menu' is handled by the boot scene: it never starts the flight scene.
}

export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot') || '',
    mission: params.get('mission') || 'rally',
  };
}
