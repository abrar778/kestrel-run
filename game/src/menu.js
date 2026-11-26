// Kestrel Run — the title screen. A scenic valley behind the title, three
// mission cards to pick a sortie, and the controls, plain to read.
// One job: the front door of the game.

import { GAME_TITLE, GAME_TAGLINE, PALETTE } from './config.js';
import { MISSIONS } from './missions.js';
import { groundHeight, horizonRow, makeCamera } from './terrain.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.selectedMission = 0;
    this.elapsed = 0;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.worldGraphics = this.add.graphics();
    this.clouds = [];
    for (let i = 0; i < 7; i += 1) {
      const cloud = this.add.image(Math.random() * w, 40 + Math.random() * h * 0.3, 'cloud');
      cloud.setScale(1.4 + Math.random() * 1.6);
      cloud.setAlpha(0.9);
      this.clouds.push(cloud);
    }
    // A slow scenic camera drifting over the valley, so the menu is alive.
    this.menuCamera = {
      x: 300, z: 1200, alt: 260, heading: 0.35, pitch: 0.02, roll: 0,
      width: w, height: h, cx: w / 2, cy: h * 0.46, focal: h * 0.92,
    };

    // Title.
    this.add.text(w / 2, h * 0.16, GAME_TITLE, {
      fontSize: '72px', color: '#ffffff', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
      stroke: '#141a22', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(w / 2, h * 0.16 + 56, GAME_TAGLINE, {
      fontSize: '20px', color: '#ffe9a8', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
      stroke: '#141a22', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(w / 2, h * 0.16 + 92, 'A flight game by an AI agent, built for make.fun', {
      fontSize: '15px', color: '#f5f0e1', fontFamily: 'Verdana, sans-serif',
      stroke: '#141a22', strokeThickness: 4,
    }).setOrigin(0.5);

    // Mission cards.
    const cardW = 300;
    const cardH = 150;
    const gap = 24;
    const totalW = MISSIONS.length * cardW + (MISSIONS.length - 1) * gap;
    const startX = (w - totalW) / 2;
    const cardY = h * 0.52;
    this.cards = [];
    MISSIONS.forEach((mission, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const card = this.add.container(cx, cardY);
      const back = this.add.graphics();
      const drawCard = (selected) => {
        back.clear();
        back.fillStyle(selected ? 0x2a3442 : 0x141a22, selected ? 0.95 : 0.85);
        back.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
        back.lineStyle(3, selected ? 0xffb020 : 0x5a6a7a, 1);
        back.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
      };
      drawCard(i === this.selectedMission);
      const title = this.add.text(0, -cardH / 2 + 30, mission.name, {
        fontSize: '22px', color: '#f5f0e1', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
      }).setOrigin(0.5);
      const brief = this.add.text(0, -cardH / 2 + 62, mission.brief, {
        fontSize: '13px', color: '#cfe0ea', fontFamily: 'Verdana, sans-serif',
        wordWrap: { width: cardW - 32 }, align: 'center',
      }).setOrigin(0.5, 0);
      const rings = this.add.text(0, cardH / 2 - 26, mission.rings.length ? `${mission.rings.length} rings  ·  par ${mission.parSeconds}s` : 'One landing, one score', {
        fontSize: '13px', color: '#ffe9a8', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
      }).setOrigin(0.5);
      card.add([back, title, brief, rings]);
      card.setSize(cardW, cardH);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        this.selectedMission = i;
        this.cards.forEach((c, j) => c.drawCard(j === i));
        this.startMission();
      });
      card.on('pointerover', () => {
        this.selectedMission = i;
        this.cards.forEach((c, j) => c.drawCard(j === i));
      });
      card.drawCard = drawCard;
      this.cards.push(card);
    });

    // Controls, plain to read.
    const controls = [
      'FLY  —  Arrow keys or WASD: pitch and roll  ·  Shift / Ctrl: throttle up and down',
      'SPACE: airbrake   ·   G: landing gear   ·   F: flaps   ·   Mouse: drag the sky to steer',
      'Click the buttons on the panel for throttle, flaps, gear and brakes.',
      'ENTER: fly the selected mission   ·   P: pause   ·   R: restart   ·   M: sound on/off',
    ];
    controls.forEach((line, i) => {
      this.add.text(w / 2, h * 0.78 + i * 24, line, {
        fontSize: '15px', color: '#f5f0e1', fontFamily: 'Verdana, sans-serif',
        stroke: '#141a22', strokeThickness: 4,
      }).setOrigin(0.5);
    });
    this.add.text(w / 2, h - 28, 'Click a mission card, or press ENTER to fly. Land on the runway to finish.', {
      fontSize: '15px', color: '#ffe9a8', fontFamily: 'Verdana, sans-serif', fontStyle: 'bold',
      stroke: '#141a22', strokeThickness: 4,
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ENTER', () => this.startMission());
    this.input.keyboard.on('keydown-LEFT', () => this.moveSelection(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.moveSelection(1));
    this.input.keyboard.on('keydown-ONE', () => { this.selectedMission = 0; this.refreshCards(); this.startMission(); });
    this.input.keyboard.on('keydown-TWO', () => { this.selectedMission = 1; this.refreshCards(); this.startMission(); });
    this.input.keyboard.on('keydown-THREE', () => { this.selectedMission = 2; this.refreshCards(); this.startMission(); });
  }

  moveSelection(delta) {
    this.selectedMission = (this.selectedMission + delta + MISSIONS.length) % MISSIONS.length;
    this.refreshCards();
  }

  refreshCards() {
    this.cards.forEach((c, j) => c.drawCard(j === this.selectedMission));
  }

  startMission() {
    this.scene.start('FlightScene', { missionId: MISSIONS[this.selectedMission].id });
  }

  update(time, delta) {
    this.elapsed += delta / 1000;
    // Drift the scenic camera slowly forward and let the clouds wander.
    this.menuCamera.z += delta * 0.012;
    this.menuCamera.heading = 0.35 + Math.sin(this.elapsed * 0.05) * 0.2;
    this.drawValley();
    for (const cloud of this.clouds) {
      cloud.x += delta * 0.008;
      if (cloud.x > this.scale.width + 80) cloud.x = -80;
    }
  }

  // The same valley the game flies over, from a slow scenic camera.
  drawValley() {
    const g = this.worldGraphics;
    const camera = this.menuCamera;
    const w = this.scale.width;
    const h = this.scale.height;
    g.clear();
    // Sky gradient.
    g.fillGradientStyle(0x6fb7ef, 0x6fb7ef, 0xffe0ae, 0xffe0ae, 1);
    g.fillRect(0, 0, w, h);
    // Sun.
    g.fillStyle(0xfff2c0, 0.5);
    g.fillCircle(w * 0.78, h * 0.14, 66);
    g.fillStyle(0xffd76a, 1);
    g.fillCircle(w * 0.78, h * 0.14, 44);
    // Horizon silhouette and ground.
    const cols = 48;
    const horizonPoints = [];
    for (let i = 0; i <= cols; i += 1) {
      const sx = (w * i) / cols;
      horizonPoints.push({ x: sx, y: horizonRow(camera, sx, 1500) });
    }
    const groundPoints = [...horizonPoints, { x: w, y: h }, { x: 0, y: h }];
    g.fillStyle(0x8cb85e, 1);
    g.fillPoints(groundPoints, true);
    // A river winding through the valley.
    g.fillStyle(0x4fa8d8, 0.95);
    const riverPoints = [];
    for (let i = 0; i <= 24; i += 1) {
      const z = 300 + (i / 24) * 1100;
      const rx = 430 * Math.sin(z * 0.00085) + 250 * Math.sin(z * 0.0021 + 2.0) - 120;
      riverPoints.push({ x: rx, z });
    }
    // Project the river centreline and draw it as a ribbon.
    const left = [];
    const right = [];
    for (const p of riverPoints) {
      const a = this.projectGround(camera, p.x - 22, p.z);
      const b = this.projectGround(camera, p.x + 22, p.z);
      if (a && b) {
        left.push(a);
        right.unshift(b);
      }
    }
    if (left.length > 2) {
      g.fillStyle(0x4fa8d8, 0.95);
      g.fillPoints([...left, ...right], true);
    }
    // The runway, a pale strip on the airfield.
    const rw = [
      { x: -13, z: 200 }, { x: 13, z: 200 }, { x: 13, z: 800 }, { x: -13, z: 800 },
    ].map((p) => this.projectGround(camera, p.x, p.z)).filter(Boolean);
    if (rw.length === 4) {
      g.fillStyle(0x8d9299, 1);
      g.fillPoints(rw, true);
    }
  }

  projectGround(camera, x, z) {
    const dx = x - camera.x;
    const dz = z - camera.z;
    const sinH = Math.sin(camera.heading);
    const cosH = Math.cos(camera.heading);
    const forward = dx * sinH + dz * cosH;
    if (forward < 3) return null;
    const right = dx * cosH - dz * sinH;
    const horizonY = camera.cy + camera.pitch * camera.focal;
    const y = groundHeight(x, z);
    const sx = camera.cx + (right / forward) * camera.focal;
    const sy = horizonY - ((y - camera.alt) / forward) * camera.focal;
    return { x: sx, y: sy };
  }
}
