// Kestrel Run — the flight scene. Renders the valley in chase view, flies
// the plane through the flight model, runs the mission and the HUD.
// One job: the sortie itself, from takeoff roll to touchdown or fireball.

import { FLIGHT, PALETTE, RUNWAY, WORLD } from './config.js';
import {
  TREES, groundColourAt, groundHeight, horizonRow, makeCamera, projectPoint, riverXAt,
} from './terrain.js';
import {
  PLANE_STATES, altitudeFeet, createPlane, headingDegrees, speedKnots, stepFlight, verticalSpeedFpm,
} from './flight-model.js';
import { AircraftView } from './aircraft.js';
import { createControls, readControls } from './input.js';
import { Hud } from './hud.js';
import { createMissionRun, finishMission, flyingGoalsDone, missionById, nextRing, passRing, scoreLanding } from './missions.js';
import { FlightAudio } from './audio.js';
import { Effects } from './effects.js';
import { applyShot } from './shots.js';

const BAND_DISTANCES = [60, 110, 180, 270, 390, 540, 730, 980, 1300];
const BAND_COLUMNS = 12;
const SUN_BEARING = 2.4; // rad, the sun sits to the south-west

export class FlightScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FlightScene' });
    this.groundHeightAtPlane = 0;
    this.groundScreenY = -1;
  }

  init(data) {
    this.missionId = (data && data.missionId) || 'rally';
    this.shotName = (data && data.shot) || null;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.mission = missionById(this.missionId);
    this.run = createMissionRun(this.mission);
    this.plane = createPlane();
    // Mission start state.
    const s = this.mission.start;
    this.plane.x = s.x;
    this.plane.z = s.z;
    this.plane.alt = s.alt;
    this.plane.heading = s.heading;
    this.plane.speed = s.speed;
    this.plane.throttle = s.throttle;
    this.plane.fuel = this.mission.startFuel;
    this.plane.onGround = s.alt <= groundHeight(s.x, s.z) + 0.4;
    this.plane.state = this.plane.onGround ? PLANE_STATES.PARKED : PLANE_STATES.FLYING;

    this.worldGraphics = this.add.graphics().setDepth(10);
    this.skyGraphics = this.add.graphics().setDepth(1);
    this.sunImage = this.add.image(0, 0, 'sun').setDepth(2);
    this.clouds = [];
    for (let i = 0; i < 10; i += 1) {
      const cloud = this.add.image(Math.random() * w, 30 + Math.random() * h * 0.35, 'cloud');
      cloud.setScale(1.2 + Math.random() * 1.8);
      cloud.setAlpha(0.85 + Math.random() * 0.15);
      cloud.setDepth(5);
      this.clouds.push({ image: cloud, baseX: Math.random() * w, baseY: 30 + Math.random() * h * 0.3, drift: 4 + Math.random() * 8 });
    }
    // Tree billboards, one image each, repositioned every frame.
    this.treeImages = TREES.map((tree) => {
      const img = this.add.image(-100, -100, 'pine');
      img.setDepth(20);
      img.setVisible(false);
      img.setTint(tree.shade > 0.5 ? 0xffffff : 0xd8e8d0);
      return { image: img, tree };
    });
    // Ring markers, one graphics object each, redrawn every frame.
    this.ringGraphics = this.run.rings.map(() => this.add.graphics().setDepth(30));

    this.aircraft = new AircraftView(this, w / 2, h * 0.60);
    this.hud = new Hud(this);
    this.controls = createControls(this);
    this.audio = new FlightAudio();
    this.effects = new Effects(this);
    this.paused = false;
    this.over = false;
    this.overlay = null;
    this.accumulator = 0; // fixed-step simulation backlog, seconds
    this.lastUpdateNow = 0; // wall-clock time of the last update, ms
    this.nextRingFlash = 0;

    // HUD buttons.
    this.hud.buttons.throttleUp.on('pointerdown', () => { this.controls.buttonThrottle = 1; });
    this.hud.buttons.throttleUp.on('pointerup', () => { this.controls.buttonThrottle = 0; });
    this.hud.buttons.throttleUp.on('pointerout', () => { this.controls.buttonThrottle = 0; });
    this.hud.buttons.throttleDown.on('pointerdown', () => { this.controls.buttonThrottle = -1; });
    this.hud.buttons.throttleDown.on('pointerup', () => { this.controls.buttonThrottle = 0; });
    this.hud.buttons.throttleDown.on('pointerout', () => { this.controls.buttonThrottle = 0; });
    this.hud.buttons.brake.on('pointerdown', () => { this.controls.buttonBrake = true; });
    this.hud.buttons.brake.on('pointerup', () => { this.controls.buttonBrake = false; });
    this.hud.buttons.brake.on('pointerout', () => { this.controls.buttonBrake = false; });
    this.hud.buttons.gear.on('pointerdown', () => { this.toggleGear(); });
    this.hud.buttons.flaps.on('pointerdown', () => { this.toggleFlaps(); });

    // First gesture unlocks the audio.
    this.input.on('pointerdown', () => this.audio.ensure());
    this.input.keyboard.on('keydown', () => this.audio.ensure());

    this.hud.showMessage(`${this.mission.name} — ${this.mission.brief}`, 6);
    this.hud.buttons.gear.setLit(this.plane.gear);
    this.hud.buttons.flaps.setLit(this.plane.flaps);

    // Screenshot states (?shot=...) put the game into a chosen moment.
    if (this.shotName) applyShot(this, this.shotName);

    // A hook for the playtest harness and the browser console.
    window.__KESTREL__ = {
      scene: this,
      get plane() { return this.scene.plane; },
      get run() { return this.scene.run; },
    };
  }

  toggleGear() {
    this.plane.gear = !this.plane.gear;
    this.hud.buttons.gear.setLit(this.plane.gear);
    this.audio.click();
    this.hud.showMessage(this.plane.gear ? 'Gear down' : 'Gear up', 1.5);
  }

  toggleFlaps() {
    this.plane.flaps = !this.plane.flaps;
    this.hud.buttons.flaps.setLit(this.plane.flaps);
    this.audio.click();
    this.hud.showMessage(this.plane.flaps ? 'Flaps down — slower, more drag' : 'Flaps up', 1.5);
  }

  update(time, delta) {
    const plane = this.plane;
    const controls = readControls(this.controls, this);

    if (controls.mutePressed) {
      const muted = this.audio.toggleMute();
      this.hud.showMessage(muted ? 'Sound off' : 'Sound on', 1.2);
    }
    if (controls.restartPressed && !this.over) {
      this.scene.restart({ missionId: this.missionId });
      return;
    }
    if (controls.pausePressed && !this.over) {
      this.paused = !this.paused;
      this.hud.showMessage(this.paused ? 'Paused — press P to fly on' : 'Flying', 1.2);
    }
    if (controls.startPressed && this.over) {
      this.scene.restart({ missionId: this.missionId });
      return;
    }
    if (this.paused || this.over) {
      this.audio.update(plane);
      return;
    }

    if (controls.gearPressed) this.toggleGear();
    if (controls.flapsPressed) this.toggleFlaps();

    // Fixed-step simulation: the flight model always steps at 60 Hz in
    // real time, even when the renderer is slow (software rendering in a
    // headless test runs at a handful of frames a second). Phaser's `delta`
    // reports the target frame time (~16 ms) even when the real frame
    // interval is ten times that, so a clamped dt throws away most of the
    // elapsed time and the plane flies in slow motion. Measure the real
    // elapsed time with the wall clock instead.
    const now = performance.now();
    const elapsed = this.lastUpdateNow ? Math.min((now - this.lastUpdateNow) / 1000, 0.25) : 1 / 60;
    this.lastUpdateNow = now;
    const STEP = 1 / 60;
    this.accumulator += elapsed;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 10) {
      this.stepSim(controls, STEP);
      this.accumulator -= STEP;
      steps += 1;
    }
    if (steps >= 10) this.accumulator = 0; // drop backlog, never spiral
    if (this.over) return; // a substep may have ended the mission

    // Render the world and the instruments once per frame, from the latest state.
    const frameDt = Math.min(0.05, delta / 1000);
    const camera = makeCamera(plane, this.scale.width, this.scale.height);
    this.drawSky(camera);
    this.drawWorld(camera);
    this.drawTrees(camera);
    this.drawRings(camera);
    this.groundHeightAtPlane = groundHeight(plane.x, plane.z);
    const groundPoint = projectPoint(camera, plane.x, this.groundHeightAtPlane, plane.z + 30);
    this.groundScreenY = groundPoint ? groundPoint.y : -1;
    this.aircraft.update(plane, this.groundScreenY, frameDt);
    this.hud.draw(plane, this.run, frameDt);
    this.effects.updateStreaks(plane.speed, frameDt, this.scale.width, this.scale.height);
    this.audio.update(plane);
    if (this.nextRingFlash > 0) this.nextRingFlash = Math.max(0, this.nextRingFlash - frameDt * 2);
  }

  // One fixed 1/60 s simulation step: fly the plane, run the mission
  // clock, and check the next ring. No drawing happens here.
  stepSim(controls, dt) {
    const plane = this.plane;
    const events = stepFlight(plane, controls, dt);
    this.handleEvents(events);

    // Mission clock.
    this.run.time += dt;
    if (this.mission.id === 'trial' || this.mission.id === 'landing') {
      this.run.timeLeft -= dt;
      if (this.run.timeLeft <= 0 && plane.state !== PLANE_STATES.LANDED && plane.state !== PLANE_STATES.CRASHED) {
        this.run.timeLeft = 0;
        this.endMission(false, 'Out of time — the clock ran out');
      }
    }

    // Ring checks: flying through a ring scores.
    const ring = nextRing(this.run);
    if (ring && plane.state === PLANE_STATES.FLYING) {
      const dx = plane.x - ring.x;
      const dy = plane.alt - ring.alt;
      const dz = plane.z - ring.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 16) {
        const index = this.run.rings.indexOf(ring);
        const points = passRing(this.run, index);
        this.audio.ringChime();
        this.effects.burstRing(this.scale.width / 2, this.scale.height * 0.42);
        this.hud.showMessage(`Ring ${this.run.ringsPassed}/${this.run.rings.length} — +${points} points`, 2);
        this.nextRingFlash = 1;
        if (flyingGoalsDone(this.run)) {
          this.hud.showMessage('All rings flown — bring her home to the runway', 4);
        }
      }
    }
  }

  handleEvents(events) {
    const plane = this.plane;
    for (const event of events) {
      if (event === 'takeoff') {
        this.hud.showMessage('Airborne — gear up when you are ready', 3);
        this.audio.click();
      } else if (event === 'fuel-empty') {
        this.hud.showMessage('Fuel empty — glide her down', 4);
      } else if (event === 'hard-landing') {
        this.audio.hardLanding();
        this.effects.touchdownDust(this.scale.width / 2, this.scale.height * 0.72);
        this.hud.showMessage(`Hard landing — ${Math.round(-plane.verticalSpeed * 196)} fpm, damage ${Math.round(plane.damage * 100)}%`, 3);
      } else if (event === 'gear-up-landing') {
        this.audio.hardLanding();
        this.hud.showMessage('Gear-up landing — the belly took it', 3);
      } else if (event === 'field-landing') {
        this.audio.touchdown();
        this.hud.showMessage('Rough field landing — she held together', 3);
      } else if (event === 'landed') {
        this.onLanded();
      } else if (event === 'crashed') {
        this.onCrashed();
      }
    }
  }

  onLanded() {
    const plane = this.plane;
    const quality = plane.landingQuality;
    const points = scoreLanding(this.run, quality);
    this.audio.touchdown();
    this.effects.touchdownDust(this.scale.width / 2, this.scale.height * 0.72);
    this.aircraft.setCrashed();
    if (this.mission.needsLanding && flyingGoalsDone(this.run)) {
      const timeBonus = finishMission(this.run);
      this.audio.fanfare();
      this.endMission(true, `${quality ? quality.label : 'Landed'} — +${points} landing points${timeBonus ? `, +${timeBonus} time bonus` : ''}. Final score ${this.run.score}.`);
    } else if (this.mission.needsLanding && !flyingGoalsDone(this.run)) {
      this.endMission(false, `${quality ? quality.label : 'Landed'} — but ${this.run.rings.length - this.run.ringsPassed} ring(s) were still unflown. Score ${this.run.score}.`);
    } else {
      this.endMission(true, `${quality ? quality.label : 'Landed'} — score ${this.run.score}.`);
    }
  }

  onCrashed() {
    const plane = this.plane;
    this.audio.crash();
    this.effects.crashFireball(this.scale.width / 2, this.scale.height * 0.60);
    this.aircraft.setCrashed();
    this.endMission(false, `Crashed — ${plane.crashReason}. Score ${this.run.score}.`);
  }

  endMission(won, message) {
    this.over = true;
    this.run.complete = won;
    this.run.result = message;
    this.hud.showMessage(message, 30);
    this.showEndOverlay(won, message);
  }

  showEndOverlay(won, message) {
    const w = this.scale.width;
    const h = this.scale.height;
    const overlay = this.add.container(w / 2, h / 2).setDepth(100);
    const back = this.add.graphics();
    back.fillStyle(0x141a22, 0.88);
    back.fillRoundedRect(-320, -130, 640, 260, 16);
    back.lineStyle(3, won ? 0x7be36b : 0xff5a4a, 1);
    back.strokeRoundedRect(-320, -130, 640, 260, 16);
    const title = this.add.text(0, -88, won ? 'MISSION COMPLETE' : 'SORTIE OVER', {
      fontSize: '34px', color: won ? '#7be36b' : '#ff5a4a', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5);
    const body = this.add.text(0, -30, message, {
      fontSize: '16px', color: '#f5f0e1', fontFamily: 'Verdana, sans-serif',
      wordWrap: { width: 580 }, align: 'center',
    }).setOrigin(0.5);
    const score = this.add.text(0, 34, `Score ${this.run.score}   ·   Rings ${this.run.ringsPassed}/${this.run.rings.length}   ·   Time ${Math.floor(this.run.time)}s`, {
      fontSize: '16px', color: '#ffe9a8', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5);
    const again = this.add.text(0, 84, 'Press ENTER or click to fly again  ·  M for menu', {
      fontSize: '15px', color: '#cfe0ea', fontFamily: 'Verdana, sans-serif',
    }).setOrigin(0.5);
    overlay.add([back, title, body, score, again]);
    overlay.setSize(640, 260);
    overlay.setInteractive({ useHandCursor: true });
    overlay.on('pointerdown', () => this.scene.restart({ missionId: this.missionId }));
    this.overlay = overlay;
    this.input.keyboard.on('keydown-M', () => this.scene.start('MenuScene'));
  }

  // --- Rendering -----------------------------------------------------------

  drawSky(camera) {
    const g = this.skyGraphics;
    const w = this.scale.width;
    const h = this.scale.height;
    // A single full-screen gradient quad: cheap, and it is the sky.
    g.clear();
    g.fillGradientStyle(PALETTE.skyTop, PALETTE.skyTop, PALETTE.skyHorizon, PALETTE.skyHorizon, 1);
    g.fillRect(0, 0, w, h);
    // The sun sits at a fixed world bearing, so turning moves it across the sky.
    const sunAngle = SUN_BEARING - camera.heading;
    const sunX = camera.cx + Math.sin(sunAngle) * camera.focal * 0.9;
    const sunY = h * 0.16 - camera.pitch * camera.focal * 0.6;
    this.sunImage.setPosition(sunX, sunY);
    // Clouds drift with the heading: turning the plane sweeps them past.
    for (const cloud of this.clouds) {
      const parallax = ((cloud.baseX - camera.heading * camera.focal * 0.45) % (w + 220) + w + 220) % (w + 220) - 110;
      cloud.image.setPosition(parallax, cloud.baseY - camera.pitch * camera.focal * 0.4);
      cloud.image.setAlpha(0.85);
    }
  }

  drawWorld(camera) {
    const g = this.worldGraphics;
    const w = this.scale.width;
    const h = this.scale.height;
    g.clear();
    // Horizon silhouette and the ground it bounds.
    const cols = BAND_COLUMNS;
    const horizonPoints = [];
    for (let i = 0; i <= cols; i += 1) {
      const sx = (w * i) / cols;
      horizonPoints.push({ x: sx, y: horizonRow(camera, sx, WORLD.farDistance) });
    }
    const groundPoints = [...horizonPoints, { x: w, y: h }, { x: 0, y: h }];
    g.fillStyle(PALETTE.groundMid, 1);
    g.fillPoints(groundPoints, true);

    // Distance bands: contour strips that flow toward the camera as it flies.
    // Each band is the ground between two distances, coloured by the terrain
    // under it, so the valley reads as hills and the speed reads as motion.
    let previousCurve = horizonPoints;
    for (const distance of BAND_DISTANCES) {
      const curve = [];
      for (let i = 0; i <= cols; i += 1) {
        const sx = (w * i) / cols;
        const angle = Math.atan2(sx - camera.cx, camera.focal);
        const dir = camera.heading + angle;
        const wx = camera.x + Math.sin(dir) * distance;
        const wz = camera.z + Math.cos(dir) * distance;
        const wy = groundHeight(wx, wz);
        const projected = projectPoint(camera, wx, wy, wz);
        curve.push({ x: sx, y: projected ? projected.y : h });
      }
      // Colour from the terrain at the middle of the band.
      const midX = camera.x + Math.sin(camera.heading) * (distance + 40);
      const midZ = camera.z + Math.cos(camera.heading) * (distance + 40);
      const colour = groundColourAt(midX, midZ, distance);
      const band = [...curve, ...previousCurve.slice().reverse()];
      g.fillStyle(colour, 1);
      g.fillPoints(band, true);
      previousCurve = curve;
    }

    // The river, a ribbon following its meander.
    const riverLeft = [];
    const riverRight = [];
    const riverStart = Math.max(0, Math.floor((camera.z - 100) / 90) * 90);
    for (let z = riverStart; z < camera.z + 1500; z += 90) {
      const rx = riverXAt(z);
      const a = projectPoint(camera, rx - 22, 2.5, z);
      const b = projectPoint(camera, rx + 22, 2.5, z);
      if (a && b) {
        riverLeft.push(a);
        riverRight.unshift(b);
      }
    }
    if (riverLeft.length > 2) {
      g.fillStyle(PALETTE.river, 0.95);
      g.fillPoints([...riverLeft, ...riverRight], true);
      g.fillStyle(PALETTE.riverDeep, 0.9);
      const deep = riverLeft.map((p) => ({ x: p.x + 4, y: p.y }));
      g.fillPoints([...deep, ...riverRight], true);
    }

    // The runway: a pale strip with centreline dashes and thresholds.
    const corners = [
      { x: RUNWAY.x - RUNWAY.width / 2, z: RUNWAY.zStart },
      { x: RUNWAY.x + RUNWAY.width / 2, z: RUNWAY.zStart },
      { x: RUNWAY.x + RUNWAY.width / 2, z: RUNWAY.zEnd },
      { x: RUNWAY.x - RUNWAY.width / 2, z: RUNWAY.zEnd },
    ].map((p) => projectPoint(camera, p.x, RUNWAY.elevation + 0.4, p.z));
    if (corners.every(Boolean)) {
      g.fillStyle(PALETTE.runway, 1);
      g.fillPoints(corners, true);
      g.lineStyle(2, PALETTE.runwayEdge, 0.9);
      g.strokePoints(corners, true);
      // Centreline dashes.
      g.fillStyle(PALETTE.runwayMark, 1);
      for (let z = RUNWAY.zStart + 40; z < RUNWAY.zEnd - 20; z += 60) {
        const a = projectPoint(camera, RUNWAY.x - 1.2, RUNWAY.elevation + 0.5, z);
        const b = projectPoint(camera, RUNWAY.x + 1.2, RUNWAY.elevation + 0.5, z);
        const c = projectPoint(camera, RUNWAY.x + 1.2, RUNWAY.elevation + 0.5, z + 22);
        const d = projectPoint(camera, RUNWAY.x - 1.2, RUNWAY.elevation + 0.5, z + 22);
        if (a && b && c && d) g.fillPoints([a, b, c, d], true);
      }
      // Threshold bars at both ends.
      for (const zEnd of [RUNWAY.zStart + 12, RUNWAY.zEnd - 12]) {
        for (const off of [-8, -3, 3, 8]) {
          const a = projectPoint(camera, RUNWAY.x + off - 1.6, RUNWAY.elevation + 0.5, zEnd - 8);
          const b = projectPoint(camera, RUNWAY.x + off + 1.6, RUNWAY.elevation + 0.5, zEnd - 8);
          const c = projectPoint(camera, RUNWAY.x + off + 1.6, RUNWAY.elevation + 0.5, zEnd + 8);
          const d = projectPoint(camera, RUNWAY.x + off - 1.6, RUNWAY.elevation + 0.5, zEnd + 8);
          if (a && b && c && d) g.fillPoints([a, b, c, d], true);
        }
      }
    }
  }

  drawTrees(camera) {
    const w = this.scale.width;
    const h = this.scale.height;
    for (const entry of this.treeImages) {
      const tree = entry.tree;
      const projected = projectPoint(camera, tree.x, tree.h, tree.z);
      if (!projected || projected.forward < 6 || projected.forward > 1250) {
        entry.image.setVisible(false);
        continue;
      }
      if (projected.x < -80 || projected.x > w + 80 || projected.y < h * 0.4 || projected.y > h + 40) {
        entry.image.setVisible(false);
        continue;
      }
      const scale = Math.max(0.08, Math.min(2.4, projected.scale * 0.055 * tree.size / 10));
      entry.image.setVisible(true);
      entry.image.setPosition(projected.x, projected.y - 14 * scale);
      entry.image.setScale(scale);
      entry.image.setAlpha(0.92);
    }
  }

  drawRings(camera) {
    const w = this.scale.width;
    const h = this.scale.height;
    const next = nextRing(this.run);
    this.run.rings.forEach((ring, i) => {
      const g = this.ringGraphics[i];
      g.clear();
      const projected = projectPoint(camera, ring.x, ring.alt, ring.z);
      if (!projected || projected.forward < 8) return;
      if (projected.x < -160 || projected.x > w + 160 || projected.y < -80 || projected.y > h + 80) return;
      const radius = Math.max(4, ring.radius * projected.scale);
      const isNext = ring === next;
      const passed = ring.passed;
      const colour = passed ? PALETTE.ringPassed : isNext ? PALETTE.ring : 0xf5f0e1;
      const pulse = isNext ? 1 + Math.sin(this.plane.time * 4) * 0.08 : 1;
      const r = radius * pulse;
      if (!passed) {
        g.fillStyle(colour, 0.14);
        g.fillCircle(projected.x, projected.y, r * 1.35);
      }
      g.lineStyle(isNext ? 6 : 4, colour, passed ? 0.55 : 0.95);
      g.strokeCircle(projected.x, projected.y, r);
      g.lineStyle(2, 0xffffff, 0.6);
      g.strokeCircle(projected.x, projected.y, r * 0.82);
      // Distance to the next ring, under it.
      if (isNext && projected.forward > 20) {
        const label = this.ringLabel || this.add.text(0, 0, '', {
          fontSize: '15px', color: '#ffe9a8', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
          stroke: '#141a22', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(35);
        this.ringLabel = label;
        label.setVisible(true);
        label.setPosition(projected.x, projected.y + r + 18);
        label.setText(`RING ${i + 1} — ${Math.round(projected.forward)} m`);
      }
    });
    if (!next && this.ringLabel) this.ringLabel.setVisible(false);
    // Off-screen arrow toward the next ring.
    const arrow = this.nextArrow || this.add.text(0, 0, '', {
      fontSize: '30px', color: '#ffb020', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
      stroke: '#141a22', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(35);
    this.nextArrow = arrow;
    if (next) {
      const projected = projectPoint(camera, next.x, next.alt, next.z);
      if (projected && (projected.x < 40 || projected.x > w - 40 || projected.y < 120 || projected.y > h - 40)) {
        const ax = Math.max(60, Math.min(w - 60, projected.x));
        const ay = Math.max(130, Math.min(h - 60, projected.y));
        arrow.setVisible(true);
        arrow.setPosition(ax, ay);
        arrow.setText(projected.x < 40 ? '◀ RING' : projected.x > w - 40 ? 'RING ▶' : projected.y < 120 ? '▲ RING' : '▼ RING');
      } else {
        arrow.setVisible(false);
      }
    } else {
      arrow.setVisible(false);
    }
  }

  shutdown() {
    if (this.hud) this.hud.destroy();
    if (this.effects) this.effects.destroy();
    if (this.aircraft) this.aircraft.destroy();
    if (this.ringLabel) this.ringLabel.destroy();
    if (this.nextArrow) this.nextArrow.destroy();
    for (const g of this.ringGraphics || []) g.destroy();
    for (const entry of this.treeImages || []) entry.image.destroy();
    for (const cloud of this.clouds || []) cloud.image.destroy();
  }
}
