/* ════════════════════════════════════════════════════════════════════════════
   intro-isocline.js   (v1)
   Bespoke first-visit intro for the β-isocline explorer.

   Drop-in module:  <script src="intro-isocline.js"></script>
   Required in main script:
     window.S = S;
     window.recomputeAndDraw = recomputeAndDraw;
     window.syncAlphaUI = syncAlphaUI;
     window.syncBetaUI  = syncBetaUI;
     window.syncNwalksUI = syncNwalksUI;
     window.toggleViz   = toggleViz;     // optional; falls back to S.iso.vis
═══════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

const STORAGE_KEY  = 'zeta-isocline:intro-seen:v1';
const PACE         = 1.0;             // global wallclock multiplier

// Coherence-harmonic anchor — Δβ ∈ ±σ around this β shows a trajectory that
// smoothly unfurls/refurls. Scene 1 lands here as part of the α-fan collapse
// so scenes 2-7 inherit a known-good neighborhood.
const BETA_GOOD    = 6509.657535457885;

const KATEX_OPTS   = { throwOnError: false, trust: true, strict: false };

const dom = {};

/* ════════════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════════ */
function ready() {
  return typeof window.S !== 'undefined'
      && typeof window.S.beta    === 'number'
      && typeof window.S.alphaLo === 'number'
      && typeof window.recomputeAndDraw === 'function'
      && typeof window.katex !== 'undefined'
      && document.getElementById('canvas')
      && document.getElementById('sl-beta')
      && document.getElementById('sl-alpha-lo')
      && document.getElementById('sl-alpha-hi')
      && document.getElementById('sl-nwalks');
}
let bootAttempts = 0;
function bootDiagnose() {
  const checks = {
    'window.S':                typeof window.S !== 'undefined',
    'S.beta number':           typeof (window.S && window.S.beta) === 'number',
    'window.recomputeAndDraw': typeof window.recomputeAndDraw === 'function',
    'window.katex':            typeof window.katex !== 'undefined',
    '#canvas':                 !!document.getElementById('canvas'),
    '#sl-beta':                !!document.getElementById('sl-beta'),
    '#sl-alpha-lo':            !!document.getElementById('sl-alpha-lo'),
    '#sl-alpha-hi':            !!document.getElementById('sl-alpha-hi'),
    '#sl-nwalks':              !!document.getElementById('sl-nwalks'),
  };
  const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  console.warn('[intro-isocline] waiting on app globals (~3s elapsed). Missing:', missing);
  if (missing.includes('window.S')) {
    console.warn('[intro-isocline] FIX: expose viewer globals at the end of the main <script>:\n' +
      '  window.S = S;\n' +
      '  window.recomputeAndDraw = recomputeAndDraw;\n' +
      '  window.syncAlphaUI = syncAlphaUI;\n' +
      '  window.syncBetaUI  = syncBetaUI;\n' +
      '  window.syncNwalksUI = syncNwalksUI;\n' +
      '  window.toggleViz   = toggleViz;');
  }
}
function boot() {
  if (!ready()) {
    bootAttempts++;
    if (bootAttempts === 50) bootDiagnose();
    setTimeout(boot, 60);
    return;
  }

  installCSS();
  installDOM();

  window.__intro = {
    play: playIntro,
    skip: skipIntro,
    active: false,
    debug: (new URLSearchParams(location.search).get('debug') === 'intro'),
  };

  // First-visit emphasis: the INTRO button pulses (see installDOM), but the
  // intro does NOT auto-play. The user clicks INTRO to start it.
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* ════════════════════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════════════════ */
function installCSS() {
  const css = `
    /* INTRO button — small pill in the params-panel header (mirrors the partial-sums viewer). */
    #intro-replay-btn {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.14); border-radius: 100px;
      color: rgba(147,197,253,0.78);
      font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.10em;
      padding: 3px 9px; margin: 0 8px; cursor: pointer;
      transition: color .15s, border-color .15s, box-shadow .3s;
    }
    #intro-replay-btn:hover { color: #fff; border-color: rgba(147,197,253,0.55); }

    /* First-visit attract pulse — calms to plain styling after first interaction. */
    @keyframes intro-attract-pulse {
      0%, 100% {
        box-shadow: 0 0 0 rgba(147,197,253,0), 0 0 0 rgba(180,150,255,0);
        border-color: rgba(255,255,255,0.14);
        color: rgba(147,197,253,0.78);
        background: rgba(255,255,255,0.04);
      }
      50% {
        box-shadow: 0 0 20px rgba(180,150,255,0.62), 0 0 6px rgba(180,150,255,0.40);
        border-color: rgba(205,175,255,0.88);
        color: rgba(232,212,255,1);
        background: rgba(180,150,255,0.09);
      }
    }
    #intro-replay-btn.intro-attract { animation: intro-attract-pulse 1.9s ease-in-out infinite; }

    /* Slider-driving glow — visible cue when a slider is being animated by the intro. */
    input[type=range].intro-driving { animation: intro-glow 1.4s ease-in-out infinite; }
    @keyframes intro-glow {
      0%, 100% { background: rgba(147,197,253,0.18); }
      50%      { background: rgba(147,197,253,0.55); }
    }
    input[type=range].intro-driving::-webkit-slider-thumb {
      box-shadow: 0 0 22px rgba(147,197,253,1.0), 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.7) !important;
      transform: scale(1.25);
    }

    /* Highlight pulse for non-slider components (toggles, buttons). Short
     * one-shot animation that draws attention to a UI element when the intro
     * interacts with it. */
    .intro-highlight {
      animation: intro-highlight-pulse 1.6s ease-in-out;
      border-radius: 6px;
    }
    @keyframes intro-highlight-pulse {
      0%, 100% { box-shadow: 0 0 0 rgba(180,150,255,0); }
      30%      { box-shadow: 0 0 20px rgba(180,150,255,0.85), 0 0 6px rgba(180,150,255,0.55); }
      70%      { box-shadow: 0 0 10px rgba(180,150,255,0.45); }
    }

    #intro-caption-wrap {
      position: fixed;
      right: 36px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 1400;
      width: min(440px, 36vw);
      pointer-events: none;
    }
    .caption-layer {
      position: absolute;
      top: 50%; left: 0; right: 0;
      transform: translateY(-50%);
      padding: 18px 26px;
      color: #e9eef7;
      font: 18px/1.55 'IBM Plex Mono', ui-monospace, monospace;
      letter-spacing: 0.01em;
      text-align: center;
      text-shadow: 0 0 14px rgba(0,0,0,0.92), 0 0 28px rgba(0,0,0,0.65);
      opacity: 0;
      transition: opacity .45s ease, transform .45s ease;
    }
    .caption-layer.in   { opacity: 1; transform: translateY(-50%); }
    .caption-layer.out  { opacity: 0; transform: translateY(calc(-50% + 8px)); }
    .caption-layer .katex { color: inherit; }
    .caption-line {
      display: block;
      margin: 6px 0;
    }
    .caption-line .katex-display { margin: 0; }

    #intro-nav {
      position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
      z-index: 1500;
      display: none;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(7,7,13,0.65);
      border: 1px solid rgba(155,205,255,0.32);
      backdrop-filter: blur(12px) saturate(160%);
      -webkit-backdrop-filter: blur(12px) saturate(160%);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    #intro-nav.show { display: inline-flex; }
    #intro-nav button {
      all: unset;
      width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%;
      color: #cde;
      cursor: pointer;
      font: 14px/1 'IBM Plex Mono', ui-monospace, monospace;
      transition: background .12s;
    }
    #intro-nav button:hover { background: rgba(155,205,255,0.18); }
    #intro-nav .play-pause::before { content: '⏸'; }
    #intro-nav.paused .play-pause::before { content: '⏵'; }
  `;
  const style = document.createElement('style');
  style.id = 'intro-isocline-style';
  style.textContent = css;
  document.head.appendChild(style);
}

/* ════════════════════════════════════════════════════════════════════════════
   DOM
═══════════════════════════════════════════════════════════════════════════ */
function installDOM() {
  // INTRO pill — inserted into the params-panel header, before the chevron.
  const btn = document.createElement('button');
  btn.id = 'intro-replay-btn';
  btn.type = 'button';
  btn.textContent = '▶ INTRO';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.classList.remove('intro-attract');
    playIntro();
  });
  const phParams = document.getElementById('ph-params');
  const chevron  = document.getElementById('ch-params');
  if (chevron && chevron.parentNode) {
    // Insert before the chevron, using its actual parent (handles both layouts:
    // chevron as a direct child of ph-params, or wrapped inside a .hdr-ctls span).
    chevron.parentNode.insertBefore(btn, chevron);
  } else if (phParams) {
    phParams.appendChild(btn);
  } else {
    document.body.appendChild(btn);   // last-ditch fallback
  }
  dom.btn = btn;

  // First-visit attract pulse — calms down on first interaction OR after 14s.
  if (!localStorage.getItem(STORAGE_KEY)) {
    btn.classList.add('intro-attract');
    setTimeout(() => btn.classList.remove('intro-attract'), 14000);
  }

  const capWrap = document.createElement('div');
  capWrap.id = 'intro-caption-wrap';
  document.body.appendChild(capWrap);
  dom.capWrap = capWrap;

  const nav = document.createElement('div');
  nav.id = 'intro-nav';
  nav.innerHTML = `
    <button class="prev" title="Previous scene">⏮</button>
    <button class="play-pause" title="Pause/play"></button>
    <button class="next" title="Skip to next scene">⏭</button>
    <button class="close" title="Exit intro">✕</button>
  `;
  document.body.appendChild(nav);
  dom.nav = nav;
  nav.querySelector('.prev').addEventListener('click', () => { introState.skipPrev = true; });
  nav.querySelector('.next').addEventListener('click', () => { introState.skipNext = true; });
  nav.querySelector('.play-pause').addEventListener('click', () => {
    introState.paused = !introState.paused;
    nav.classList.toggle('paused', introState.paused);
    if (introState.paused) introState.pauseStart = performance.now();
    else if (introState.pauseStart) {
      introState.totalPaused += performance.now() - introState.pauseStart;
      introState.pauseStart = 0;
    }
  });
  nav.querySelector('.close').addEventListener('click', skipIntro);
}

