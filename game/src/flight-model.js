// Kestrel Run — the flight model. Pure numbers, no Phaser: given the
// controls it steps the plane one frame and reports what happened.
// One job: how the Kestrel flies, stalls, lands and crashes.

import { FLIGHT, RUNWAY, WORLD } from './config.js';
import { groundHeight as terrainHeight, onRunway, runwayOffset } from './terrain.js';

export const PLANE_STATES = {
  PARKED: 'parked',
  FLYING: 'flying',
  LANDED: 'landed',
  CRASHED: 'crashed',
};

export function createPlane() {
  return {
    x: RUNWAY.x,
    z: RUNWAY.zStart + 20,
    alt: RUNWAY.elevation,
    heading: RUNWAY.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: 1,
    gear: true,
    flaps: false,
    brake: false,
    damage: 0,
    verticalSpeed: 0,
    state: PLANE_STATES.PARKED,
    onGround: true,
    crashReason: '',
    landingQuality: null, // { sink, offset, speed, label } on a good landing
    time: 0,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// One simulation step. input: { pitch, roll, throttle, brake, flaps, gear }.
// pitch/roll are -1..1 stick deflections; throttle is -1..1; the rest booleans
// that the scene edge-triggers. Returns a list of event names for this step.
export function stepFlight(plane, input, dt) {
  const events = [];
  plane.time += dt;
  if (plane.state === PLANE_STATES.CRASHED || plane.state === PLANE_STATES.LANDED) {
    // A landed plane rolls out; a crashed one stays where it is.
    if (plane.state === PLANE_STATES.LANDED && plane.speed > 0.5) {
      plane.speed = Math.max(0, plane.speed - 9 * dt);
      plane.z += Math.cos(plane.heading) * plane.speed * dt;
      plane.x += Math.sin(plane.heading) * plane.speed * dt;
    }
    return events;
  }

  // Throttle follows the lever; an empty tank forces it shut.
  const throttleTarget = plane.fuel <= 0 ? 0 : clamp(plane.throttle + input.throttle * FLIGHT.throttleRate * dt, 0, 1);
  plane.throttle += clamp(throttleTarget - plane.throttle, -FLIGHT.throttleRate * dt, FLIGHT.throttleRate * dt);

  // Speed chases the throttle, with drag from flaps, gear and the brake.
  const targetSpeed = FLIGHT.minSpeed + plane.throttle * (FLIGHT.maxSpeed - FLIGHT.minSpeed);
  let drag = FLIGHT.dragRate;
  if (plane.flaps) drag += FLIGHT.flapDrag;
  if (plane.gear && !plane.onGround) drag += FLIGHT.gearDrag;
  if (input.brake) drag += FLIGHT.brakeDrag;
  const accel = plane.throttle > 0.05 ? FLIGHT.accelRate : -drag;
  plane.speed += clamp(targetSpeed - plane.speed, -drag * dt * 3, Math.max(0, accel) * dt);
  if (plane.speed < 0) plane.speed = 0;
  if (plane.damage > 0) plane.speed = Math.min(plane.speed, FLIGHT.maxSpeed * (1 - plane.damage * 0.25));

  // Stall: below stall speed the wing stops flying, the nose drops and the
  // stick goes mushy.
  const stalled = plane.speed < FLIGHT.stallSpeed && !plane.onGround;
  const authority = stalled ? clamp(plane.speed / FLIGHT.stallSpeed, 0.25, 1) : 1;

  // Pitch and roll chase the stick.
  const pitchTarget = clamp(input.pitch * FLIGHT.maxPitch, -FLIGHT.maxPitch, FLIGHT.maxPitch);
  const rollTarget = clamp(input.roll * FLIGHT.maxRoll, -FLIGHT.maxRoll, FLIGHT.maxRoll);
  plane.pitch += clamp(pitchTarget - plane.pitch, -FLIGHT.pitchRate * authority * dt, FLIGHT.pitchRate * authority * dt);
  plane.roll += clamp(rollTarget - plane.roll, -FLIGHT.rollRate * authority * dt, FLIGHT.rollRate * authority * dt);
  if (stalled) plane.pitch += (0 - plane.pitch) * 0.4 * dt - 0.25 * dt;

  // A banked turn: heading rate follows the bank, as a coordinated turn does.
  const turnRate = (9.81 * Math.tan(plane.roll)) / Math.max(plane.speed, 8);
  plane.heading += turnRate * dt;

  // Climb and sink.
  let vs = plane.speed * Math.sin(plane.pitch) * 0.92;
  if (stalled) vs -= (FLIGHT.stallSpeed - plane.speed) * 0.35;
  if (plane.flaps) vs -= 0.6;
  vs = clamp(vs, -FLIGHT.maxSink, FLIGHT.maxClimb);
  plane.verticalSpeed = vs;

  // Move.
  plane.x += Math.sin(plane.heading) * plane.speed * Math.cos(plane.pitch) * dt;
  plane.z += Math.cos(plane.heading) * plane.speed * Math.cos(plane.pitch) * dt;
  plane.alt += vs * dt;

  // Stay inside the valley.
  plane.x = clamp(plane.x, WORLD.minX, WORLD.maxX);
  plane.z = clamp(plane.z, WORLD.minZ, WORLD.maxZ);

  // Fuel: throttle discipline matters, a full-throttle sortie is short.
  plane.fuel = Math.max(0, plane.fuel - (FLIGHT.fuelDrainIdle + FLIGHT.fuelDrainFull * plane.throttle) * dt);
  if (plane.fuel <= 0 && plane.throttle > 0) events.push('fuel-empty');

  // Ground contact.
  const ground = terrainHeight(plane.x, plane.z);
  plane.onGround = plane.alt <= ground + 0.4;
  if (plane.onGround) {
    plane.alt = ground;
    resolveGroundContact(plane, ground, events);
  } else if (plane.state === PLANE_STATES.PARKED && plane.speed > FLIGHT.stallSpeed * 1.15 && plane.pitch > 0.08) {
    plane.state = PLANE_STATES.FLYING;
    events.push('takeoff');
  } else if (plane.state === PLANE_STATES.PARKED && plane.speed > 1 && plane.alt > ground + 2) {
    // Airborne without a takeoff (a shot or a teleport put the plane in the
    // air): it is flying now, not parked. The height check keeps a small
    // bounce on the takeoff roll from counting as a flight.
    plane.state = PLANE_STATES.FLYING;
  }
  return events;
}

function resolveGroundContact(plane, ground, events) {
  const sink = -plane.verticalSpeed; // m/s downward at contact
  const overRunway = onRunway(plane.x, plane.z);
  const offset = runwayOffset(plane.x);

  if (plane.state === PLANE_STATES.PARKED) {
    // Still rolling on the runway: a takeoff roll, or a landing rollout.
    // Lift off only with a margin above the stall speed, or the wing gives
    // up the instant the wheels leave the ground and the plane drops back
    // onto the runway.
    if (plane.speed > FLIGHT.stallSpeed * 1.15 && plane.pitch > 0.08) {
      plane.state = PLANE_STATES.FLYING;
      // Clear of the runway at once: otherwise the next step still sees the
      // plane on the ground in the FLYING state and reads it as a landing.
      plane.alt = ground + 1;
      plane.onGround = false;
      events.push('takeoff');
    }
    return;
  }

  if (overRunway) {
    const aligned = Math.abs(Math.sin(plane.heading - RUNWAY.heading)) < 0.24;
    if (plane.gear && sink <= FLIGHT.landMaxSink && plane.speed <= FLIGHT.landMaxSpeed && aligned) {
      landPlane(plane, sink, offset, events, 'runway');
      return;
    }
    if (!plane.gear) {
      plane.damage += 0.5;
      if (plane.damage >= 1) {
        crashPlane(plane, 'Gear-up landing — the belly struck the runway', events);
      } else {
        landPlane(plane, sink, offset, events, 'gear-up');
        events.push('gear-up-landing');
      }
      return;
    }
    if (sink > FLIGHT.landMaxSink || plane.speed > FLIGHT.landMaxSpeed) {
      plane.damage += (sink - FLIGHT.landMaxSink) * 0.1 + Math.max(0, plane.speed - FLIGHT.landMaxSpeed) * 0.012;
      if (plane.damage >= 1) {
        crashPlane(plane, sink > FLIGHT.landMaxSink ? 'Hard landing — the gear collapsed' : 'Too fast — the Kestrel ran off the runway', events);
      } else {
        // A bounce: back into the air, slower and wiser.
        plane.alt = ground + 1.5;
        plane.verticalSpeed = 2.2;
        plane.pitch = 0.1;
        plane.speed *= 0.82;
        plane.onGround = false;
        plane.state = PLANE_STATES.FLYING;
        events.push('hard-landing');
      }
      return;
    }
    landPlane(plane, sink, offset, events, 'runway');
    return;
  }

  // Off the runway: only a very gentle, very slow arrival survives.
  if (plane.speed <= FLIGHT.fieldMaxSpeed && sink <= FLIGHT.fieldMaxSink) {
    plane.damage += 0.35;
    landPlane(plane, sink, offset, events, 'field');
    events.push('field-landing');
    return;
  }
  crashPlane(plane, sink > 6 ? 'Terrain strike — the Kestrel hit the ground hard' : 'Off-runway landing at speed — the Kestrel broke up', events);
}

function landPlane(plane, sink, offset, events, surface) {
  plane.state = PLANE_STATES.LANDED;
  plane.onGround = true;
  plane.pitch = 0;
  plane.roll = 0;
  plane.verticalSpeed = 0;
  const label =
    surface === 'runway' ? (sink <= 1.2 && offset <= 4 ? 'Butter-smooth touchdown' : sink <= 2.4 ? 'Good landing' : 'Firm landing')
    : surface === 'gear-up' ? 'Gear-up landing'
    : 'Rough field landing';
  plane.landingQuality = { sink, offset, speed: plane.speed, label, surface };
  events.push('landed');
}

function crashPlane(plane, reason, events) {
  plane.state = PLANE_STATES.CRASHED;
  plane.crashReason = reason;
  plane.verticalSpeed = 0;
  plane.speed = 0;
  events.push('crashed');
}

// Display helpers.
export function speedKnots(plane) {
  return Math.round(plane.speed * 1.94384);
}

export function altitudeFeet(plane) {
  return Math.round((plane.alt - RUNWAY.elevation) * 3.28084);
}

export function headingDegrees(plane) {
  const deg = ((plane.heading * 180) / Math.PI) % 360;
  return Math.round((deg + 360) % 360);
}

export function verticalSpeedFpm(plane) {
  return Math.round(plane.verticalSpeed * 196.85);
}
