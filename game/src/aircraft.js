// Kestrel Run — the aircraft. Draws the Kestrel itself: a little prop plane
// seen from behind, built from shapes, and the view that flies it.
// One job: what the plane looks like and how it sits in the frame.

import { PALETTE } from './config.js';

// The plane texture is drawn once, at boot, into a generated texture so the
// scene can use it as a sprite. A proper little plane: fuselage, wings, tail,
// fin, canopy glow and navigation lights — not a triangle.
export function buildAircraftTextures(scene) {
  const g = scene.add.graphics();

  // --- Kestrel body, rear view, 220 x 150 ---
  // Tailplane.
  g.fillStyle(0xf2f2ea, 1);
  g.fillRoundedRect(18, 96, 184, 16, 7);
  // Fin.
  g.fillStyle(0xe8542f, 1);
  g.fillTriangle(96, 96, 124, 96, 110, 52);
  g.fillStyle(0x2f3a4a, 1);
  g.fillTriangle(104, 92, 116, 92, 110, 60);
  // Main wings.
  g.fillStyle(0xf2f2ea, 1);
  g.fillRoundedRect(0, 84, 220, 22, 9);
  g.fillStyle(0xe8542f, 1);
  g.fillRoundedRect(0, 84, 220, 7, 4);
  // Wingtip navigation lights.
  g.fillStyle(0xff3b30, 1);
  g.fillCircle(8, 95, 5);
  g.fillStyle(0x2ee66b, 1);
  g.fillCircle(212, 95, 5);
  // Fuselage.
  g.fillStyle(0xe8542f, 1);
  g.fillRoundedRect(78, 58, 64, 78, 18);
  g.fillStyle(0xc7431f, 1);
  g.fillRoundedRect(78, 118, 64, 18, 9);
  // Belly stripe.
  g.fillStyle(0x2f3a4a, 1);
  g.fillRoundedRect(96, 58, 28, 78, 10);
  // Canopy glow (the instruments are lit inside).
  g.fillStyle(0x9fd8ef, 1);
  g.fillRoundedRect(88, 66, 44, 22, 9);
  g.fillStyle(0xffe9a8, 1);
  g.fillRoundedRect(94, 70, 32, 12, 5);
  // Tail wheel and struts.
  g.fillStyle(0x2f3a4a, 1);
  g.fillRect(104, 136, 6, 10);
  g.fillRect(112, 136, 6, 10);
  g.fillStyle(0x1a1f28, 1);
  g.fillCircle(107, 148, 4);
  g.fillCircle(115, 148, 4);
  g.generateTexture('kestrel', 220, 152);
  g.clear();

  // --- Propeller disc, spun in the scene ---
  g.fillStyle(0x1a1f28, 0.28);
  g.fillCircle(32, 32, 30);
  g.fillStyle(0xd8dee6, 0.9);
  g.fillRoundedRect(28, 2, 8, 60, 4);
  g.fillStyle(0x2f3a4a, 1);
  g.fillCircle(32, 32, 7);
  g.fillStyle(0xffd76a, 1);
  g.fillCircle(32, 32, 3);
  g.generateTexture('prop', 64, 64);
  g.clear();

  // --- Cloud puff ---
  g.fillStyle(0xffffff, 0.95);
  g.fillEllipse(40, 22, 62, 26);
  g.fillEllipse(22, 26, 34, 18);
  g.fillEllipse(58, 26, 36, 18);
  g.fillStyle(0xdfeaf2, 0.9);
  g.fillEllipse(40, 30, 58, 14);
  g.generateTexture('cloud', 80, 40);
  g.clear();

  // --- Pine tree billboard ---
  g.fillStyle(0x6b4a2b, 1);
  g.fillRect(14, 44, 6, 14);
  g.fillStyle(0x3d7a33, 1);
  g.fillTriangle(17, 0, 2, 34, 32, 34);
  g.fillStyle(0x2c5c26, 1);
  g.fillTriangle(17, 14, 6, 46, 28, 46);
  g.generateTexture('pine', 34, 58);
  g.clear();

  // --- Spark for ring bursts and touchdown dust ---
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 7);
  g.fillStyle(0xffd76a, 1);
  g.fillCircle(8, 8, 4);
  g.generateTexture('spark', 16, 16);
  g.clear();

  // --- Soft round shadow blob ---
  g.fillStyle(0x1a2b1a, 0.35);
  g.fillEllipse(32, 10, 60, 16);
  g.generateTexture('shadow', 64, 20);
  g.clear();

  // --- Sun disc with a glow ---
  g.fillStyle(0xfff2c0, 0.45);
  g.fillCircle(70, 70, 66);
  g.fillStyle(0xffd76a, 1);
  g.fillCircle(70, 70, 42);
  g.generateTexture('sun', 140, 140);
  g.clear();

  g.destroy();
}

// The plane as the player sees it: a sprite that banks with the roll, a
// spinning prop in front of it, and a shadow on the ground below.
export class AircraftView {
  constructor(scene, planeX, planeY) {
    this.scene = scene;
    this.sprite = scene.add.image(planeX, planeY, 'kestrel');
    this.sprite.setDepth(50);
    this.prop = scene.add.image(planeX, planeY - 14, 'prop');
    this.prop.setDepth(51);
    this.prop.setScale(1.15);
    this.shadow = scene.add.image(planeX, planeY + 90, 'shadow');
    this.shadow.setDepth(5);
    this.shadow.setAlpha(0);
    this.baseY = planeY;
    this.spin = 0;
  }

  // Called every frame: bank, pitch bob, prop spin, shadow placement.
  update(plane, groundScreenY, dt) {
    const s = this.sprite;
    s.setRotation(plane.roll * 0.85);
    s.setY(this.baseY + plane.pitch * 90 - Math.sin(plane.time * 2.2) * 1.5);
    s.setScale(1.08 + plane.speed * 0.0006);
    // The prop spins faster with the throttle and blurs at speed.
    this.spin += dt * (6 + plane.throttle * 46);
    this.prop.setRotation(this.spin);
    this.prop.setPosition(s.x, s.y - 14);
    this.prop.setAlpha(0.35 + plane.throttle * 0.45);
    this.prop.setScale(1.15 + plane.throttle * 0.25);
    // Shadow: on the ground under the plane, shrinking and fading with height.
    const heightAbove = Math.max(0, plane.alt - this.scene.groundHeightAtPlane);
    if (groundScreenY > 0 && heightAbove < 220) {
      const k = Math.max(0, 1 - heightAbove / 220);
      this.shadow.setVisible(true);
      this.shadow.setAlpha(0.32 * k);
      this.shadow.setScale(0.6 + 0.9 * k);
      this.shadow.setPosition(s.x, Math.min(groundScreenY, this.scene.scale.height - 8));
    } else {
      this.shadow.setVisible(false);
    }
  }

  setCrashed() {
    this.prop.setVisible(false);
  }

  destroy() {
    this.sprite.destroy();
    this.prop.destroy();
    this.shadow.destroy();
  }
}
