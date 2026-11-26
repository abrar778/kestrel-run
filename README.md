# Kestrel Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/abrar778/kestrel-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/abrar778/kestrel-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A flight game built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

**Kestrel Run** is a ridge-running flight rally. You fly the little prop plane Kestrel in a chase view over a stylised valley — rolling hills, a winding river, pine clusters and a grass airfield. Take off from the strip, thread the amber rings, mind the fuel, and bring her home to the runway.

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: every file the game loads lives under `game/`.

## Controls

- **Arrow keys / WASD** — pitch and roll
- **Shift / Ctrl** — throttle up and down (W/S also trim the throttle)
- **Space** — airbrake
- **G** — landing gear, **F** — flaps
- **Mouse** — drag the sky to steer; click the panel buttons for throttle, flaps, gear and brakes
- **Enter** — fly the selected mission / fly again, **P** — pause, **R** — restart, **M** — sound on/off

## Missions

1. **Ring Rally** — take off, thread all 8 rings over the valley, then land on the runway. 100 points a ring, landing and time bonuses.
2. **Landing Challenge** — you are on final, 2.6 km out at 850 ft. Put her down on the centreline, gently, gear down. One shot; the score is the landing itself.
3. **Time Trial** — six rings, ninety seconds on the clock. Every ring buys fifteen more seconds. Land before the fuel runs out.

Fuel drains with the throttle, so throttle discipline matters. Hard landings and gear-up landings damage the airframe; a terrain strike ends the sortie. A gentle touchdown on the runway with the gear down is worth the most.

## Instruments

Round dials with needles, as a flown panel should be: an artificial horizon that banks and pitches with the plane, airspeed in knots, altitude in feet with a vertical-speed needle, a heading compass tape, a throttle lever, a fuel gauge, and gear and flaps lamps. The engine hum follows the throttle and the wind follows the speed — all sound is generated with WebAudio, no audio files.

## Structure

The game's own source is split into files with one clear job each, under `game/src/`:

- `config.js` — tuning, colours and world constants
- `terrain.js` — the valley, river, runway, trees and the chase-view projection
- `flight-model.js` — how the Kestrel flies, stalls, lands and crashes
- `aircraft.js` — the plane itself, drawn from shapes
- `input.js` — keyboard and mouse controls
- `hud.js` — the instruments and the panel buttons
- `missions.js` — the three sorties and how they score
- `audio.js` — generated WebAudio engine, wind and effects
- `effects.js` — ring bursts, touchdown dust, crash smoke and fire
- `boot.js` / `menu.js` / `flight-scene.js` — the Phaser scenes
- `shots.js` — the `?shot=` states the screenshots are taken from
- `main.js` — the Phaser game boot

Phaser 4.2.1 is vendored under `game/vendor/phaser.min.js`. All art is drawn in code; there are no image or audio files.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=a9yp7rgm&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