/* ════════════════════════════════════════════════════════════════════════════
   CAPTIONS  (cross-fade between layers)
═══════════════════════════════════════════════════════════════════════════ */
function renderKatex(latex, target) {
  try { window.katex.render(latex, target, KATEX_OPTS); }
  catch (e) { target.textContent = latex; }
}
function createCaptionLayer(latex) {
  const layer = document.createElement('div');
  layer.className = 'caption-layer';
  const lines = String(latex).split('\n').map(s => s.trim()).filter(s => s.length > 0);
  for (const line of lines) {
    const lineEl = document.createElement('div');
    lineEl.className = 'caption-line';
    renderKatex(line, lineEl);
    layer.appendChild(lineEl);
  }
  dom.capWrap.appendChild(layer);
  return layer;
}
async function showCaption(latex) {
  const oldLayers = Array.from(dom.capWrap.querySelectorAll('.caption-layer'));
  const layer = createCaptionLayer(latex);
  await new Promise(r => requestAnimationFrame(r));
  layer.classList.add('in');
  for (const ol of oldLayers) {
    ol.classList.remove('in');
    ol.classList.add('out');
    setTimeout(() => ol.remove(), 500);
  }
}
async function hideCaption() {
  const layers = Array.from(dom.capWrap.querySelectorAll('.caption-layer'));
  for (const l of layers) { l.classList.remove('in'); l.classList.add('out'); }
  await new Promise(r => setTimeout(r, 500));
  for (const l of layers) l.remove();
}
function clearCaptions() {
  for (const l of Array.from(dom.capWrap.querySelectorAll('.caption-layer'))) l.remove();
}

