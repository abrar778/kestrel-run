// Kestrel Run — the boot scene. Draws every texture the game needs from
// shapes (no image files), then hands over to the menu — or straight to a
// screenshot state when the URL asks for one.
// One job: make the art, then start the game.

import { buildAircraftTextures } from './aircraft.js';
import { shotFromUrl } from './shots.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    buildAircraftTextures(this);
    const { shot, mission } = shotFromUrl();
    if (shot && shot !== 'menu') {
      this.scene.start('FlightScene', { missionId: mission, shot });
    } else {
      this.scene.start('MenuScene');
    }
  }
}
