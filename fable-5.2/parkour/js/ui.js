// ============================================================================
// ui.js — DOM HUD and menu screens.
// ============================================================================
const $ = (id) => document.getElementById(id);

export function fmt(t) {
  if (t == null || !isFinite(t)) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}
export function fmtDelta(d) { return `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`; }

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'timer', 'best', 'split', 'cpN', 'fallsN', 'toast', 'prompt', 'capture', 'hint', 'speedFill', 'speedNum', 'rvtag', 'loading', 'barfill', 'loadtxt',
      'start', 'play', 'startBest', 'pause', 'resume', 'toCp', 'restart', 'sens', 'sensV', 'vol', 'volV', 'rv', 'results', 'resTitle', 'resTime', 'resDelta', 'resBest', 'resFalls', 'resTop', 'resSplits', 'again', 'err', 'rvKey', 'zipKey', 'touchControls', 'touchPause', 'enableSound', 'fullscreen', 'fullscreenNotice', 'fullscreenStatus', 'fullscreenTab']) this.el[id] = $(id);
    this.mode = 'keyboard'; this.screen = 'loading'; this.playing = false; this.zipReady = false;
    this._hint = ''; this._splitT = 0; this._toastT = 0; this._lastTimer = '';
  }
  show(name, playing = name === null) {
    this.screen = name;
    this.playing = playing;
    for (const s of ['loading', 'start', 'pause', 'results']) this.el[s].classList.toggle('hidden', s !== name);
    this.updateTouch();
  }
  setMode(mode) {
    this.mode = mode;
    document.documentElement.dataset.input = mode;
    this.el.play.textContent = mode === 'touch' ? 'Tap to play' : mode === 'gamepad' ? 'A / ✕ to play' : 'Click to play';
    this.el.zipKey.textContent = mode === 'touch' ? 'ZIP' : mode === 'gamepad' ? 'X / □' : 'E';
    this.el.rvKey.textContent = mode === 'gamepad' ? "Runner's vision · Y / △" : "Runner's vision · V";
    this.updateTouch();
  }
  updateTouch() {
    const on = this.mode === 'touch' && this.playing;
    this.el.touchControls.classList.toggle('hidden', !on);
    this.el.touchPause.classList.toggle('hidden', !on);
  }
  soundButton(show) { this.el.enableSound.classList.toggle('hidden', !show); }
  useMenuPad(p) {
    const names = { start: ['play'], pause: ['resume', 'toCp', 'restart', 'sens', 'vol', 'rv'], results: ['again'] }[this.screen];
    if (!names) return;
    const items = names.map(id => this.el[id]);
    const i = items.indexOf(document.activeElement);
    const step = Number(p.down) - Number(p.up);
    if (step) { items[i < 0 ? (step > 0 ? 0 : items.length - 1) : (i + step + items.length) % items.length].focus(); return; }
    const target = items[Math.max(0, i)];
    const direction = Number(p.right) - Number(p.left);
    if (direction && target.type === 'range') {
      if (direction < 0) target.stepDown(); else target.stepUp();
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (direction && target.type === 'checkbox') {
      if (target.checked !== (direction > 0)) target.click();
    } else if (p.jump && target.type !== 'range') target.click();
  }
  bindFullscreen() {
    const { fullscreen: button, fullscreenNotice: notice, fullscreenStatus: status, fullscreenTab: tab } = this.el;
    const root = document.documentElement;
    const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    const sync = () => {
      button.textContent = active() ? 'Exit fullscreen' : 'Fullscreen';
      button.setAttribute('aria-pressed', String(active()));
      notice.classList.add('hidden');
    };
    const unavailable = () => {
      const embedded = window.self !== window.top;
      status.textContent = embedded ? 'Fullscreen is unavailable in this preview. Try a new tab.' : 'Fullscreen is unavailable in this browser.';
      tab.href = location.href;
      tab.classList.toggle('hidden', !embedded);
      notice.classList.remove('hidden');
    };
    button.addEventListener('click', async () => {
      if (!notice.classList.contains('hidden')) { notice.classList.add('hidden'); return; }
      try {
        if (active() && exit) await exit.call(document);
        else if (request && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true)) await request.call(root);
        else unavailable();
      } catch { unavailable(); }
    });
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
  }
  hud(on) { this.el.hud.classList.toggle('hidden', !on); }
  progress(p, txt) { this.el.barfill.style.width = `${Math.round(p * 100)}%`; if (txt) this.el.loadtxt.textContent = txt; }
  error(msg) { this.el.err.textContent = msg; }

  timer(t) { const s = fmt(t); if (s !== this._lastTimer) { this.el.timer.textContent = s; this._lastTimer = s; } }
  best(t) { this.el.best.textContent = t ? `Best ${fmt(t)}` : ''; this.el.startBest.textContent = t ? `Best run ${fmt(t)} — your ghost is waiting` : 'No best time yet — set one'; }
  checkpoint(i, n) { this.el.cpN.textContent = `${i} / ${n}`; }
  falls(n) { this.el.fallsN.textContent = n; }
  speed(v, top) {
    this.el.speedFill.style.width = `${Math.min(100, v / top * 100).toFixed(1)}%`;
    this.el.speedNum.textContent = `${Math.round(v * 3.6)} KM/H`;
  }
  hint(text) {
    if (this.mode === 'touch') text = text
      .replace('WASD to move  ·  MOUSE to look  ·  hold SHIFT to sprint', 'Left stick to move · drag to look · push the stick to the edge to sprint')
      .replaceAll('SPACE', 'JUMP').replaceAll('C or CTRL', 'SLIDE').replace('press C just', 'tap SLIDE just').replace('Press E near', 'Tap ZIP near');
    if (this.mode === 'gamepad') text = text
      .replace('WASD to move  ·  MOUSE to look  ·  hold SHIFT to sprint', 'Left stick to move · right stick to look · hold RT / R2 to sprint')
      .replaceAll('SPACE', 'A / ✕').replaceAll('C or CTRL', 'B / ○').replace('press C just', 'press B / ○ just').replace('Press E near', 'Press X / □ near');
    if (text === this._hint) return;
    this._hint = text;
    if (text) this.el.hint.textContent = text;
    this.el.hint.classList.toggle('show', !!text);
  }
  prompt(on) {
    if (this.zipReady === on) return;
    this.zipReady = on;
    this.el.prompt.classList.toggle('show', on);
    this.el.touchControls.querySelector('.touch-zip').classList.toggle('ready', on);
  }
  rv(on) { this.el.rvtag.classList.toggle('off', !on); this.el.rv.checked = on; }
  split(name, time, delta) {
    const cls = delta == null ? 'neutral' : delta <= 0 ? 'ahead' : 'behind';
    this.el.split.innerHTML = `<span class="name">${name}</span><span class="${cls}">${fmt(time)}${delta == null ? '' : '  ' + fmtDelta(delta)}</span>`;
    this.el.split.classList.add('show'); this._splitT = 3.2;
  }
  toast(text, dur = 1.6) { this.el.toast.textContent = text; this.el.toast.classList.add('show'); this._toastT = dur; }
  update(dt) {
    if (this._splitT > 0 && (this._splitT -= dt) <= 0) this.el.split.classList.remove('show');
    if (this._toastT > 0 && (this._toastT -= dt) <= 0) this.el.toast.classList.remove('show');
  }

  results(r) {
    this.el.resTitle.textContent = r.newBest ? 'NEW BEST' : 'RUN COMPLETE';
    this.el.resTime.textContent = fmt(r.time);
    this.el.resDelta.innerHTML = r.prevBest == null ? 'First completed run' : `<span class="${r.time <= r.prevBest ? 'ahead' : 'behind'}">${fmtDelta(r.time - r.prevBest)} vs previous best</span>`;
    this.el.resBest.textContent = fmt(r.best); this.el.resFalls.textContent = r.falls; this.el.resTop.textContent = `${Math.round(r.topSpeed * 3.6)} km/h`;
    let rows = '';
    r.splits.forEach((s, i) => {
      if (i === 0) return;
      const b = r.prevSplits ? r.prevSplits[i] : null;
      const d = s != null && b != null ? s - b : null;
      rows += `<tr><td>${r.names[i]}</td><td>${s == null ? 'skipped' : fmt(s)}</td><td class="${d == null ? '' : d <= 0 ? 'ahead' : 'behind'}">${d == null ? '' : fmtDelta(d)}</td></tr>`;
    });
    const fd = r.prevBest == null ? null : r.time - r.prevBest;
    rows += `<tr><td>Finish</td><td>${fmt(r.time)}</td><td class="${fd == null ? '' : fd <= 0 ? 'ahead' : 'behind'}">${fd == null ? '' : fmtDelta(fd)}</td></tr>`;
    this.el.resSplits.innerHTML = rows;
  }
}