/* ════════════════════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════════════════ */
const introState = {
  active: false,
  paused: false,
  pauseStart: 0,
  totalPaused: 0,
  skipNext: false,
  skipPrev: false,
  sceneIdx: 0,
  token: 0,
};

/* Drive viewer state directly — bypasses slider clamps (we want nwalks=1 and
 * alphaLo ≈ alphaHi, neither of which the live sliders allow). The viewer's
 * recomputeAndDraw + autoFit handle the rendering.
 *
 * fineDelta is honored only when S.isFine is on. β is then computed from
 * betaCenter + 10^sigmaExp · fineDelta (the same formula the live slider uses). */
function setIntroState({ beta, alphaLo, alphaHi, nwalks, fineDelta, refit }) {
  const S = window.S;
  if (beta !== undefined && beta !== S.beta) {
    S.beta = beta; S.betaCenter = beta; S.fineDelta = 0;
    if (window.syncBetaUI) window.syncBetaUI();
  }
  if (alphaLo !== undefined) S.alphaLo = alphaLo;
  if (alphaHi !== undefined) S.alphaHi = alphaHi;
  if ((alphaLo !== undefined || alphaHi !== undefined) && window.syncAlphaUI) window.syncAlphaUI();
  if (nwalks !== undefined && nwalks !== S.nwalks) {
    S.nwalks = nwalks;
    if (window.syncNwalksUI) window.syncNwalksUI();
  }
  if (fineDelta !== undefined && S.isFine) {
    S.fineDelta = fineDelta;
    S.beta = S.betaCenter + Math.pow(10, S.sigmaExp) * fineDelta;
    if (window.syncFineUI) window.syncFineUI();
    if (window.syncBetaUI) window.syncBetaUI();
  }
  window.recomputeAndDraw(!!refit);
}

