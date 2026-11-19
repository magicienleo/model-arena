// Standard Gamepad API mapping (Xbox / PlayStation and compatible controllers).
const buttons = { jump: 0, crouch: 1, use: 2, vision: 3, checkpoint: 4, sprint: 7, pause: 9,
  stickSprint: 10, up: 12, down: 13, left: 14, right: 15 };

export function stick(x = 0, y = 0, deadzone = 0.18) {
  const length = Math.hypot(x, y);
  if (length <= deadzone) return [0, 0];
  const scale = (Math.min(length, 1) - deadzone) / ((1 - deadzone) * length);
  return [x * scale, y * scale];
}

export class GamepadInput {
  constructor(read = () => navigator.getGamepads?.() || []) {
    this.read = read;
    this.index = null;
    this.previous = {};
  }

  poll() {
    let pads;
    try { pads = Array.from(this.read()).filter(p => p?.connected && p.mapping === 'standard'); }
    catch { pads = []; } // Embedded previews can disable the API via Permissions Policy.
    const used = p => Object.values(buttons).some(i => p.buttons[i]?.pressed) || p.axes.some(a => Math.abs(a) > 0.35);
    const current = pads.find(p => p.index === this.index);
    const pad = (current && used(current) ? current : pads.find(used)) || current || pads[0];
    if (!pad) { this.index = null; this.previous = {}; return null; }
    if (pad.index !== this.index) this.previous = {};
    this.index = pad.index;

    const [mx, y] = stick(pad.axes[0], pad.axes[1]);
    const [lookX, lookY] = stick(pad.axes[2], pad.axes[3]);
    const down = {}, pressed = {};
    for (const [name, i] of Object.entries(buttons)) down[name] = !!pad.buttons[i]?.pressed;
    down.sprint ||= down.stickSprint || (pad.buttons[buttons.sprint]?.value ?? 0) > 0.45;
    down.up ||= y < -0.65; down.down ||= y > 0.65;
    down.left ||= mx < -0.65; down.right ||= mx > 0.65;
    for (const name of Object.keys(down)) pressed[name] = down[name] && !this.previous[name];
    this.previous = down;
    return { mx, mz: -y, lookX, lookY, down, pressed, used: used(pad) || down.sprint };
  }
}
