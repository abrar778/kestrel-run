// Kestrel Run — the controls. Keyboard and mouse, both live at once.
// One job: turn what the pilot does into a stick, a throttle and buttons.

export function createControls(scene) {
  const keyboard = scene.input.keyboard;
  const controls = {
    keys: null,
    wasd: null,
    // Held state, read every frame by the flight scene.
    pitch: 0, // -1 (nose down) .. 1 (nose up)
    roll: 0, // -1 (left) .. 1 (right)
    throttle: 0, // -1 (close) .. 1 (open)
    brake: false,
    // Edge-triggered actions, consumed by the scene once.
    gearPressed: false,
    flapsPressed: false,
    pausePressed: false,
    restartPressed: false,
    mutePressed: false,
    startPressed: false,
    // Mouse steering: drag to steer, or use the on-screen buttons.
    mouseSteer: false,
    mousePitch: 0,
    mouseRoll: 0,
    // On-screen buttons set these while held.
    buttonThrottle: 0,
    buttonBrake: false,
  };

  if (keyboard) {
    controls.keys = keyboard.createCursorKeys();
    controls.wasd = keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
    });
    keyboard.addCapture([
      'UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE',
      'W', 'A', 'S', 'D', 'SHIFT', 'CTRL', 'G', 'F', 'P', 'R', 'M', 'ENTER',
    ]);
    const gearKey = keyboard.addKey('G');
    const flapsKey = keyboard.addKey('F');
    const pauseKey = keyboard.addKey('P');
    const restartKey = keyboard.addKey('R');
    const muteKey = keyboard.addKey('M');
    const enterKey = keyboard.addKey('ENTER');
    const shiftKey = keyboard.addKey('SHIFT');
    const ctrlKey = keyboard.addKey('CTRL');
    const spaceKey = keyboard.addKey('SPACE');
    controls._keys = { gearKey, flapsKey, pauseKey, restartKey, muteKey, enterKey, shiftKey, ctrlKey, spaceKey };
  }

  // Mouse steering: press and drag anywhere on the sky to steer toward the
  // pointer; the further from centre, the harder the turn.
  scene.input.on('pointerdown', (pointer) => {
    if (pointer.y < scene.scale.height * 0.82) {
      controls.mouseSteer = true;
      controls.mousePointer = pointer;
    }
  });
  scene.input.on('pointerup', () => {
    controls.mouseSteer = false;
    controls.mousePitch = 0;
    controls.mouseRoll = 0;
  });
  scene.input.on('pointermove', (pointer) => {
    if (!controls.mouseSteer) return;
    const w = scene.scale.width;
    const h = scene.scale.height;
    controls.mouseRoll = Math.max(-1, Math.min(1, (pointer.x - w / 2) / (w * 0.3)));
    controls.mousePitch = Math.max(-1, Math.min(1, (h * 0.45 - pointer.y) / (h * 0.3)));
  });

  return controls;
}

// Read the controls once per frame into the shape the flight model wants.
export function readControls(controls, scene) {
  const k = controls.keys;
  const w = controls.wasd;
  let pitch = 0;
  let roll = 0;
  if (k) {
    if (k.up.isDown || (w && w.up.isDown)) pitch += 1;
    if (k.down.isDown || (w && w.down.isDown)) pitch -= 1;
    if (k.left.isDown || (w && w.left.isDown)) roll -= 1;
    if (k.right.isDown || (w && w.right.isDown)) roll += 1;
  }
  if (controls.mouseSteer) {
    pitch += controls.mousePitch;
    roll += controls.mouseRoll;
  }
  controls.pitch = Math.max(-1, Math.min(1, pitch));
  controls.roll = Math.max(-1, Math.min(1, roll));

  let throttle = 0;
  if (controls._keys) {
    if (controls._keys.shiftKey.isDown) throttle += 1;
    if (controls._keys.ctrlKey.isDown) throttle -= 1;
    // W/S also trim the throttle when the arrows are doing the flying.
    if (k && !k.up.isDown && !k.down.isDown) {
      if (w && w.up.isDown) throttle += 1;
      if (w && w.down.isDown) throttle -= 1;
    }
  }
  throttle += controls.buttonThrottle;
  controls.throttle = Math.max(-1, Math.min(1, throttle));
  controls.brake = (controls._keys && controls._keys.spaceKey.isDown) || controls.buttonBrake;

  if (controls._keys) {
    controls.gearPressed = Phaser.Input.Keyboard.JustDown(controls._keys.gearKey);
    controls.flapsPressed = Phaser.Input.Keyboard.JustDown(controls._keys.flapsKey);
    controls.pausePressed = Phaser.Input.Keyboard.JustDown(controls._keys.pauseKey);
    controls.restartPressed = Phaser.Input.Keyboard.JustDown(controls._keys.restartKey);
    controls.mutePressed = Phaser.Input.Keyboard.JustDown(controls._keys.muteKey);
    controls.startPressed = Phaser.Input.Keyboard.JustDown(controls._keys.enterKey);
  }
  return controls;
}

// A small clickable button for the HUD: throttle, flaps, gear, brake.
export function makeHudButton(scene, x, y, label, width, height) {
  const button = scene.add.container(x, y);
  const back = scene.add.graphics();
  back.fillStyle(0x141a22, 0.82);
  back.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
  back.lineStyle(2, 0xffb020, 0.9);
  back.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
  const text = scene.add.text(0, 0, label, {
    fontSize: '15px',
    color: '#f5f0e1',
    fontFamily: 'Verdana, sans-serif',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  button.add([back, text]);
  button.setSize(width, height);
  button.setInteractive({ useHandCursor: true });
  button.setDepth(90);
  button._back = back;
  button._text = text;
  button._label = label;
  button._width = width;
  button._height = height;
  button.setLabel = function setLabel(next) {
    this._text.setText(next);
    this._label = next;
  };
  button.setLit = function setLit(on) {
    this._back.clear();
    this._back.fillStyle(on ? 0x7be36b : 0x141a22, on ? 0.9 : 0.82);
    this._back.fillRoundedRect(-this._width / 2, -this._height / 2, this._width, this._height, 8);
    this._back.lineStyle(2, on ? 0x7be36b : 0xffb020, 0.9);
    this._back.strokeRoundedRect(-this._width / 2, -this._height / 2, this._width, this._height, 8);
  };
  return button;
}
