// ============================================================================
// main.js — boot, game state, run timer / splits / best-run storage and the
// fixed-timestep loop that ties every system together.
//
//   renderer.js  sky, sun, fog, post       input.js     keyboard + mouse
//   player.js    movement controller       physics.js   collision world
//   leveldata.js course definition         level.js     course meshes
//   city.js      skyline generator         audio.js     synthesised sound
//   camera.js    first-person camera feel  arms.js      first-person arms
//   ghost.js     best-run ghost            ui.js        HUD + menus
// ============================================================================
import * as THREE from 'three';
import { C } from './config.js';
import { Renderer } from './renderer.js';
import { loadAssets } from './assets.js';
import { Materials } from './materials.js';
import { Batch } from './geo.js';
import { PropLibrary } from './props.js';
import { World } from './physics.js';
import { Player } from './player.js';
import { buildLevel } from './leveldata.js';
import { buildCity } from './city.js';
import { buildLevelVisuals } from './level.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { Particles } from './particles.js';
import { AudioSys } from './audio.js';
import { Ghost, GhostRecorder } from './ghost.js';
import { Arms } from './arms.js';
import { UI } from './ui.js';
import { Bot } from './bot.js';

const params = new URLSearchParams(location.search);
const BOT = params.has('bot');
const NOLOCK = BOT || params.has('nolock');
const SAVE_KEY = 'lastlight.best.v1', SETTINGS_KEY = 'lastlight.settings.v1';

const ui = new UI();
ui.bindFullscreen();
addEventListener('error', (e) => ui.error(`${e.message}\n${e.filename || ''}:${e.lineno || ''}`));
addEventListener('unhandledrejection', (e) => ui.error(String(e.reason && e.reason.stack || e.reason)));

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: the run still counts for this session */ } },
};
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

