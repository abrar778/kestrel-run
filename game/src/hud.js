// Kestrel Run — the instruments. Round dials with needles, a compass tape,
// a throttle lever and a fuel gauge, all lit warm like a real panel.
// One job: show the pilot what the Kestrel is doing, and what to do next.

import { PALETTE } from './config.js';
import { altitudeFeet, headingDegrees, speedKnots, verticalSpeedFpm } from './flight-model.js';
import { makeHudButton } from './input.js';

const AMBER = 0xffb020;
const GREEN = 0x7be36b;
const RED = 0xff5a4a;
const PANEL = 0x141a22;
const FACE = 0x1d2733;
const TEXT = '#f5f0e1';
const FONT = 'Verdana, sans-serif';

function dialRing(g, x, y, r) {
  g.fillStyle(PANEL, 0.92);
  g.fillCircle(x, y, r + 5);
  g.lineStyle(2, AMBER, 0.9);
  g.strokeCircle(x, y, r + 5);
  g.fillStyle(FACE, 1);
  g.fillCircle(x, y, r);
}

// A needle from the dial centre at an angle (0 = up, clockwise positive).
function needle(g, x, y, r, angle, colour, width) {
  const a = angle - Math.PI / 2;
  g.lineStyle(width, colour, 1);
  g.lineBetween(x, y, x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
  g.fillStyle(colour, 1);
  g.fillCircle(x, y, 4);
}

function tickMarks(g, x, y, r, count, from, to, colour) {
  g.lineStyle(2, colour, 0.9);
  for (let i = 0; i <= count; i += 1) {
    const a = from + ((to - from) * i) / count - Math.PI / 2;
    const x1 = x + Math.cos(a) * (r - 8);
    const y1 = y + Math.sin(a) * (r - 8);
    const x2 = x + Math.cos(a) * (r - 2);
    const y2 = y + Math.sin(a) * (r - 2);
    g.lineBetween(x1, y1, x2, y2);
  }
}

function dialNumber(scene, x, y, text, size) {
  return scene.add.text(x, y, text, { fontSize: `${size}px`, color: TEXT, fontFamily: FONT }).setOrigin(0.5).setDepth(80);
}

// The artificial horizon: a round dial whose brown ground half is the
// circular segment below the horizon line, tilted by the bank and shifted by
// the pitch. No masks — the segment is built from the chord and the arc.
export function drawAttitude(g, x, y, r, roll, pitch) {
  dialRing(g, x, y, r);
  // Sky half.
  g.fillStyle(0x6fb7ef, 1);
  g.fillCircle(x, y, r);
  // The horizon line: perpendicular to the "up" direction, offset by pitch.
  const upX = -Math.sin(roll);
  const upY = -Math.cos(roll);
  const offset = Math.max(-r, Math.min(r, pitch * r * 2.2));
  const cx = x + upX * offset;
  const cy = y + upY * offset;
  // Chord across the circle along the horizon direction.
  const dirX = Math.cos(roll);
  const dirY = Math.sin(roll);
  const half = Math.sqrt(Math.max(0, r * r - offset * offset));
  const p1x = cx + dirX * half;
  const p1y = cy + dirY * half;
  const p2x = cx - dirX * half;
  const p2y = cy - dirY * half;
  // Arc from p1 to p2 going the long way round the ground side.
  const a1 = Math.atan2(p1y - y, p1x - x);
  const a2 = Math.atan2(p2y - y, p2x - x);
  // Walk the arc on the ground side (away from "up").
  const groundMidAngle = Math.atan2(upY, upX) + Math.PI;
  let start = a1;
  let end = a2;
  // Choose the sweep that passes through the ground direction.
  const norm = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  let sweep = norm(end - start);
  const midTest = norm(start + sweep / 2 - groundMidAngle);
  if (Math.abs(midTest) > Math.PI / 2) sweep = sweep > 0 ? sweep - Math.PI * 2 : sweep + Math.PI * 2;
  const points = [];
  points.push({ x: p1x, y: p1y });
  const steps = 20;
  for (let i = 1; i <= steps; i += 1) {
    const a = start + (sweep * i) / steps;
    points.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  points.push({ x: p2x, y: p2y });
  g.fillStyle(0x8a5a2e, 1);
  g.fillPoints(points, true);
  // Horizon line.
  g.lineStyle(2, 0xffffff, 0.95);
  g.lineBetween(p1x, p1y, p2x, p2y);
  // Fixed aircraft symbol: a little white "W" that never banks.
  g.lineStyle(3, 0xffffff, 1);
  g.lineBetween(x - 18, y + 2, x - 6, y + 2);
  g.lineBetween(x - 6, y + 2, x, y + 8);
  g.lineBetween(x, y + 8, x + 6, y + 2);
  g.lineBetween(x + 6, y + 2, x + 18, y + 2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x, y + 2, 2);
}

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(80);
    this.messageText = scene.add.text(scene.scale.width / 2, 122, '', {
      fontSize: '22px', color: '#ffe9a8', fontFamily: FONT, fontStyle: 'bold',
      stroke: '#141a22', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(85);
    this.scoreText = scene.add.text(16, 12, '', { fontSize: '20px', color: TEXT, fontFamily: FONT, fontStyle: 'bold', stroke: '#141a22', strokeThickness: 4 }).setDepth(85);
    this.timerText = scene.add.text(scene.scale.width - 16, 12, '', { fontSize: '20px', color: TEXT, fontFamily: FONT, fontStyle: 'bold', stroke: '#141a22', strokeThickness: 4 }).setOrigin(1, 0).setDepth(85);
    this.ringText = scene.add.text(scene.scale.width / 2, 40, '', { fontSize: '18px', color: '#ffe9a8', fontFamily: FONT, fontStyle: 'bold', stroke: '#141a22', strokeThickness: 4 }).setOrigin(0.5).setDepth(85);
    this.speedDigital = scene.add.text(0, 0, '', { fontSize: '15px', color: TEXT, fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0.5).setDepth(85);
    this.altDigital = scene.add.text(0, 0, '', { fontSize: '15px', color: TEXT, fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0.5).setDepth(85);
    this.messageTimer = 0;
    this.buttons = {};
    // Small labels, created once and reused: the compass tape letters, the
    // throttle and fuel captions, the gear/flaps lamps and the damage readout.
    // (Creating text every frame churns textures and tanks the frame rate.)
    this.compassLabels = [];
    for (let i = 0; i < 9; i += 1) {
      this.compassLabels.push(scene.add.text(0, 0, '', { fontSize: '11px', color: TEXT, fontFamily: FONT }).setOrigin(0.5).setDepth(81));
    }
    this.thrText = scene.add.text(0, 0, '', { fontSize: '14px', color: TEXT, fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(81);
    this.fuelText = scene.add.text(0, 0, 'FUEL', { fontSize: '12px', color: TEXT, fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(81);
    this.gearText = scene.add.text(0, 0, 'GEAR', { fontSize: '12px', color: TEXT, fontFamily: FONT }).setOrigin(0, 0.5).setDepth(81);
    this.flapText = scene.add.text(0, 0, 'FLAPS', { fontSize: '12px', color: TEXT, fontFamily: FONT }).setOrigin(0, 0.5).setDepth(81);
    this.dmgText = scene.add.text(0, 0, '', { fontSize: '12px', color: TEXT, fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0.5).setDepth(81);
    this.buildButtons();
  }

  buildButtons() {
    const scene = this.scene;
    const h = scene.scale.height;
    const w = scene.scale.width;
    const y = h - 34;
    this.buttons.throttleDown = makeHudButton(scene, w - 250, y, 'THR -', 76, 44);
    this.buttons.throttleUp = makeHudButton(scene, w - 160, y, 'THR +', 76, 44);
    this.buttons.flaps = makeHudButton(scene, w - 70, y, 'FLAPS', 76, 44);
    this.buttons.gear = makeHudButton(scene, 70, y, 'GEAR', 76, 44);
    this.buttons.brake = makeHudButton(scene, 160, y, 'BRAKE', 76, 44);
  }

  showMessage(text, seconds) {
    this.messageText.setText(text);
    this.messageTimer = seconds;
  }

  // Redraw every instrument for this frame.
  draw(plane, run, dt) {
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const g = this.graphics;
    g.clear();
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageText.setText('');
    }

    const knots = speedKnots(plane);
    const feet = altitudeFeet(plane);
    const heading = headingDegrees(plane);

    // Top bar.
    this.scoreText.setText(`${run.mission.short}   SCORE ${run.score}`);
    const clock = run.mission.id === 'trial' || run.mission.id === 'landing'
      ? Math.max(0, Math.ceil(run.timeLeft))
      : Math.floor(run.time);
    this.timerText.setText(run.mission.id === 'trial' ? `TIME ${clock}s` : `TIME ${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, '0')}`);
    const next = run.rings.find((r) => !r.passed);
    this.ringText.setText(run.rings.length ? `RINGS ${run.ringsPassed}/${run.rings.length}${next ? `  —  next ring ${Math.round(next.z - plane.z)} m ahead` : '  —  all rings flown, land her!'}` : 'Land on the runway');

    // --- Instruments, bottom-left cluster ---
    const ay = h - 118;
    const ax = 118;
    const ar = 62;
    drawAttitude(g, ax, ay, ar, plane.roll, plane.pitch);
    // Airspeed dial.
    const sx = 268;
    const sy = ay;
    const sr = 52;
    dialRing(g, sx, sy, sr);
    tickMarks(g, sx, sy, sr, 8, -Math.PI * 0.75, Math.PI * 0.75, 0xf5f0e1);
    const speedAngle = -Math.PI * 0.75 + (Math.min(knots, 180) / 180) * Math.PI * 1.5;
    needle(g, sx, sy, sr, speedAngle, AMBER, 3);
    this.speedDigital.setPosition(sx, sy + sr + 16).setText(`${knots} kt`);
    // Altimeter dial.
    const lx = 398;
    const ly = ay;
    const lr = 52;
    dialRing(g, lx, ly, lr);
    tickMarks(g, lx, ly, lr, 10, -Math.PI * 0.75, Math.PI * 0.75, 0xf5f0e1);
    const altAngle = -Math.PI * 0.75 + (Math.min(Math.max(feet, 0), 2500) / 2500) * Math.PI * 1.5;
    needle(g, lx, ly, lr, altAngle, GREEN, 3);
    this.altDigital.setPosition(lx, ly + lr + 16).setText(`${feet} ft`);
    // Vertical speed needle (small, under the altimeter).
    const vs = verticalSpeedFpm(plane);
    g.lineStyle(2, vs < -500 ? RED : 0xf5f0e1, 0.9);
    g.lineBetween(lx - 30, ly + lr + 34, lx + 30, ly + lr + 34);
    const vsX = lx + Math.max(-30, Math.min(30, (vs / 1000) * 30));
    g.fillStyle(vs < -500 ? RED : AMBER, 1);
    g.fillTriangle(vsX, ly + lr + 28, vsX - 5, ly + lr + 40, vsX + 5, ly + lr + 40);

    // --- Compass tape, top centre ---
    const tapeY = 66;
    const tapeW = 420;
    const tapeX = w / 2 - tapeW / 2;
    g.fillStyle(PANEL, 0.85);
    g.fillRoundedRect(tapeX, tapeY, tapeW, 30, 8);
    g.lineStyle(1, AMBER, 0.7);
    g.strokeRoundedRect(tapeX, tapeY, tapeW, 30, 8);
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let labelIndex = 0;
    for (let d = -60; d <= 60; d += 15) {
      const deg = ((heading + d) % 360 + 360) % 360;
      const px = w / 2 + (d / 60) * (tapeW / 2 - 10);
      const label = deg % 45 === 0 ? points[Math.round(deg / 45) % 8] : String(deg);
      const isCardinal = deg % 45 === 0;
      g.lineStyle(1, 0xf5f0e1, isCardinal ? 0.95 : 0.5);
      g.lineBetween(px, tapeY + 4, px, tapeY + (isCardinal ? 14 : 10));
      const tapeLabel = this.compassLabels[labelIndex];
      labelIndex += 1;
      if (isCardinal || deg % 90 === 0) {
        tapeLabel.setVisible(true);
        tapeLabel.setPosition(px, tapeY + 20);
        tapeLabel.setText(label);
      } else {
        tapeLabel.setVisible(false);
      }
    }
    for (; labelIndex < this.compassLabels.length; labelIndex += 1) {
      this.compassLabels[labelIndex].setVisible(false);
    }
    g.fillStyle(AMBER, 1);
    g.fillTriangle(w / 2, tapeY - 2, w / 2 - 6, tapeY - 10, w / 2 + 6, tapeY - 10);

    // --- Throttle and fuel, bottom-right ---
    const tx = w - 330;
    const ty = h - 190;
    const th = 120;
    g.fillStyle(PANEL, 0.9);
    g.fillRoundedRect(tx - 14, ty - 10, 34, th + 20, 8);
    g.fillStyle(0x2a3442, 1);
    g.fillRoundedRect(tx - 6, ty, 18, th, 4);
    const throttleY = ty + th - plane.throttle * th;
    g.fillStyle(AMBER, 1);
    g.fillRoundedRect(tx - 10, throttleY - 6, 26, 12, 4);
    this.thrText.setPosition(tx + 32, ty + th / 2).setText(`THR ${Math.round(plane.throttle * 100)}%`);
    // Fuel gauge.
    const fx = tx - 14;
    const fy = ty - 46;
    g.fillStyle(PANEL, 0.9);
    g.fillRoundedRect(fx, fy, 150, 30, 8);
    const fuelW = 110;
    g.fillStyle(0x2a3442, 1);
    g.fillRoundedRect(fx + 8, fy + 8, fuelW, 14, 4);
    g.fillStyle(plane.fuel < 0.2 ? RED : GREEN, 1);
    g.fillRoundedRect(fx + 8, fy + 8, Math.max(4, fuelW * plane.fuel), 14, 4);
    this.fuelText.setPosition(fx + 126, fy + 15);

    // Gear and flaps lamps, clear of the panel buttons.
    const lampY = h - 34;
    g.fillStyle(plane.gear ? GREEN : RED, 1);
    g.fillCircle(252, lampY, 7);
    this.gearText.setPosition(264, lampY);
    g.fillStyle(plane.flaps ? GREEN : 0x2a3442, 1);
    g.fillCircle(w - 366, lampY, 7);
    this.flapText.setPosition(w - 354, lampY);

    // Damage bar.
    if (plane.damage > 0) {
      const dx = w / 2 - 90;
      const dy = h - 34;
      g.fillStyle(PANEL, 0.9);
      g.fillRoundedRect(dx, dy - 10, 180, 20, 8);
      g.fillStyle(RED, 1);
      g.fillRoundedRect(dx + 4, dy - 6, 172 * plane.damage, 12, 4);
      this.dmgText.setVisible(true);
      this.dmgText.setPosition(dx + 90, dy).setText(`DAMAGE ${Math.round(plane.damage * 100)}%`);
    } else {
      this.dmgText.setVisible(false);
    }
  }

  destroy() {
    this.graphics.destroy();
    this.messageText.destroy();
    this.scoreText.destroy();
    this.timerText.destroy();
    this.ringText.destroy();
    this.speedDigital.destroy();
    this.altDigital.destroy();
    for (const label of this.compassLabels) label.destroy();
    this.thrText.destroy();
    this.fuelText.destroy();
    this.gearText.destroy();
    this.flapText.destroy();
    this.dmgText.destroy();
    for (const button of Object.values(this.buttons)) button.destroy();
  }
}
