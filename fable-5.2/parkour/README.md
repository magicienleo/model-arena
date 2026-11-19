# LAST LIGHT — Rooftop Run

A first-person parkour vertical slice for the browser: one hand-built course across a
golden-hour city, from the start roof to the beacon on top of the tower.

## Run it

```
python3 -m http.server 8000
```

then open http://localhost:8000 (run the command from this folder). Nothing to install or
build — three.js is vendored in `vendor/` and every asset is in `assets/`, so it works offline.
Use a current browser with WebGL 2 on desktop or mobile.

## Controls

| Key | Action |
|---|---|
| W A S D | move |
| Mouse | look |
| Shift | sprint |
| Space | jump (hold for a higher jump) · kick off a wall while wall-running |
| C or Ctrl | slide while running · roll if pressed just before a big landing |
| E | grab a zipline (Space drops off) |
| R | back to the last checkpoint |
| V | toggle runner's vision |
| Esc | pause (resume, restart, mouse sensitivity, volume, runner's vision) |

### Touch and gamepad

- **Touch:** left thumbstick to move; push it toward the edge to sprint. Drag the view to
  look. Hold **Jump** for height; use **Slide** to slide or time a roll, and **Zip** near a
  cable. **Pause** opens the checkpoint, look sensitivity, sound and runner's vision controls.
  Portrait works; landscape gives you a wider view of the rooftops.
- **Standard gamepad (Xbox / PlayStation):** left stick to move, right stick to look,
  **RT / R2** or **L3** to sprint, **A / ✕** to jump, **B / ○** to slide or roll,
  **X / □** for ziplines, **LB / L1** for the last checkpoint, **Y / △** for runner’s
  vision, and **Menu / Options** to pause. Use the D-pad or left stick to navigate
  menus and **A / ✕** to confirm. Press a button with the browser tab focused to
  let the browser detect your controller. If sound needs permission, use **Enable sound**.
- **Fullscreen:** use the button at the top right (pause first if the mouse is locked).
  Fullscreen and gamepad access depend on browser and embed permissions; try opening
  the preview in its own tab if either is blocked. Some mobile browsers do not support
  fullscreen for web games.

Moves that happen on their own: sprint into a low obstacle to **vault** it, run or jump at a
wall at an angle to **wall-run**, run straight at a wall to **climb** it, and you **grab the
ledge and pull up** when you reach the top or just miss a jump.

Your best time, its checkpoint splits and a ghost of the run are saved in the browser
(localStorage) and raced against on the next attempt.

## Project layout

```
index.html        page, HUD and menus (markup + CSS)
js/boot.js        start-up: request gate + retry, then loads main.js
js/main.js        game state, timer / splits / ghost storage, main loop
js/renderer.js    renderer, sky, sun shadows, fog, post-processing
js/input.js       unified input, keyboard + pointer-lock mouse
js/touch.js       virtual joystick, touch aim and action buttons
js/gamepad.js     standard gamepad mapping and dead zones
controls.css      responsive HUD, menus and touch controls
js/player.js      player controller (all the movement)
js/physics.js     collision world (capsule vs boxes and ramps)
js/camera.js      first-person camera feel
js/arms.js        first-person arms (IK)
js/leveldata.js   the course: solids, ziplines, checkpoints, hints
js/level.js       course visuals
js/city.js        skyline and rooftop dressing
js/audio.js       synthesised sound and music
js/ui.js          HUD and menu logic
js/ghost.js       best-run recording and playback
js/particles.js   dust and sparks
js/assets.js, materials.js, props.js, geo.js, config.js   loading, materials, tuning
assets/           HDRI, textures, models, character — see assets/CREDITS.md
vendor/three/     three.js r170 (MIT)
```

`js/bot.js` is a test autopilot: open `http://localhost:8000/?bot=1` to watch it run the course.

Input mapping tests (Node.js 22+): `node --test tests/gamepad.test.mjs`.
