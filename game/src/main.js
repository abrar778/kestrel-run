// Kestrel Run — the game boot. Creates the Phaser game, registers the
// scenes and exposes the game for the playtest harness and the console.
// One job: start Phaser.

import { BootScene } from './boot.js';
import { MenuScene } from './menu.js';
import { FlightScene } from './flight-scene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#6fb7ef',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: { antialias: true },
  fps: { target: 60 },
  scene: [BootScene, MenuScene, FlightScene],
});

// A hook for the playtest harness and the browser console.
window.__KESTREL_GAME__ = game;
