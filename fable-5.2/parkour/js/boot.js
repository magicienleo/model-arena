// ============================================================================
// boot.js — classic script, runs before any module.
//
// The game is ~40 small modules plus ~200 asset files. Simple static servers
// (python3 -m http.server has an accept backlog of 5) refuse connections when
// a browser opens that many at once, and a single refused module request kills
// the whole import graph without an error. So:
//   1. every fetch() on the page goes through a small gate: a few at a time,
//      each retried if the connection is dropped;
//   2. the module files are pulled through that gate first (which fills the
//      HTTP cache), and only then is the real entry point imported;
//   3. if the import still fails, the page reloads itself a couple of times —
//      everything already fetched is cached, so each attempt gets further.
// ============================================================================
(function () {
  'use strict';
  var MAX_PARALLEL = 4, TRIES = 6;
  var realFetch = window.fetch.bind(window);
  var active = 0, waiting = [];
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function fetchWhole(input, init) {
    for (var i = 0; ; i++) {
      try {
        var res = await realFetch(input, init);
        // hold the slot until the body has fully arrived, then hand back an in-memory response
        var body = await res.arrayBuffer();
        var out = new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
        Object.defineProperty(out, 'url', { value: res.url });
        return out;
      } catch (e) {
        if (i >= TRIES - 1 || (init && init.signal && init.signal.aborted)) throw e;
        await sleep(120 + i * 200);
      }
    }
  }
  window.fetch = function (input, init) {
    var method = (init && init.method) || (input && input.method) || 'GET';
    if (String(method).toUpperCase() !== 'GET') return realFetch(input, init);
    return new Promise(function (resolve, reject) {
      var go = function () {
        active++;
        fetchWhole(input, init).then(resolve, reject).finally(function () { active--; if (waiting.length) waiting.shift()(); });
      };
      if (active < MAX_PARALLEL) go(); else waiting.push(go);
    });
  };

  var A = 'vendor/three/addons/';
  var MODULES = [
    'vendor/three/build/three.module.js',
    A + 'loaders/GLTFLoader.js', A + 'loaders/DRACOLoader.js', A + 'loaders/RGBELoader.js',
    A + 'utils/BufferGeometryUtils.js', A + 'utils/SkeletonUtils.js',
    A + 'postprocessing/EffectComposer.js', A + 'postprocessing/RenderPass.js', A + 'postprocessing/ShaderPass.js',
    A + 'postprocessing/UnrealBloomPass.js', A + 'postprocessing/OutputPass.js', A + 'postprocessing/Pass.js', A + 'postprocessing/MaskPass.js',
    A + 'shaders/CopyShader.js', A + 'shaders/LuminosityHighPassShader.js', A + 'shaders/OutputShader.js',
  ].concat(['main', 'config', 'renderer', 'assets', 'materials', 'geo', 'props', 'physics', 'player', 'leveldata', 'city', 'level',
    'input', 'touch', 'gamepad', 'camera', 'particles', 'audio', 'ghost', 'arms', 'ui', 'bot'].map(function (n) { return 'js/' + n + '.js'; }));

  var KEY = 'lastlight.bootTries';
  function fail(err) {
    var n = 0;
    try { n = parseInt(sessionStorage.getItem(KEY) || '0', 10); sessionStorage.setItem(KEY, String(n + 1)); } catch (e) { n = 99; }
    if (n < 3) { setTimeout(function () { location.reload(); }, 400); return; }
    var el = document.getElementById('err');
    if (el) el.textContent = 'The game code could not be loaded (' + (err && err.message || err) + ').\nCheck that the local server is still running, then reload the page.';
  }

  var queue = MODULES.slice();
  function worker() {
    if (!queue.length) return Promise.resolve();
    // 'no-cache' = always revalidate, so an edited file is never served stale from the HTTP cache
    return fetch(queue.shift(), { cache: 'no-cache' }).catch(function () { /* the import below reports real failures */ }).then(worker);
  }
  Promise.all([worker(), worker(), worker()])
    .then(function () { return import('./main.js'); })
    .then(function () { try { sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ } }, fail);
})();