async function boot() {
  const canvas = document.getElementById('c');
  const R = new Renderer(canvas);
  const { scene, camera } = R;

  // ---------------------------------------------------------------- assets
  const assets = await loadAssets(R.renderer, (p) => ui.progress(p * 0.88, 'Loading the city…'));
  ui.progress(0.9, 'Raising the skyline…'); await nextFrame();
  R.setSky(assets.sky);

  // ---------------------------------------------------------------- world
  const level = buildLevel();
  const world = new World();
  for (const s of level.solids) world.add(s);
  const mats = new Materials(assets);
  const batch = new Batch(mats, scene);
  const props = new PropLibrary(assets, scene);
  const { kit } = buildCity({ batch, assets, mats, scene, level, world });
  const lv = buildLevelVisuals({ batch, assets, mats, scene, level, props, kit });
  batch.flush();
  const rvClones = new Map();
  props.flush((group, mat) => {
    if (group !== 'rv') return mat;
    let m = rvClones.get(mat);
    if (!m) rvClones.set(mat, m = mats.registerRV(mat.clone(), 0.85));
    return m;
  });
  kit.flush();
  ui.progress(0.96, 'Warming up…'); await nextFrame();

  // ---------------------------------------------------------------- systems
  const input = new Input(canvas, ui.el.touchControls);
  ui.setMode(input.mode);
  input.onMode = mode => ui.setMode(mode);
  const audio = new AudioSys();
  const particles = new Particles(scene);
  const rig = new CameraRig(camera);
  const arms = new Arms(assets, camera);
  const ghost = new Ghost(assets, scene);
  const recorder = new GhostRecorder();
  const bot = BOT ? new Bot(level, world) : null;

  const settings = Object.assign({ sens: 1, vol: 0.8, rv: true }, store.get(SETTINGS_KEY) || {});
  let best = store.get(SAVE_KEY);
  if (best && (!best.time || !Array.isArray(best.ghost))) best = null;

  const G = {
    state: 'menu',            // menu | playing | paused | finished
    time: 0, running: false, cp: 0, falls: 0, splits: [], topSpeed: 0,
    fade: 1, fadeTarget: 0, respawnT: -1, hit: 0, acc: 0, clock: 0, dustT: 0,
  };
  const emitQueue = [];
  const player = new Player(world, level, (type, d) => emitQueue.push([type, d || {}]));

  const applySettings = () => {
    input.sensitivity = settings.sens; audio.setVolume(settings.vol);
    mats.setRunnerVision(settings.rv); ui.rv(settings.rv);
    ui.el.sens.value = settings.sens; ui.el.sensV.textContent = Number(settings.sens).toFixed(2);
    ui.el.vol.value = settings.vol; ui.el.volV.textContent = Math.round(settings.vol * 100);
    store.set(SETTINGS_KEY, settings);
  };

  // ---------------------------------------------------------------- run control
  function spawnAt(i) {
    const c = level.cps[i];
    player.reset({ x: c.x, y: c.y, z: c.z, yaw: c.yaw, killY: c.killY });
    input.yaw = c.yaw; input.pitch = 0; input.clearEdges();
    rig.reset(); G.acc = 0;
    if (bot) bot.reset(i);
  }
  function restartRun() {
    G.time = 0; G.running = false; G.cp = 0; G.falls = 0; G.splits = [0]; G.topSpeed = 0;
    recorder.reset(); lv.resetCheckpoints(); spawnAt(0);
    ghost.setRun(best ? best.ghost : null);
    ui.timer(0); ui.falls(0); ui.checkpoint(0, level.cps.length - 1); ui.best(best ? best.time : null);
    G.fade = 1; G.fadeTarget = 0; G.respawnT = -1;
  }
  function toCheckpoint(countFall) {
    if (G.respawnT >= 0) return;
    if (countFall) { G.falls++; ui.falls(G.falls); }
    G.fadeTarget = 1; G.respawnT = 0.26;
  }
  function finishRun() {
    G.state = 'finished'; G.running = false;
    input.clear(); ui.show(null, false);
    const prev = best;
    const newBest = !prev || G.time < prev.time;
    if (newBest) { best = { time: G.time, splits: G.splits.slice(), ghost: recorder.data.slice() }; store.set(SAVE_KEY, best); }
    audio.finish();
    ui.results({ time: G.time, best: best.time, prevBest: prev ? prev.time : null, prevSplits: prev ? prev.splits : null, newBest, falls: G.falls, splits: G.splits, names: level.cps.map(c => c.name), topSpeed: G.topSpeed });
    ui.best(best.time);
    setTimeout(() => { if (G.state === 'finished') { ui.show('results'); ui.hud(false); input.unlock(); } }, 1400);
  }
  function play() {
    audio.start(); audio.resume();
    input.clear();
    if (needsLock()) input.lock();
    G.state = 'playing'; ui.show(null); ui.hud(true); arms.setVisible(true);
  }
  function pause() {
    if (G.state !== 'playing') return;
    G.state = 'paused'; input.clear(); input.unlock(); ui.show('pause'); audio.suspend();
  }

  const needsLock = () => !NOLOCK && input.mode === 'keyboard';
  const toggleVision = () => {
    settings.rv = !settings.rv; applySettings();
    ui.toast(settings.rv ? "Runner's vision on" : "Runner's vision off", 1.1);
  };

  // ---------------------------------------------------------------- UI wiring
  ui.el.start.addEventListener('click', () => { restartRun(); play(); });
  ui.el.touchPause.addEventListener('click', pause);
  ui.el.enableSound.addEventListener('click', () => audio.resume());
  ui.el.resume.addEventListener('click', () => { play(); });
  ui.el.toCp.addEventListener('click', () => { play(); toCheckpoint(false); });
  ui.el.restart.addEventListener('click', () => { restartRun(); play(); });
  ui.el.again.addEventListener('click', () => { restartRun(); play(); });
  ui.el.sens.addEventListener('input', () => { settings.sens = parseFloat(ui.el.sens.value); applySettings(); });
  ui.el.vol.addEventListener('input', () => { settings.vol = parseFloat(ui.el.vol.value); applySettings(); });
  ui.el.rv.addEventListener('change', () => { settings.rv = ui.el.rv.checked; applySettings(); });
  input.onLockChange = (locked) => { if (!locked && G.state === 'playing' && needsLock()) pause(); };
  // browsers refuse a new pointer lock for about a second after Esc — a click on the view grabs it again
  canvas.addEventListener('click', () => { if (G.state === 'playing' && !input.locked && needsLock()) input.lock(); });
  input.onKey = (code) => {
    if (G.state === 'playing') {
      if (code === 'KeyR') toCheckpoint(false);
      if (code === 'KeyV') toggleVision();
      if (code === 'Escape' || code === 'KeyP') pause();
    } else if (G.state === 'paused' && code === 'KeyP') play();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------------------------------------------------------------- gameplay events -> feedback
  function handleEvent(type, d) {
    const p = player.pos;
    rig.onEvent(type, d);
    switch (type) {
      case 'step': audio.step(d.surf, d.speed, d.wall); if (d.wall && player.wr) particles.dust(p.x - player.wr.nx * 0.3, p.y + 0.1, p.z - player.wr.nz * 0.3, 2, 0.6); break;
      case 'jump': audio.jump(); particles.dust(p.x, p.y, p.z, 3, 1); break;
      case 'land':
        audio.land(d.impact, d.kind, d.surf);
        particles.dust(p.x, p.y, p.z, Math.min(26, 3 + d.impact * 1.1 | 0), 1 + d.impact * 0.12);
        if (d.kind === 'stumble') { G.hit = 0.6; ui.toast(`Hard landing — roll with ${input.mode === 'touch' ? 'SLIDE' : input.mode === 'gamepad' ? 'B / ○' : 'C'}`, 1.4); }
        break;
      case 'wallrunStart': audio.wallrunStart(); break;
      case 'wallJump': audio.wallJump(); particles.dust(p.x, p.y + 0.3, p.z, 5, 1.4); break;
      case 'climbStart': audio.climb(); break;
      case 'ledge': audio.ledge(); break;
      case 'vault': audio.vault(d.surf); arms.vaultSide = d.side; particles.dust(p.x, p.y + 0.5, p.z, 3, 1); break;
      case 'bump': audio.bump(d.speed); break;
      case 'zipStart': audio.zipStart(); break;
      case 'zipEnd': audio.zipEnd(); break;
      case 'death': audio.death(); G.hit = 1; toCheckpoint(true); break;
    }
  }

  // ---------------------------------------------------------------- per-step game logic
  function gameStep(dt, inp) {
    if (!G.running && player.mode !== 'dead' && (inp.mx || inp.mz || inp.jumpPressed)) G.running = true;
    player.step(dt, inp);
    if (G.running && player.mode !== 'dead') { G.time += dt; recorder.record(dt, player); }
    G.topSpeed = Math.max(G.topSpeed, player.speedH);
    const p = player.pos;
    // checkpoints
    for (const c of level.cps) {
      if (c.index <= G.cp) continue;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 2.4 && p.y > c.y - 1.5 && p.y < c.y + 4) {
        for (let i = G.cp + 1; i < c.index; i++) G.splits[i] = null;       // skipped via a shortcut
        G.cp = c.index; G.splits[c.index] = G.time; player.killY = c.killY;
        lv.setReached(c.index); audio.checkpoint();
        const b = best && best.splits ? best.splits[c.index] : null;
        ui.split(c.name, G.time, b == null ? null : G.time - b);
        ui.checkpoint(c.index, level.cps.length - 1);
      }
    }
    // finish
    const f = level.finish;
    if (G.state === 'playing' && player.mode !== 'dead' && Math.hypot(f.x - p.x, f.z - p.z) < f.r && Math.abs(p.y - f.y) < 1.2) finishRun();
  }

  // ---------------------------------------------------------------- frame loop
  let last = performance.now(), prevNow = last;
  const fwd = new THREE.Vector3(), focus = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    G.clock += dt;
    if (!bot && !document.hidden) {
      const pad = input.pollPad();
      if (!pad && input.mode === 'gamepad') {
        input.setMode(input.defaultMode);
        pause();
      } else if (pad) {
        if (G.state === 'playing') {
          if (pad.pressed.pause) pause();
          else {
            if (pad.pressed.checkpoint) toCheckpoint(false);
            if (pad.pressed.vision) toggleVision();
            input.applyPad(dt);
          }
        } else if (G.state === 'paused' && pad.pressed.pause) play();
        else ui.useMenuPad(pad.pressed);
      }
    }
    // Some browsers do not count a gamepad button as a Web Audio gesture.
    ui.soundButton(G.state === 'playing' && !!audio.ctx && audio.ctx.state !== 'running');
    if (G.state === 'playing') R.adapt((now - prevNow) / 1000);
    prevNow = now;
    const active = G.state === 'playing' || G.state === 'finished';

    if (active) {
      // respawn fade
      if (G.respawnT >= 0) {
        G.respawnT -= dt;
        if (G.respawnT < 0) { spawnAt(G.cp); audio.respawn(); G.fadeTarget = 0; G.fade = 1; }
      }
      G.acc += dt;
      let first = true;
      while (G.acc >= C.dt) {
        let inp;
        if (G.state === 'finished') inp = { mx: 0, mz: 0, sprint: false, jump: false, crouch: false, jumpPressed: false, crouchPressed: false, usePressed: false, yaw: input.yaw, pitch: input.pitch };
        else if (bot) { inp = bot.update(player, C.dt); input.yaw += Math.atan2(Math.sin(inp.yaw - input.yaw), Math.cos(inp.yaw - input.yaw)) * 0.08; input.pitch += (-0.1 - input.pitch) * 0.05; }
        else inp = input.sample(first);
        gameStep(C.dt, inp);
        G.acc -= C.dt; first = false;
      }
      while (emitQueue.length) { const [t, d] = emitQueue.shift(); handleEvent(t, d); }
    }
    const alpha = active ? G.acc / C.dt : 1;

    // camera + arms
    rig.update(dt, player, alpha, input.yaw, input.pitch);
    arms.update(dt, player, rig);
    if (G.state === 'menu') {
      // slow establishing drift on the title screen
      const t = G.clock * 0.05;
      camera.position.set(-14 + Math.sin(t) * 6, 76.5 + Math.sin(t * 1.7) * 0.6, 26);
      camera.rotation.set(-0.06, -0.3 + Math.sin(t * 0.8) * 0.12, 0);
      arms.setVisible(false);
    }

    // continuous effects
    const p = player.pos, speed = player.speedH;
    if (active) {
      G.dustT -= dt;
      if (player.mode === 'slide' && G.dustT <= 0) { G.dustT = 0.035; particles.dust(p.x, p.y, p.z, 1, 0.8, player.vel.x * 0.25, player.vel.z * 0.25); }
      if (player.rollT > 0 && G.dustT <= 0) { G.dustT = 0.05; particles.dust(p.x, p.y, p.z, 1, 1); }
      if (player.mode === 'zip') { const z = player.zip.z; particles.sparks(p.x, p.y + C.zipHang - 0.02, p.z, 2, -z.d[0] * speed * 0.35, 1.2, -z.d[2] * speed * 0.35); }
      // tutorial hints + zipline prompt
      let hint = '';
      for (const h of level.hints) if (p.x >= h.x0 && p.x <= h.x1 && p.z >= h.z0 && p.z <= h.z1 && player.grounded) { hint = h.text; break; }
      ui.hint(G.state === 'playing' ? hint : '');
      ui.prompt(G.state === 'playing' && !!player.zipNear && player.mode !== 'zip');
      ui.el.capture.classList.toggle('show', G.state === 'playing' && !input.locked && needsLock());
      ui.timer(G.time);
      ui.speed(speed, C.sprintSpeed + C.flowMax + 1.5);
      const prog = Math.max(G.cp / (level.cps.length - 1), Math.min(1, (level.spawn.z - p.z) / (level.spawn.z - level.finish.z)));
      audio.update(dt, { speed, vy: player.vel.y, mode: player.mode, intensity: G.state === 'finished' ? 1 : 0.12 + 0.88 * Math.pow(prog, 1.15) });
      ghost.update(dt, G.time, G.running || G.state === 'finished', camera.position);
    }
    particles.update(dt, R.renderer.domElement.height, camera.fov);
    lv.update(dt, G.clock);
    ui.update(dt);

    // sun shadow follows the action
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    focus.copy(camera.position).addScaledVector(fwd, 22);
    R.updateSun(focus);

    G.fade += Math.sign(G.fadeTarget - G.fade) * Math.min(Math.abs(G.fadeTarget - G.fade), dt / (G.fadeTarget > G.fade ? 0.24 : 0.4));
    G.hit = Math.max(0, G.hit - dt * 1.6);
    const sl = Math.max(0, Math.min(1, (speed - 9.3) / 5)) + (player.mode === 'zip' ? 0.25 : 0);
    R.render(dt, { speed: active ? Math.min(1, sl) : 0, time: G.clock, fade: G.fade, hit: G.hit });
  }

  // ---------------------------------------------------------------- go
  applySettings();
  restartRun();
  G.fade = 0;
  const startCp = parseInt(params.get('cp') || '0', 10);
  ui.progress(1, 'Ready');
  ui.show('start'); ui.best(best ? best.time : null);
  window.__game = { G, player, level, world, input, R, rig, arms, ghost, audio, mats, bot, play, restartRun, spawnAt, lv,
    warp(i) { G.cp = i; for (let k = 1; k <= i; k++) lv.setReached(k); player.killY = level.cps[i].killY; spawnAt(i); } };
  if (BOT || params.has('autostart')) { restartRun(); play(); if (startCp) window.__game.warp(startCp); }
  requestAnimationFrame(frame);
}

boot().catch((e) => { console.error(e); ui.error(String(e && e.stack || e)); });
