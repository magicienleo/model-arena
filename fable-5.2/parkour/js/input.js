// Convert keyboard/mouse, touch or a standard gamepad to the same fixed-step
// input object. One-shot actions are buffered until a physics step consumes them.
import { GamepadInput } from './gamepad.js';
import { TouchInput } from './touch.js';

export class Input {
  constructor(canvas, touchControls) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0; this.pitch = 0; this.sensitivity = 1;
    this.locked = false;
    this.edges = { jump: false, crouch: false, use: false };
    this.onKey = () => {};
    this.onLockChange = () => {};
    this.onMode = () => {};
    this.defaultMode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
    this.mode = this.defaultMode;
    this.pad = new GamepadInput();
    this.padState = null;
    this.touch = new TouchInput(canvas, touchControls,
      (x, y) => this.look(x * 0.006, y * 0.006), action => { this.edges[action] = true; });

    document.addEventListener('pointerdown', e => {
      if (['touch', 'pen'].includes(e.pointerType)) this.setMode('touch');
      else if (e.target === canvas) this.setMode('keyboard');
    }, true);
    addEventListener('keydown', e => {
      if (!GAME_KEYS.has(e.code) && !SHORTCUTS.has(e.code)) return;
      if (e.repeat) { if (this.locked && GAME_KEYS.has(e.code)) e.preventDefault(); return; }
      this.setMode('keyboard');
      this.keys.add(e.code);
      if (e.code === 'Space') this.edges.jump = true;
      if (CROUCH.includes(e.code)) this.edges.crouch = true;
      if (e.code === 'KeyE') this.edges.use = true;
      if (GAME_KEYS.has(e.code) && this.locked) e.preventDefault();
      this.onKey(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.clear());
    addEventListener('resize', () => this.touch.clear());
    addEventListener('mousemove', e => {
      if (this.locked && this.mode === 'keyboard' && Math.abs(e.movementX) <= 600 && Math.abs(e.movementY) <= 600) {
        this.look(e.movementX * 0.0021, e.movementY * 0.0021);
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked && this.mode !== 'keyboard') { this.unlock(); return; }
      if (!this.locked) { this.keys.clear(); if (this.mode === 'keyboard') this.clearEdges(); }
      this.onLockChange(this.locked);
    });
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.clear();
    if (mode !== 'keyboard') this.unlock();
    this.onMode(mode);
  }
  look(x, y) {
    this.yaw -= x * this.sensitivity;
    this.pitch = Math.max(-1.52, Math.min(1.52, this.pitch - y * this.sensitivity));
  }
  pollPad() {
    this.padState = this.pad.poll();
    if (this.padState?.used) this.setMode('gamepad');
    return this.mode === 'gamepad' ? this.padState : null;
  }
  applyPad(dt) {
    const p = this.padState;
    if (this.mode !== 'gamepad' || !p) return;
    this.look(p.lookX * 3.3 * dt, p.lookY * 2.5 * dt);
    for (const key of ['jump', 'crouch', 'use']) this.edges[key] ||= p.pressed[key];
  }
  lock() {
    try { this.canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* browser or preview denied it */ }
  }
  unlock() { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
  down(...codes) { return codes.some(c => this.keys.has(c)); }

  sample(first) {
    const e = this.edges, touch = this.touch, pad = this.padState;
    let controls;
    if (this.mode === 'touch') {
      controls = { mx: touch.mx, mz: touch.mz, sprint: touch.sprint, jump: touch.actions.has('jump'), crouch: touch.actions.has('crouch') };
    } else if (this.mode === 'gamepad') {
      controls = { mx: pad?.mx ?? 0, mz: pad?.mz ?? 0, sprint: !!pad?.down.sprint, jump: !!pad?.down.jump, crouch: !!pad?.down.crouch };
    } else {
      controls = {
        mx: Number(this.down('KeyD', 'ArrowRight')) - Number(this.down('KeyA', 'ArrowLeft')),
        mz: Number(this.down('KeyW', 'ArrowUp')) - Number(this.down('KeyS', 'ArrowDown')),
        sprint: this.down('ShiftLeft', 'ShiftRight'), jump: this.down('Space'), crouch: this.down(...CROUCH),
      };
    }
    const out = { ...controls, jumpPressed: first && e.jump, crouchPressed: first && e.crouch, usePressed: first && e.use, yaw: this.yaw, pitch: this.pitch };
    if (first) this.clearEdges();
    return out;
  }
  clearEdges() { this.edges.jump = this.edges.crouch = this.edges.use = false; }
  clear() { this.keys.clear(); this.touch.clear(); this.clearEdges(); }
}
const CROUCH = ['KeyC', 'ControlLeft', 'ControlRight'];
const GAME_KEYS = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', ...CROUCH, 'KeyE', 'KeyR', 'KeyV', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const SHORTCUTS = new Set(['Escape', 'KeyP']);
