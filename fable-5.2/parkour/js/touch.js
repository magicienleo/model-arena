// Independent pointers let the player run, aim and hold an action simultaneously.
import { stick } from './gamepad.js';

export class TouchInput {
  constructor(canvas, controls, onLook, onPress) {
    this.controls = controls;
    this.pointers = new Map();
    this.actions = new Set();
    this.knob = controls.querySelector('.stick-knob');
    this.mx = this.mz = 0;
    this.sprint = false;
    const bind = (el, action) => {
      const updateMove = e => {
        const r = el.getBoundingClientRect(), radius = r.width * 0.36;
        const x = (e.clientX - r.left - r.width / 2) / radius;
        const y = (e.clientY - r.top - r.height / 2) / radius;
        const length = Math.hypot(x, y), n = Math.max(1, length);
        const [mx, my] = stick(x / n, y / n, 0.14);
        this.mx = mx; this.mz = -my;
        // Hysteresis avoids flashing in and out of sprint at the rim.
        this.sprint = this.mz > 0 && length > (this.sprint ? 0.72 : 0.88);
        this.knob.style.transform = `translate(${x / n * radius}px, ${y / n * radius}px)`;
        el.classList.toggle('sprinting', this.sprint);
      };
      el.addEventListener('pointerdown', e => {
        if (!['touch', 'pen'].includes(e.pointerType) || controls.classList.contains('hidden') || this.actions.has(action)) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { action, x: e.clientX, y: e.clientY, el });
        this.actions.add(action);
        el.classList.add('held');
        if (action === 'jump' || action === 'crouch' || action === 'use') onPress(action);
        if (action === 'move') updateMove(e);
      });
      el.addEventListener('pointermove', e => {
        const p = this.pointers.get(e.pointerId);
        if (!p) return;
        if (action === 'move') updateMove(e);
        if (action === 'look') {
          onLook(e.clientX - p.x, e.clientY - p.y);
          p.x = e.clientX; p.y = e.clientY;
        }
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        el.addEventListener(event, e => this.release(e.pointerId));
      }
    };
    bind(canvas, 'look');
    for (const el of controls.querySelectorAll('[data-touch]')) bind(el, el.dataset.touch);
  }

  release(id) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    this.actions.delete(p.action);
    p.el.classList.remove('held', 'sprinting');
    if (p.el.hasPointerCapture(id)) p.el.releasePointerCapture(id);
    if (p.action === 'move') {
      this.mx = this.mz = 0; this.sprint = false;
      this.knob.style.transform = '';
    }
  }

  clear() { for (const id of this.pointers.keys()) this.release(id); }
}