/* Enter fine-tuning mode anchored at the current β, with σ = 10^sigmaExp.
 * Mirrors the viewer's toggleFine() but lets the intro pick σ directly. */
function enterFineMode(sigma) {
  const S = window.S;
  S.isFine = true;
  S.betaCenter = S.beta;
  S.sigmaExp = Math.log10(sigma);
  S.fineDelta = 0;
  const fbtn = document.getElementById('fine-btn');
  const fsub = document.getElementById('fine-sub');
  if (fbtn) fbtn.classList.add('on');
  if (fsub) fsub.classList.add('open');
  if (window.syncFineUI) window.syncFineUI();
  if (window.syncBetaUI) window.syncBetaUI();
}
function exitFineMode() {
  const S = window.S;
  S.isFine = false;
  S.betaCenter = S.beta;
  S.fineDelta = 0;
  const fbtn = document.getElementById('fine-btn');
  const fsub = document.getElementById('fine-sub');
  if (fbtn) fbtn.classList.remove('on');
  if (fsub) fsub.classList.remove('open');
  if (window.syncFineUI) window.syncFineUI();
  if (window.syncBetaUI) window.syncBetaUI();
}

/* Pin the camera at a wide framing that gives the trajectory room to morph
 * without going off-screen. Calls the viewer's autoFit at the current state,
 * then zooms out around screen-center by 1/zoomFactor. */
function wideCamera(zoomFactor = 0.55) {
  const S = window.S;
  if (window.autoFit && S.pd) window.autoFit(S.pd);
  const ox = window.innerWidth / 2, oy = window.innerHeight / 2;
  const { scale: sc, cx, cy } = S.tx;
  const xf = (ox - cx) / sc, yf = (oy - cy) / sc;
  const ns = sc * zoomFactor;
  S.tx = { scale: ns, cx: ox - xf * ns, cy: oy - yf * ns };
  window.recomputeAndDraw(false);
}

/* Visual cue — pulse the slider(s) being driven by the current scene. Accepts
 * a single id or an array. Passing null/undefined clears all. */
function setDrivingSlider(ids) {
  for (const el of document.querySelectorAll('input[type=range].intro-driving')) {
    el.classList.remove('intro-driving');
  }
  if (!ids) return;
  const list = Array.isArray(ids) ? ids : [ids];
  for (const id of list) {
    const el = document.getElementById(id);
    if (el) el.classList.add('intro-driving');
  }
}
function clearDrivingSlider() { setDrivingSlider(null); }

/* One-shot pulse for non-slider components (toggles, buttons). Accepts one or
 * several element ids — both the panel-row toggle and the compact-bar icon
 * usually need to pulse together. */
