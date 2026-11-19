import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GamepadInput, stick } from '../js/gamepad.js';

function controller(index = 0) {
  return { connected: true, index, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
}
function hold(pad, button, value = 1) { pad.buttons[button] = { pressed: value >= 0.5, value }; }

test('stick removes drift and keeps diagonal input within the unit circle', () => {
  assert.deepEqual(stick(0.1, 0.1), [0, 0]);
  assert.equal(stick(0, -1)[1], -1);
  assert.ok(Math.abs(Math.hypot(...stick(1, -1)) - 1) < 1e-10);
});

test('actions emit one press, can be held, and reset on release and disconnect', () => {
  const pad = controller();
  const input = new GamepadInput(() => [null, pad]);
  for (const [button, action] of [[0, 'jump'], [1, 'crouch'], [2, 'use'], [3, 'vision'], [4, 'checkpoint'], [9, 'pause']]) {
    hold(pad, button);
    const initial = input.poll();
    assert.equal(initial.pressed[action], true);
    assert.equal(initial.used, true);
    const repeated = input.poll();
    assert.equal(repeated.pressed[action], false);
    assert.equal(repeated.down[action], true);
    hold(pad, button, 0);
    assert.equal(input.poll().down[action], false);
  }
  hold(pad, 0);
  input.poll();
  pad.connected = false;
  assert.equal(input.poll(), null);
  pad.connected = true;
  assert.equal(input.poll().pressed.jump, true);
});

test('supports analog sprint and menu navigation on the controller in use', () => {
  const idle = controller(), active = controller(1);
  const input = new GamepadInput(() => [idle, active]);
  assert.equal(input.poll().used, false);
  active.axes = [0, -1, 0.5, 0];
  hold(active, 7, 0.47);
  const p = input.poll();
  assert.equal(p.mz, 1);
  assert.ok(p.lookX > 0);
  assert.equal(p.pressed.up, true);
  assert.equal(p.down.sprint, true);
  assert.equal(input.poll().pressed.up, false);
  active.axes = [0, 0, 0, 0];
  hold(active, 7, 0);
  hold(active, 10);
  assert.equal(input.poll().down.sprint, true);
  hold(active, 13);
  assert.equal(input.poll().pressed.down, true);
});

test('ignores nonstandard mappings and tolerates denied gamepad access', () => {
  const pad = { ...controller(), mapping: '' };
  assert.equal(new GamepadInput(() => [pad]).poll(), null);
  assert.equal(new GamepadInput(() => { throw new Error('not allowed'); }).poll(), null);
});
