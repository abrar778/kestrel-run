// Kestrel Run — the missions. Each one is a different sortie over the same
// valley: its rings, its start, its clock and how it scores.
// One job: what the pilot is asked to do, and what it is worth.

import { RUNWAY } from './config.js';

// A ring the pilot flies through: a world position and an approach heading.
function ring(x, alt, z, heading) {
  return { x, alt, z, heading, radius: 20, passed: false };
}

export const MISSIONS = [
  {
    id: 'rally',
    name: 'Ring Rally',
    short: 'RALLY',
    brief: 'Take off from the strip, thread all 8 rings over the valley, then bring her home to the runway.',
    parSeconds: 240,
    startFuel: 1,
    start: { x: RUNWAY.x, z: RUNWAY.zStart + 20, alt: RUNWAY.elevation, heading: RUNWAY.heading, speed: 0, throttle: 0 },
    rings: [
      ring(60, 120, 1500, 0),
      ring(-260, 170, 2600, -0.3),
      ring(-620, 210, 3900, -0.55),
      ring(-420, 150, 5200, -0.2),
      ring(180, 190, 6400, 0.25),
      ring(640, 150, 7600, 0.5),
      ring(420, 220, 8800, 0.15),
      ring(60, 130, 9900, -0.1),
    ],
    ringPoints: 100,
    landingPoints: 500,
    timeBonusPerSecond: 2,
    needsLanding: true,
  },
  {
    id: 'landing',
    name: 'Landing Challenge',
    short: 'LANDING',
    brief: 'You are on final, 2.6 km out at 850 ft. Put her down on the centreline, gently, gear down. One shot.',
    parSeconds: 180,
    startFuel: 0.5,
    start: { x: -40, z: RUNWAY.zStart - 2600, alt: 260, heading: RUNWAY.heading, speed: 45, throttle: 0.45 },
    rings: [],
    ringPoints: 0,
    landingPoints: 500,
    timeBonusPerSecond: 0,
    needsLanding: true,
    // The score is the landing itself: gentle, centred, slow.
    landingScore(quality) {
      if (!quality) return 0;
      let score = 500;
      score -= Math.round(quality.sink * 55);
      score -= Math.round(quality.offset * 3);
      score -= Math.round(Math.max(0, quality.speed - 30) * 6);
      if (quality.surface === 'gear-up') score -= 200;
      if (quality.surface === 'field') score -= 250;
      return Math.max(50, score);
    },
  },
  {
    id: 'trial',
    name: 'Time Trial',
    short: 'TRIAL',
    brief: 'Six rings, ninety seconds on the clock. Every ring buys fifteen more seconds. Land before the fuel runs out.',
    parSeconds: 90,
    startFuel: 0.6,
    start: { x: RUNWAY.x, z: RUNWAY.zStart + 20, alt: RUNWAY.elevation, heading: RUNWAY.heading, speed: 0, throttle: 0 },
    rings: [
      ring(-120, 130, 1400, -0.15),
      ring(-480, 180, 2700, -0.45),
      ring(-300, 140, 4000, -0.1),
      ring(240, 200, 5200, 0.3),
      ring(560, 160, 6400, 0.45),
      ring(120, 120, 7600, 0),
    ],
    ringPoints: 150,
    landingPoints: 300,
    timeBonusPerSecond: 5,
    timePerRing: 15,
    needsLanding: true,
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

// Fresh, per-attempt mission state. Rings are copied so one attempt never
// marks another's rings as passed.
export function createMissionRun(mission) {
  return {
    mission,
    rings: mission.rings.map((r) => ({ ...r, passed: false })),
    ringsPassed: 0,
    score: 0,
    time: 0,
    timeLeft: mission.parSeconds,
    complete: false,
    failed: false,
    result: '',
  };
}

// Called when the plane flies through a ring.
export function passRing(run, index) {
  const ringState = run.rings[index];
  if (!ringState || ringState.passed) return 0;
  ringState.passed = true;
  run.ringsPassed += 1;
  const points = run.mission.ringPoints;
  run.score += points;
  if (run.mission.timePerRing) run.timeLeft += run.mission.timePerRing;
  return points;
}

// Called when the plane lands. Returns the landing points for this mission.
export function scoreLanding(run, quality) {
  const mission = run.mission;
  let points;
  if (mission.landingScore) {
    points = mission.landingScore(quality);
  } else {
    points = mission.landingPoints;
    if (quality) {
      if (quality.sink <= 1.2 && quality.offset <= 4) points += 150;
      else if (quality.sink <= 2.4) points += 60;
      if (quality.surface === 'gear-up') points = Math.round(points * 0.4);
      if (quality.surface === 'field') points = Math.round(points * 0.3);
    }
  }
  run.score += points;
  return points;
}

// Called when the mission's goals are all met and the plane is down safe.
export function finishMission(run) {
  const mission = run.mission;
  let timeBonus = 0;
  if (mission.timeBonusPerSecond > 0 && run.timeLeft > 0) {
    timeBonus = Math.round(run.timeLeft * mission.timeBonusPerSecond);
    run.score += timeBonus;
  }
  run.complete = true;
  run.result = `Mission complete — ${run.score} points`;
  return timeBonus;
}

// The next ring the pilot should aim for.
export function nextRing(run) {
  return run.rings.find((r) => !r.passed) || null;
}

// Are the mission's flying goals done (rings all passed)?
export function flyingGoalsDone(run) {
  return run.rings.every((r) => r.passed);
}