function highlightElement(ids, duration = 1600) {
  const list = Array.isArray(ids) ? ids : [ids];
  for (const id of list) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.remove('intro-highlight');     // restart animation if mid-flight
    void el.offsetWidth;                         // force reflow
    el.classList.add('intro-highlight');
    setTimeout(() => el.classList.remove('intro-highlight'), duration);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   TWEEN
═══════════════════════════════════════════════════════════════════════════ */
function easeInOutCubic(t)  { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
function easeInOutQuart(t)  { return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2; }
function easeInOutQuint(t)  { return t < 0.5 ? 16*t*t*t*t*t : 1 - Math.pow(-2*t+2, 5)/2; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function tweenState({ from, to, duration, ease = easeInOutCubic, onUpdate, refit = false }) {
  const token = introState.token;
  const start = performance.now();
  const dur = duration * PACE;
  return new Promise((resolve) => {
    function step() {
      if (token !== introState.token || !introState.active) { resolve(); return; }
      if (introState.skipNext || introState.skipPrev)        { resolve(); return; }
      if (introState.paused) { requestAnimationFrame(step); return; }
      const elapsed = performance.now() - start - introState.totalPaused;
      const t = clamp01(elapsed / dur);
      const e = ease(t);
      const cur = {};
      for (const k of Object.keys(to)) {
        if (from[k] === undefined) continue;
        let v = from[k] + (to[k] - from[k]) * e;
        if (k === 'nwalks') v = Math.max(1, Math.round(v));
        cur[k] = v;
      }
      cur.refit = refit;
      setIntroState(cur);
      if (onUpdate) onUpdate(cur, t);
      if (t >= 1) { resolve(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

function delay(ms) {
  const token = introState.token;
  const start = performance.now();
  const dur = ms * PACE;
  return new Promise(resolve => {
    function step() {
      if (token !== introState.token || !introState.active) { resolve(); return; }
      if (introState.skipNext || introState.skipPrev)        { resolve(); return; }
      if (introState.paused) { requestAnimationFrame(step); return; }
      const elapsed = performance.now() - start - introState.totalPaused;
      if (elapsed >= dur) { resolve(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* tweenCurve — drive state from a parametric function curve(t) → state-object.
 * Use this for sine cycles or other non-linear trajectories the standard
 * lerp can't express (e.g. start-at-zero / end-at-zero patterns). */
function tweenCurve({ duration, curve, refit = false, onUpdate }) {
  const token = introState.token;
  const start = performance.now();
  const dur = duration * PACE;
  return new Promise(resolve => {
    function step() {
      if (token !== introState.token || !introState.active) { resolve(); return; }
      if (introState.skipNext || introState.skipPrev)        { resolve(); return; }
      if (introState.paused) { requestAnimationFrame(step); return; }
      const elapsed = performance.now() - start - introState.totalPaused;
      const t = clamp01(elapsed / dur);
      const values = curve(t);
      setIntroState({ ...values, refit });
      if (onUpdate) onUpdate(values, t);
      if (t >= 1) { resolve(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   SCENES
═══════════════════════════════════════════════════════════════════════════ */
function snapshotEntryState() {
  return {
    beta:    window.S.beta,
    alphaLo: window.S.alphaLo,
    alphaHi: window.S.alphaHi,
    nwalks:  window.S.nwalks,
    isoVis:  window.S.iso.vis,
    trajVis: window.S.traj.vis,
  };
}

function setIsoVisibility(on) {
  if (window.S.iso.vis === on) return;
  highlightElement(['tog-iso', 'icon-iso']);    // both UI views of the iso toggle
  if (window.toggleViz) {
    window.toggleViz('iso', { stopPropagation: () => {} });
  } else {
    window.S.iso.vis = on;
    window.recomputeAndDraw(false);
  }
}
function setTrajVisibility(on) {
  if (window.S.traj.vis === on) return;
  highlightElement(['tog-traj', 'icon-traj']);
  if (window.toggleViz) {
    window.toggleViz('traj', { stopPropagation: () => {} });
  } else {
    window.S.traj.vis = on;
    window.recomputeAndDraw(false);
  }
}

/* SCENE 1
 * Collapse the (α₀..α₁) × N-walk fan to a single (½ + iβ) walk, AND land β
 * at the coherence-harmonic center so scenes 2-7 start in the good region. */
async function scene1(entry) {
  setIsoVisibility(false);
  await showCaption(
    `\\zeta(s)\\;=\\;\\sum_{n=1}^{\\tau} n^{-s}
     \\text{walk up to}\\;\\;\\tau=\\lfloor\\beta/\\pi\\rfloor`
  );
  setDrivingSlider(['sl-alpha-lo', 'sl-alpha-hi', 'sl-nwalks', 'sl-beta']);
  await tweenState({
    from: { alphaLo: window.S.alphaLo, alphaHi: window.S.alphaHi, nwalks: window.S.nwalks, beta: window.S.beta },
    to:   { alphaLo: 0.5,              alphaHi: 0.5,              nwalks: 1,                beta: BETA_GOOD },
    duration: 2800,
    refit: true,
  });
  clearDrivingSlider();
  await delay(900);
}

/* SCENE 2
 * Adjust β; show the coherence harmonic unfurl and refurl. Uses fine-tuning
 * (σ = 30) so we stay inside the known-good β ± 30 region, and drives Δβ as
 * a sine cycle sin(2π·t) — one continuous motion through 0 → +1 → 0 → -1 → 0
 * with no stutter at endpoints. Camera pinned wide so the framing doesn't
 * follow β. */
async function scene2(entry) {
  await showCaption(
    `\\text{The }\\beta\\text{-slider sets the}
     \\text{logarithmic winding frequency}
     \\theta_n=|\\beta|\\,\\ln n`
  );
  wideCamera(0.55);
  enterFineMode(30);
  setDrivingSlider(['sl-fine-delta', 'sl-beta']);
  await delay(400);
  await tweenCurve({
    duration: 4000,                                 // quick reference (was 60s)
    // Half-excursion sine: Δβ stays inside [-0.5, +0.5]. One full cycle in 4s
    // gives a brisk "this is what Δβ does" demonstration before scene 3.
    curve: (t) => ({ fineDelta: 0.5 * Math.sin(2 * Math.PI * t) }),
  });
  clearDrivingSlider();
  exitFineMode();
  await delay(700);
}

/* SCENE 3
 * ξ(s)ζ(s) = ξ(1−s)ζ(1−s) → mirror about Re(s)=½ on the same β-isocline.
 * Parameterize α₀=½−η, α₁=½+η with nwalks=2, then expand η. */
async function scene3(entry) {
  await showCaption(
    `\\xi(s)=\\xi(1{-}s)
     \\Rightarrow\\;\\text{mirror about}\\;\\mathrm{Re}(s)=\\tfrac12
     \\text{on this }\\beta\\text{-isocline}`
  );
  // Snap to two walks pinned right at ½ (small ε so the compute sees distinct rows).
  setIntroState({ alphaLo: 0.499, alphaHi: 0.501, nwalks: 2, refit: true });
  setDrivingSlider(['sl-alpha-lo', 'sl-alpha-hi', 'sl-nwalks']);
  await delay(500);
  const eta = 0.15;                                  // smaller — leave room for scene 5's α₀ → 0.2
  await tweenState({
    from: { alphaLo: 0.499,     alphaHi: 0.501 },
    to:   { alphaLo: 0.5 - eta, alphaHi: 0.5 + eta },
    duration: 2200,
    refit: true,
  });
  clearDrivingSlider();
  await delay(800);
}

/* SCENE 4
 * Build out the upper half of the α-window. Three separate motions so the
 * user can read each slider's role:
 *   (a) bump nwalks 2 → 51 — sample 50 new α-values around ½ ± η
 *   (b) stretch α₁ → 7 — the upper edge moves into Re(s) > 1
 *   (c) bump nwalks 51 → 101 — fill in the parallel structure across the wider band */
async function scene4(entry) {
  await showCaption(
    `\\text{Adding walks along the }\\beta\\text{-isocline,}
     \\text{each sharing }\\theta_n=|\\beta|\\,\\ln n
     \\text{but with a different radial decay }n^{-\\alpha}
     \\text{Stretching }\\alpha_1\\to 7\\text{ enters }\\mathrm{Re}(s)>1
     \\text{where walks converge in just a few terms}`
  );

  // (a) sample 50 more walks across the narrow α-band
  setDrivingSlider(['sl-nwalks']);
  await tweenState({
    from: { nwalks: window.S.nwalks },
    to:   { nwalks: 51 },
    duration: 1800,
    refit: true,
  });
  clearDrivingSlider();
  await delay(500);

  // (b) stretch the upper edge α₁ → 7
  setDrivingSlider(['sl-alpha-hi']);
  await tweenState({
    from: { alphaHi: window.S.alphaHi },
    to:   { alphaHi: 7 },
    duration: 3000,
    refit: true,
  });
  clearDrivingSlider();
  await delay(500);

  // (c) 50 more walks to resolve the parallel structure
  setDrivingSlider(['sl-nwalks']);
  await tweenState({
    from: { nwalks: window.S.nwalks },
    to:   { nwalks: 101 },
    duration: 1800,
    refit: true,
  });
  clearDrivingSlider();
  await delay(800);
}

/* SCENE 5
 * Now the lower edge: α₀ → -0.1 pushes into the absolutely divergent region.
 * Partial sums grow without bound there, but the angular alignment from
 * θ_n = |β|ln(n) survives — so every τ-vertex stays on the isocline skeleton.
 *   (a) α₀ → -0.1 alone
 *   (b) nwalks 101 → 151 — final isocline resolution */
async function scene5(entry) {
  await showCaption(
    `\\text{Pushing }\\alpha_0\\to -0.1\\text{ into }\\mathrm{Re}(s)<0
     \\text{Partial sums grow without bound here,}
     \\text{yet every }\\tau\\text{-vertex still aligns}
     \\text{with its convergent neighbors on the isocline}`
  );

  // (a) α₀ → -0.1
  setDrivingSlider(['sl-alpha-lo']);
  await tweenState({
    from: { alphaLo: window.S.alphaLo },
    to:   { alphaLo: -0.1 },
    duration: 3000,
    refit: true,
  });
  clearDrivingSlider();
  await delay(500);

  // (b) final 50 walks to reach 151 total
  setDrivingSlider(['sl-nwalks']);
  await tweenState({
    from: { nwalks: window.S.nwalks },
    to:   { nwalks: 151 },
    duration: 1800,
    refit: true,
  });
  clearDrivingSlider();
  await delay(800);
}

/* SCENE 6
 * Flip on the isocline layer — reveal the bijective τ-vertex skeleton. */
async function scene6(entry) {
  await showCaption(
    `\\theta_n=|\\beta|\\,\\ln n\\;\\text{is}\\;\\alpha\\text{-free}
     \\Rightarrow\\;\\text{every }\\tau\\text{-vertex is shared}
     \\text{across the }\\beta\\text{-isocline}`
  );
  await delay(1500);
  setIsoVisibility(true);
  await delay(1100);
  await showCaption(
    `\\text{Connecting }\\tau_n\\text{ vertices:}
     \\text{a bijective skeleton across the}
     \\text{radial damping family}
     r_n(\\tau)=\\tau^{-\\alpha}`
  );
  await delay(2200);
}

/* SCENE 7
 * Sweep β through a wider isocline band. Same sine-cycle pattern as scene 2
 * (so the motion is smooth and lands back at center) but with σ = 60 — twice
 * the range of scene 2, still inside the broader coherence region around
 * BETA_GOOD. */
async function scene7(entry) {
  await showCaption(
    `\\text{Sweeping }\\beta\\text{ traverses}
     \\text{the continuous family of isoclines}
     \\text{a 3D projective skeleton on}\\;\\mathbb{C}`
  );
  wideCamera(0.50);
  enterFineMode(5);      // σ much lower (was 30) — β-range ±2.5 and a 6× slower
                         // max (d/dt)β than the previous edit. Pairs naturally
                         // with the U(1) close-up: tight β-zoom near the harmonic.
  setDrivingSlider(['sl-fine-delta', 'sl-beta']);
  await delay(400);

  // Snapshot the camera AFTER wideCamera() has set it, then lerp toward a
  // close-up centered on the U(1) reference circles (drawn at data origin —
  // screen position is (S.tx.cx, S.tx.cy); on-screen radius is S.tx.scale).
  // Putting origin at screen center and choosing scale ≈ 15% of the smaller
  // viewport edge puts the unit circle at ~30% of that edge.
  const startTx = { ...window.S.tx };
  const ow = window.innerWidth, oh = window.innerHeight;
  const targetTx = {
    cx:    ow / 2,
    cy:    oh / 2,
    scale: Math.min(ow, oh) * 0.15,
  };
  const CAM_FINISH = 0.7;   // camera reaches U(1) close-up at 70% of the sweep,
                            // then holds at target while β finishes oscillating

  await tweenCurve({
    duration: 25000,                              // slightly longer (was 22s)
    // Monotonic one-direction sweep: easeInOutCubic over 0 → +1 means Δβ
    // enters and exits with zero velocity, so the slider gently accelerates
    // from center and decelerates to a stop at the right edge. The built-in
    // ease-out is the "ramp down" — by t=0.75 we've covered ~94% of the
    // motion; the last quarter just creeps the slider into its final rest.
    curve: (t) => ({ fineDelta: easeInOutCubic(t) }),
    onUpdate: (_, t) => {
      const e = easeInOutCubic(Math.min(1, t / CAM_FINISH));
      const tx = window.S.tx;
      tx.scale = startTx.scale + (targetTx.scale - startTx.scale) * e;
      tx.cx    = startTx.cx    + (targetTx.cx    - startTx.cx)    * e;
      tx.cy    = startTx.cy    + (targetTx.cy    - startTx.cy)    * e;
    },
  });
  clearDrivingSlider();

  // Cheers — acknowledge the hand-off, give the user a beat to read.
  await showCaption(
    `\\text{That's the tour!}
     \\text{The controls are yours now.}`
  );

  // While the cheers text holds, drift α₀ up to 0.3 so the divergent
  // lower-edge walks shrink and everything fits inside the U(1) close-up
  // before the user takes control. refit:false keeps the camera locked.
  setDrivingSlider(['sl-alpha-lo']);
  const alphaTween = tweenState({
    from: { alphaLo: window.S.alphaLo },
    to:   { alphaLo: 0.3 },
    duration: 2200,
    refit: false,
  });
  await Promise.all([alphaTween, delay(2800)]);
  clearDrivingSlider();

  exitFineMode();
  await delay(1000);
}

/* ════════════════════════════════════════════════════════════════════════════
   ORCHESTRATION
═══════════════════════════════════════════════════════════════════════════ */
async function playIntro() {
  if (introState.active) return;
  localStorage.setItem(STORAGE_KEY, '1');

  introState.active = true;
  introState.paused = false;
  introState.totalPaused = 0;
  introState.skipNext = false;
  introState.skipPrev = false;
  introState.sceneIdx = 0;
  introState.token++;
  window.__intro.active = true;

  dom.btn.classList.remove('intro-attract');   // calm the pulse once intro starts
  dom.nav.classList.add('show');
  dom.nav.classList.remove('paused');

  const entry = snapshotEntryState();
  const scenes = [scene1, scene2, scene3, scene4, scene5, scene6, scene7];

  try {
    while (introState.sceneIdx < scenes.length && introState.active) {
      introState.skipNext = false;
      introState.skipPrev = false;
      await scenes[introState.sceneIdx](entry);
      if (!introState.active) break;
      if (introState.skipPrev) {
        introState.sceneIdx = Math.max(0, introState.sceneIdx - 1);
      } else {
        introState.sceneIdx++;
      }
    }
  } finally {
    await gracefulExit();
  }
}

async function skipIntro() {
  if (!introState.active) return;
  introState.active = false;
  introState.token++;
  window.__intro.active = false;
}

async function gracefulExit() {
  introState.active = false;
  window.__intro.active = false;
  await hideCaption();
  clearCaptions();
  clearDrivingSlider();
  dom.nav.classList.remove('show', 'paused');
}

})();
