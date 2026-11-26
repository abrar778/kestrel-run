// Kestrel Run — the effects. Ring bursts, touchdown dust, crash smoke and
// fire, and the wind streaks that sell the speed.
// One job: the particles and flashes that make events read as what happened.

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.ringBurst = null;
    this.smoke = null;
    this.fire = null;
    this.dust = null;
    this.streaks = [];
    this.buildEmitters();
  }

  buildEmitters() {
    const scene = this.scene;
    // Ring burst: golden sparks that fly out and fade.
    this.ringBurst = scene.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 260 },
      scale: { start: 1.4, end: 0 },
      lifespan: 650,
      quantity: 1,
      emitting: false,
      tint: [0xffd76a, 0xffb020, 0xffffff],
    });
    this.ringBurst.setDepth(60);
    // Crash smoke: grey puffs that rise and spread.
    this.smoke = scene.add.particles(0, 0, 'spark', {
      speed: { min: 12, max: 70 },
      scale: { start: 2.6, end: 5 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 1600,
      quantity: 1,
      emitting: false,
      tint: 0x5a5a5a,
    });
    this.smoke.setDepth(60);
    // Crash fire: orange flickers that climb fast and die.
    this.fire = scene.add.particles(0, 0, 'spark', {
      speed: { min: 30, max: 130 },
      scale: { start: 2.2, end: 0 },
      lifespan: 700,
      quantity: 1,
      emitting: false,
      tint: [0xff5a2a, 0xffb020, 0xffd76a],
    });
    this.fire.setDepth(61);
    // Touchdown dust: pale puffs kicked sideways off the runway.
    this.dust = scene.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 90 },
      scale: { start: 1.2, end: 2.6 },
      alpha: { start: 0.55, end: 0 },
      lifespan: 800,
      quantity: 1,
      emitting: false,
      tint: 0xd8cdb4,
    });
    this.dust.setDepth(60);
    // Wind streaks: short white lines that rush past at high speed.
    for (let i = 0; i < 26; i += 1) {
      const streak = this.scene.add.graphics().setDepth(40);
      this.streaks.push({ graphics: streak, x: 0, y: 0, life: 0, speed: 0 });
    }
  }

  burstRing(x, y) {
    if (this.ringBurst) this.ringBurst.explode(26, x, y);
  }

  touchdownDust(x, y) {
    if (this.dust) this.dust.explode(18, x, y);
  }

  crashFireball(x, y) {
    if (this.fire) this.fire.explode(40, x, y);
    if (this.smoke) this.smoke.explode(30, x, y - 10);
    // A fireball that blooms and fades.
    const scene = this.scene;
    const ball = scene.add.graphics().setDepth(62);
    ball.fillStyle(0xff7a2a, 0.9);
    ball.fillCircle(x, y, 10);
    scene.tweens.add({
      targets: ball,
      scaleX: 4.2,
      scaleY: 4.2,
      alpha: 0,
      duration: 700,
      ease: 'Quad.Out',
      onComplete: () => ball.destroy(),
    });
    scene.cameras.main.shake(420, 0.012);
  }

  // Wind streaks: spawn near the screen edges at speed, rush outward.
  updateStreaks(speed, dt, width, height) {
    const active = speed > 52;
    for (const streak of this.streaks) {
      if (!active) {
        streak.life = 0;
        streak.graphics.clear();
        continue;
      }
      streak.life -= dt;
      if (streak.life <= 0) {
        streak.x = Math.random() * width;
        streak.y = Math.random() * height * 0.7;
        streak.life = 0.25 + Math.random() * 0.35;
        streak.speed = 900 + speed * 9;
      }
      const len = 26 + speed * 0.5;
      streak.y += streak.speed * dt * 0.4;
      streak.x += (streak.x - width / 2) * 0.6 * dt;
      // Streaks radiate outward from the centre of the view, like motion blur.
      const dx = streak.x - width / 2;
      const dy = streak.y - height * 0.46;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const ux = dx / dist;
      const uy = dy / dist;
      streak.graphics.clear();
      streak.graphics.lineStyle(2, 0xffffff, 0.3);
      streak.graphics.lineBetween(streak.x, streak.y, streak.x + ux * len, streak.y + uy * len);
    }
  }

  destroy() {
    if (this.ringBurst) this.ringBurst.destroy();
    if (this.smoke) this.smoke.destroy();
    if (this.fire) this.fire.destroy();
    if (this.dust) this.dust.destroy();
    for (const streak of this.streaks) streak.graphics.destroy();
  }
}
