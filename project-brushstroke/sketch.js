// Enfantines Study — p5.brush spectral color blending
// Inspired by Alejandro Campos Uribe's "Enfantines II. Enfantillages Pittoresques"
// Reference: https://www.fxhash.xyz/article/blend-those-colours!
//
// What's here:
//  - Alejandro's original 8 color palettes (from Enfantines II source)
//  - Multi-phase rendering (bg → washes → strokes → cross-marks → hatch)
//  - Spectral pigment mixing via p5.brush's built-in shader (mixbox/spectral.js)
//  - Doodle "plots" — abstract organic shapes filled with overlapping strokes
//
// Easy to customize:
//  - Add palettes to PALETTES array
//  - Tune brush mixes in BRUSH_MIXES
//  - Replace doodle generators in generateDoodles()

// ─── ALEJANDRO'S ORIGINAL PALETTES (from Enfantines II bundle.js) ──────────────
// Each: [name, background, then 6 drawing colors]
const PALETTES = [
  { name: "Blanc Ivoire",          bg: "#fffceb", colors: ["#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"] },
  { name: "Outremer Gris",         bg: "#e2e7dc", colors: ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"] },
  { name: "Gris Clair",            bg: "#ccccc6", colors: ["#474238", "#f4bd48", "#9c2128", "#395a8e", "#7facc6", "#2c695a"] },
  { name: "Le Rubis",              bg: "#ffe6d4", colors: ["#6c2b3b", "#c76282", "#445e87", "#003c32", "#e0b411", "#c8491b"] },
  { name: "Playgrounds",           bg: "#c49a70", colors: ["#4e0042", "#002185", "#076d16", "#feec00", "#ff6900", "#ff2702"] },
  { name: "Bleu Outremer",         bg: "#4e6498", colors: ["#cdd3e3", "#c6353c", "#f6684f", "#fcd300", "#488b6d", "#7fb4b5"] },
  { name: "Bleu Outremer Foncé",   bg: "#0e2d58", colors: ["#f4f4f4", "#c8c9ca", "#939598", "#616568", "#0e1318", "#080f15"] },
  { name: "Noir d'Ivoire",         bg: "#080f15", colors: ["#C8C1B7", "#d7d7d7", "#b0b0b0", "#8b8b8b", "#676767", "#464646"] },
];

// ─── BRUSH MIXES — different "feels" using p5.brush built-ins ─────────────────
// Built-in p5.brush brushes available: pen, rotring, 2B, HB, 2H, cpencil,
// charcoal, hatch_brush, spray, marker, marker2
// (Also: hard_marker, hard_pencil, crossmark, bristle, softwash — registered
// in registerCustomBrushes() below.)
const BRUSH_MIXES = {
  enfantines: ["marker", "marker2", "marker", "cpencil", "2B"],   // soft painterly
  markers:    ["marker", "marker2", "marker", "marker2"],          // pure soft
  pencils:    ["cpencil", "2B", "HB", "2H"],                       // sketchy
  ink:        ["marker", "pen", "rotring", "hatch_brush"],         // sharp + thick mix
  rough:      ["marker", "charcoal", "2B", "spray"],               // gritty
  hard:       ["hard_marker", "hard_marker", "hard_pencil"],       // crisp Enfantines-style
};

// ─── STYLE PRESETS — full set of tunables for the look of fan strokes ─────────
// Each style is a named bundle of parameters that drives drawDoodle().
// Switch styles via the "Style" dropdown; save your own via "Save as…".
const BUILT_IN_STYLES = {
  "Soft & dreamy (current)": {
    fanBrushes: ["marker", "marker2"],
    weightRange: [2.0, 4.5],
    weightJitter: [0.85, 1.15],
    stopCount: [3, 5],          // # of color stops per doodle
    cycleRate: 3,               // gradient cycles along spine
    colorJitter: 0.05,
    showOutline: false,         // OFF — hides the rectangle artifacts
    underWashProb: 0.6,
    underWashOpacity: [25, 55],
    underWashBleed: [0.12, 0.28],
    accentProb: 0.12,
    halfWidthRange: [0.20, 0.45],
    teethMultiplier: 1.0,
  },
  "Enfantines hard-edge": {
    fanBrushes: ["hard_marker", "hard_marker", "hard_marker"],
    weightRange: [2.4, 3.6],
    weightJitter: [0.95, 1.05],
    stopCount: [4, 7],          // more colors per fan
    cycleRate: 5,               // faster color cycling
    colorJitter: 0.02,
    showOutline: false,
    underWashProb: 0.4,
    underWashOpacity: [15, 35],
    underWashBleed: [0.08, 0.18],
    accentProb: 0.0,            // no accents — pure clean stripes
    halfWidthRange: [0.22, 0.40],
    teethMultiplier: 1.2,
  },
  "Crisp colored pencil": {
    fanBrushes: ["hard_pencil", "hard_pencil", "cpencil"],
    weightRange: [0.6, 1.2],
    weightJitter: [0.9, 1.1],
    stopCount: [3, 6],
    cycleRate: 4,
    colorJitter: 0.04,
    showOutline: false,
    underWashProb: 0.5,
    underWashOpacity: [20, 45],
    underWashBleed: [0.1, 0.22],
    accentProb: 0.1,
    halfWidthRange: [0.20, 0.40],
    teethMultiplier: 1.5,
  },
  "Chunky stripes": {
    fanBrushes: ["hard_marker", "marker"],
    weightRange: [3.5, 6.0],
    weightJitter: [0.92, 1.08],
    stopCount: [3, 5],
    cycleRate: 4,
    colorJitter: 0.03,
    showOutline: false,
    underWashProb: 0.5,
    underWashOpacity: [20, 40],
    underWashBleed: [0.08, 0.20],
    accentProb: 0.05,
    halfWidthRange: [0.25, 0.45],
    teethMultiplier: 0.85,
  },
};

const STYLE_STORE_KEY = "enfantines-styles-v1";
function loadCustomStyles() {
  try { return JSON.parse(localStorage.getItem(STYLE_STORE_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveCustomStyles(obj) {
  try { localStorage.setItem(STYLE_STORE_KEY, JSON.stringify(obj)); }
  catch (e) { console.warn("Style save failed:", e); }
}
function getAllStyles() {
  return { ...BUILT_IN_STYLES, ...loadCustomStyles() };
}

// ─── State ─────────────────────────────────────────────────────────────────────
let currentPalette = 0;
let currentBrushMix = "enfantines";
let currentDensity = "medium";
let currentStyleName = "Soft & dreamy (current)";
let doodles = [];
let brushReady = false;
let regenPending = true;
let isRendering = false;       // true while a chunked render is in progress
let renderQueue = [];          // pending render tasks (each is a () => void)
let renderToken = 0;           // bumped on every regen; tasks check it to bail early
let opts = { bgWash: true, hatchBg: false, crossMarks: true, colorCurves: true };
let canvasW, canvasH;
let artBuffer;                 // offscreen WEBGL buffer that persists across draw() calls

// ─── Setup ─────────────────────────────────────────────────────────────────────
function setup() {
  const wrap = document.getElementById('canvas-container');
  // 11:14 portrait-ish aspect like Enfantines II (canvasProp 1.1 ≈ heightW/widthW)
  const maxW = wrap.clientWidth - 40, maxH = wrap.clientHeight - 40;
  const aspect = 0.85;  // width/height
  canvasH = Math.min(maxH, Math.floor(maxW / aspect));
  canvasW = Math.floor(canvasH * aspect);

  const cnv = createCanvas(canvasW, canvasH, WEBGL);
  cnv.parent('canvas-container');
  pixelDensity(1);
  angleMode(DEGREES);
  rectMode(CENTER);
  frameRate(60);
  // loop/noLoop is toggled inside draw() — initial draw kicks off via regenPending

  try {
    // Create offscreen WEBGL buffer for all brush drawing — this persists
    // across draw() calls so we can build up the composition over many frames
    // without WEBGL's auto-clear wiping previous chunks.
    artBuffer = createGraphics(canvasW, canvasH, WEBGL);
    artBuffer.pixelDensity(1);
    // IMPORTANT: do NOT set rectMode(CENTER) on artBuffer — p5.brush's blend
    // shader internally does `s.rect(-w/2,-h/2,w,h)` to run the spectral
    // mixing shader across all pixels, and that call assumes CORNER mode.
    // With CENTER mode, the shader only runs on one quadrant and marker
    // strokes don't appear in the other 3/4 of the canvas.
    artBuffer.angleMode(DEGREES);

    brush.scale(canvasW / 900);
    brush.load(artBuffer);          // redirect ALL brush ops to the buffer
    brush.scaleBrushes(1.2);
    registerCustomBrushes();
    brushReady = true;
    setStatus("ready · double-tap canvas for new", "#9fd1a0");
  } catch (e) {
    console.error("p5.brush load failed:", e);
    setStatus("brush load failed: " + e.message, "#ff9a9a");
    return;
  }

  // UI wiring
  const palSel = document.getElementById('paletteSel');
  PALETTES.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    palSel.appendChild(opt);
  });
  palSel.addEventListener('change', e => { currentPalette = parseInt(e.target.value); requestRegen(); });
  document.getElementById('brushSel').addEventListener('change', e => { currentBrushMix = e.target.value; requestRegen(); });
  document.getElementById('densitySel').addEventListener('change', e => { currentDensity = e.target.value; requestRegen(); });

  // STYLE dropdown — populate from built-ins + localStorage custom styles
  const styleSel = document.getElementById('styleSel');
  refreshStyleDropdown();
  styleSel.value = currentStyleName;
  styleSel.addEventListener('change', e => { currentStyleName = e.target.value; requestRegen(); });

  document.getElementById('saveStyleBtn').addEventListener('click', () => {
    const name = prompt(
      "Save current settings as a style.\n\n" +
      "This captures the brush mix, density, palette and all checkboxes\n" +
      "under a name you can switch to later from the Style dropdown.\n\n" +
      "Name:", "My style"
    );
    if (!name || !name.trim()) return;
    const customs = loadCustomStyles();
    // Snapshot: take the base style as a starting point, augment with current UI state
    const base = getAllStyles()[currentStyleName] || BUILT_IN_STYLES["Soft & dreamy (current)"];
    customs[name.trim()] = {
      ...base,
      // Also remember UI choices alongside the style params for full restoration
      __uiState: {
        palette: currentPalette,
        brushMix: currentBrushMix,
        density: currentDensity,
        opts: { ...opts },
      },
    };
    saveCustomStyles(customs);
    refreshStyleDropdown();
    styleSel.value = name.trim();
    currentStyleName = name.trim();
    setStatus(`saved style "${name.trim()}"`, "#9fd1a0");
  });

  document.getElementById('deleteStyleBtn').addEventListener('click', () => {
    const customs = loadCustomStyles();
    if (!customs[currentStyleName]) {
      setStatus("can't delete a built-in style", "#ff9a9a");
      return;
    }
    if (!confirm(`Delete custom style "${currentStyleName}"?`)) return;
    delete customs[currentStyleName];
    saveCustomStyles(customs);
    currentStyleName = "Soft & dreamy (current)";
    refreshStyleDropdown();
    styleSel.value = currentStyleName;
    requestRegen();
  });
  document.getElementById('bgWash').addEventListener('change', e => { opts.bgWash = e.target.checked; requestRegen(); });
  document.getElementById('hatchBg').addEventListener('change', e => { opts.hatchBg = e.target.checked; requestRegen(); });
  document.getElementById('crossMarks').addEventListener('change', e => { opts.crossMarks = e.target.checked; requestRegen(); });
  document.getElementById('colorCurves').addEventListener('change', e => { opts.colorCurves = e.target.checked; requestRegen(); });
  document.getElementById('regenBtn').addEventListener('click', requestRegen);
  document.getElementById('saveBtn').addEventListener('click', () => {
    saveCanvas('enfantines-' + Date.now(), 'png');
  });
  document.getElementById('fullscreenBtn').addEventListener('click', () => {
    const el = document.getElementById('container');
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  });
  document.getElementById('seedInput').addEventListener('change', e => {
    const v = e.target.value.trim();
    if (v) {
      const s = hashStr(v);
      randomSeed(s); noiseSeed(s); brush.seed(s);
    }
    requestRegen();
  });
  // double-click canvas to regenerate (matches Enfantines feel)
  document.getElementById('canvas-container').addEventListener('dblclick', requestRegen);
  // Resize: rebuild canvas + artBuffer if the window changes significantly.
  // Debounced so we don't thrash during a drag.
  let resizeTO = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(handleResize, 250);
  });
  // keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') requestRegen();
    if (e.key === 's' || e.key === 'S') saveCanvas('enfantines-' + Date.now(), 'png');
    if (e.key === 'f' || e.key === 'F') document.getElementById('fullscreenBtn').click();
  });
  redraw();
}

// Rebuild the Style <select> options from BUILT_IN_STYLES + localStorage customs
function refreshStyleDropdown() {
  const sel = document.getElementById('styleSel');
  if (!sel) return;
  sel.innerHTML = "";
  const all = getAllStyles();
  const customs = loadCustomStyles();
  // built-ins first
  for (const name of Object.keys(BUILT_IN_STYLES)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }
  // separator + customs (★)
  if (Object.keys(customs).length) {
    const sep = document.createElement('option');
    sep.disabled = true; sep.textContent = "─── saved ───";
    sel.appendChild(sep);
    for (const name of Object.keys(customs)) {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = "★ " + name;
      sel.appendChild(opt);
    }
  }
}

function setStatus(msg, color) {
  const el = document.getElementById('status');
  el.textContent = msg; el.style.color = color || '#888';
}

function requestRegen() {
  // Bump token so any in-flight chunked render bails out cleanly
  renderToken++;
  renderQueue = [];
  isRendering = false;
  regenPending = true;
  redraw();
}

// Does a brush name resolve in p5.brush? (safe — won't throw if brush.box is missing)
function brushExists(name) {
  try { return brush.box().includes(name); }
  catch (e) { return true; }
}

// Resize canvas + artBuffer to fit the current container, then re-render.
function handleResize() {
  const wrap = document.getElementById('canvas-container');
  const maxW = wrap.clientWidth - 40, maxH = wrap.clientHeight - 40;
  const aspect = 0.85;
  const newH = Math.min(maxH, Math.floor(maxW / aspect));
  const newW = Math.floor(newH * aspect);
  if (newW === canvasW && newH === canvasH) return;
  canvasW = newW; canvasH = newH;
  resizeCanvas(canvasW, canvasH);
  if (artBuffer) artBuffer.remove();
  artBuffer = createGraphics(canvasW, canvasH, WEBGL);
  artBuffer.pixelDensity(1);
  artBuffer.angleMode(DEGREES);
  brush.load(artBuffer);
  requestRegen();
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

// ─── Custom brushes — cross-mark + bristle stipple ────────────────────────────
function registerCustomBrushes() {
  // CROSS MARK — small "+" texture element scattered through the composition
  brush.add("crossmark", {
    type: "custom", weight: 1.6, vibration: 0.1,
    opacity: 200, spacing: 0.6, blend: true,
    pressure: { type: "standard", curve: [0.15, 0.2], min_max: [1.0, 1.0] },
    tip: function(m) {
      m.line(-3, 0, 3, 0);
      m.line(0, -3, 0, 3);
    },
    rotate: "random"
  });
  // BRISTLE STIPPLE — short fat bristly marks
  brush.add("bristle", {
    type: "custom", weight: 2.2, vibration: 0.8,
    opacity: 90, spacing: 0.5, blend: true,
    pressure: { type: "standard", curve: [0.25, 0.3], min_max: [0.7, 1.3] },
    tip: function(m) {
      m.ellipse(-1, 0, 2.5, 1.3);
      m.ellipse( 1, 0.5, 2, 1);
      m.ellipse( 0, -0.8, 1.8, 0.9);
    },
    rotate: "natural"
  });
  // HARD MARKER — crisp-edge marker stroke for the Enfantines-style sharp look.
  // Low vibration + flat pressure curve → no soft tapering at ends.
  // High opacity + still uses spectral blending (blend:true).
  brush.add("hard_marker", {
    type: "marker", weight: 3.5, vibration: 0.02,
    opacity: 95, spacing: 0.22, blend: true,
    pressure: { type: "standard", curve: [0.02, 0.02], min_max: [1.0, 1.0] }
  });
  // HARD PENCIL — crisp colored-pencil stroke, no spectral blend (sharper).
  brush.add("hard_pencil", {
    type: "default", weight: 0.85, vibration: 0.04,
    definition: 0.97, quality: 3, opacity: 230,
    spacing: 0.08, blend: false,
    pressure: { type: "standard", curve: [0.05, 0.05], min_max: [1.0, 1.0] }
  });
  // SOFT WASH — wide low-opacity blob for atmospheric color blending
  brush.add("softwash", {
    type: "custom", weight: 14, vibration: 3.5,
    opacity: 12, spacing: 0.45, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.15], min_max: [0.7, 1.2] },
    tip: function(m) {
      m.ellipse(0, 0, 9, 5);
      m.ellipse(2.5, 1.2, 5, 3);
      m.ellipse(-2, -1, 4.5, 2.8);
    },
    rotate: "random"
  });
}

// ─── Draw architecture ────────────────────────────────────────────────────────
//
// Two-canvas pipeline:
//   artBuffer (offscreen WEBGL p5.Graphics) — persistent. All brush.* operations
//                                              paint here. p5.brush was loaded with
//                                              brush.load(artBuffer) so this is
//                                              automatic.
//   main canvas (visible WEBGL)              — just displays artBuffer every frame
//                                              via image(). WEBGL's auto-clear on
//                                              the main canvas doesn't matter
//                                              because we re-composite each frame.
//
// Rendering is chunked: when the user triggers a regen, we build a queue of
// small tasks (one per doodle, one per wash, etc.), then drain ~3-4 per frame
// so the UI stays responsive. A monotonic renderToken lets in-flight tasks
// bail cleanly when the user picks a new option mid-render.
//
// Each task runs inside artBuffer.push()/pop() with a translate(-w/2,-h/2)
// for WEBGL coord-space — applied per-task so it works across frames.
const TASKS_PER_FRAME = 4;

function draw() {
  if (!brushReady) return;

  // ─── Kick off a new render? ────────────────────────────────────────────────
  if (regenPending) {
    regenPending = false;
    isRendering = true;
    setStatus("rendering…", "#ffb86c");

    const pal = PALETTES[currentPalette];
    const brushes = BRUSH_MIXES[currentBrushMix];
    const t0 = performance.now();

    // Clear the persistent art buffer and lay down background NOW (synchronous)
    artBuffer.background(pal.bg);

    // Build the task queue
    renderQueue = [];

    if (opts.hatchBg) {
      renderQueue.push(() => drawHatchBackground(pal));
    }
    if (opts.bgWash) {
      const washCount = { sparse: 3, medium: 5, dense: 8 }[currentDensity];
      for (let i = 0; i < washCount; i++) {
        renderQueue.push(() => drawBgWash(pal));
      }
    }
    generateDoodles(pal, brushes);
    for (const d of doodles) {
      renderQueue.push(() => drawDoodle(d));
    }
    if (opts.colorCurves) {
      const curveCount = { sparse: 1, medium: 2, dense: 4 }[currentDensity];
      for (let i = 0; i < curveCount; i++) {
        renderQueue.push(() => drawColorCurve(pal));
      }
    }
    if (opts.crossMarks) {
      const crossCount = { sparse: 6, medium: 14, dense: 26 }[currentDensity];
      renderQueue.push(() => {
        for (let i = 0; i < crossCount; i++) {
          const col = random(pal.colors);
          brush.set("crossmark", col, random(0.6, 1.4));
          const x = random(width * 0.08, width * 0.92);
          const y = random(height * 0.08, height * 0.92);
          brush.line(x, y, x + 0.5, y + 0.5);
        }
      });
    }
    renderQueue.push(() => {
      drawBorder(pal);
      isRendering = false;
      const dt = (performance.now() - t0).toFixed(0);
      setStatus(`done · ${doodles.length} doodles · ${dt}ms · ${pal.name}`, "#9fd1a0");
    });

    loop();   // start animation frames so tasks drain
  }

  // ─── Drain a few tasks per frame ───────────────────────────────────────────
  if (renderQueue.length > 0) {
    const myToken = renderToken;
    artBuffer.push();
    artBuffer.translate(-width / 2, -height / 2);
    for (let n = 0; n < TASKS_PER_FRAME && renderQueue.length > 0; n++) {
      if (renderToken !== myToken) break;   // user triggered new regen — bail
      const task = renderQueue.shift();
      try { task(); }
      catch (e) { console.error("render task failed:", e); }
    }
    artBuffer.pop();

    if (renderQueue.length > 0) {
      setStatus(`rendering… ${renderQueue.length} tasks left`, "#ffb86c");
    } else if (!isRendering) {
      noLoop();
    }
  } else if (!isRendering) {
    // Nothing to do — stop the animation loop
    noLoop();
  }

  // ─── Always composite artBuffer onto the visible canvas ────────────────────
  // (Main canvas is WEBGL, so we need translate-to-corner for image())
  clear();
  push();
  translate(-width / 2, -height / 2);
  image(artBuffer, 0, 0, width, height);
  pop();
}

// ─── Background wash — large soft color blob ───────────────────────────────────
function drawBgWash(pal) {
  const col = random(pal.colors);
  const x = random(width * 0.1, width * 0.9);
  const y = random(height * 0.1, height * 0.9);
  const w = random(80, 260);
  const h = random(80, 260);
  brush.noStroke();  // ← prevents rectangle outline around the watercolor wash
  brush.fill(col, random(25, 55));
  brush.bleed(random(0.15, 0.35));
  try { brush.fillTexture(0.4, 0.3); } catch (e) {}
  brush.rect(x, y, w, h, CENTER);
  brush.noFill();
}

// ─── Hatch background pattern ─────────────────────────────────────────────────
function drawHatchBackground(pal) {
  const angle = random([0, 45, 90, 135]);
  const spacing = random(12, 24);
  const col = pal.colors[0];
  brush.set("hatch_brush", col, 0.4);
  for (let x = -height; x < width + height; x += spacing) {
    brush.line(x, 0, x + height, height);
  }
}

// ─── Generate doodles — each doodle is a SPINE (curving path) + half-width ────
// This matches Alejandro's Enfantines II structure: a curving region whose
// interior is filled with fat perpendicular marker strokes radiating from
// the spine, each a different color from a palette gradient.
function generateDoodles(pal, brushes) {
  doodles = [];
  const style = getAllStyles()[currentStyleName] || BUILT_IN_STYLES["Soft & dreamy (current)"];
  const baseCount = { sparse: 3, medium: 5, dense: 8 }[currentDensity];
  const count = baseCount + Math.floor(random(0, 2));

  // Distribute doodle centers — looser grid so doodles can be bigger
  const cols = Math.ceil(Math.sqrt(count * 0.7));
  const rows = Math.ceil(count / cols);
  const cellW = width / cols;
  const cellH = height / rows;

  let idx = 0;
  for (let r = 0; r < rows && idx < count; r++) {
    for (let c = 0; c < cols && idx < count; c++) {
      const cx = (c + 0.5) * cellW + random(-cellW * 0.25, cellW * 0.25);
      const cy = (r + 0.5) * cellH + random(-cellH * 0.25, cellH * 0.25);

      // Doodle physical size — bigger than before so the spine has room
      const size = random(Math.min(cellW, cellH) * 0.8, Math.min(cellW, cellH) * 1.4);

      // Spine length and orientation
      const angle = random(360);
      const spineLen = size * random(0.6, 1.1);

      // Pick N colors from palette as a gradient for this doodle's fan (N from style)
      const stopCount = Math.floor(random(style.stopCount[0], style.stopCount[1] + 1));
      const stops = [];
      const used = new Set();
      while (stops.length < stopCount && used.size < pal.colors.length) {
        const ci = Math.floor(random(pal.colors.length));
        if (!used.has(ci)) { used.add(ci); stops.push(pal.colors[ci]); }
      }

      // Generate the spine — a curving path through 4 control points
      const halfLen = spineLen / 2;
      const perpA = angle + 90;
      const spinePts = [];
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const along = lerp(-halfLen, halfLen, t);
        const wobble = random(-size * 0.18, size * 0.18);
        spinePts.push({
          x: cx + cos(angle) * along + cos(perpA) * wobble,
          y: cy + sin(angle) * along + sin(perpA) * wobble,
        });
      }

      // Pick fan brushes — prefer the current STYLE's fanBrushes; fall back
      // to whatever the brush mix offers (legacy behavior).
      const styleFans = style.fanBrushes.filter(b => brushExists(b));
      const fanPool = styleFans.length ? styleFans : brushes;

      doodles.push({
        cx, cy, size, angle, spinePts, colorStops: stops,
        halfWidth: random(size * style.halfWidthRange[0], size * style.halfWidthRange[1]),
        teethCount: Math.floor(random(14, 28) * style.teethMultiplier * ({ sparse: 0.7, medium: 1, dense: 1.3 }[currentDensity])),
        fanStyle: random(["symmetric", "one-sided", "staggered", "tapered"]),
        brushType: random(fanPool),
        accentBrush: random(brushes.filter(b => b !== "marker" && b !== "marker2" && b !== "hard_marker").length
          ? brushes.filter(b => b !== "marker" && b !== "marker2" && b !== "hard_marker")
          : brushes),
        outline: style.showOutline && random() < 0.7,
        // Capture style snapshot per-doodle so post-hoc style changes don't mismatch
        styleSnapshot: style,
      });
      idx++;
    }
  }
}

// ─── Draw one doodle — fan of fat perpendicular strokes along a curving spine ─
//
// This is the core Enfantines II technique:
//  1. Walk along the spine in N steps (teeth of the fan)
//  2. At each step, find the perpendicular direction
//  3. Draw a fat marker stroke perpendicular to spine, color from gradient
//  4. Spectral blending where strokes overlap creates the painterly mix
//  5. Marker's built-in bell-pressure makes each stroke taper at ends
function drawDoodle(d) {
  const S = d.styleSnapshot || BUILT_IN_STYLES["Soft & dreamy (current)"];

  // Optional underlying wash for the doodle region — this is what the marker
  // strokes will SPECTRALLY BLEND with (the hallmark of Alejandro's look).
  // CRITICAL: brush.rect draws BOTH stroke AND fill if stroke is active —
  // that's where the rectangle-outline artifacts came from. Disable stroke
  // before the wash, then the next brush.set() inside the fan loop re-enables.
  if (random() < S.underWashProb) {
    const washCol = d.colorStops[Math.floor(random(d.colorStops.length))];
    brush.noStroke();
    brush.fill(washCol, random(S.underWashOpacity[0], S.underWashOpacity[1]));
    brush.bleed(random(S.underWashBleed[0], S.underWashBleed[1]));
    try { brush.fillTexture(0.35, 0.25); } catch (e) {}
    brush.rect(d.cx, d.cy, d.size * 0.85, d.size * 0.85, CENTER);
    brush.noFill();
  }

  const N = d.teethCount;
  // Sample tangent + perpendicular at many points along the spine
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const here = sampleSpline(d.spinePts, t);
    // Tangent by finite difference (perpendicular = +90°)
    const eps = 0.005;
    const aHead = sampleSpline(d.spinePts, Math.min(1, t + eps));
    const aBack = sampleSpline(d.spinePts, Math.max(0, t - eps));
    const tanAngle = Math.atan2(aHead.y - aBack.y, aHead.x - aBack.x) * 180 / Math.PI;
    const perpAngle = tanAngle + 90;

    // Color: cycle through the gradient (cycleRate controlled by style).
    // Higher cycleRate = more visible color changes per fan (Enfantines feel).
    const colorT = (t * S.cycleRate + random(-S.colorJitter, S.colorJitter)) % 1;
    const col = sampleGradient(d.colorStops, colorT);

    // Fan tooth half-length — varies by style
    let halfA, halfB;
    switch (d.fanStyle) {
      case "symmetric":
        halfA = d.halfWidth * random(0.7, 1.0);
        halfB = d.halfWidth * random(0.7, 1.0);
        break;
      case "one-sided":
        halfA = d.halfWidth * random(0.85, 1.05);
        halfB = d.halfWidth * 0.05;
        break;
      case "staggered":
        halfA = d.halfWidth * (i % 2 === 0 ? random(0.9, 1.05) : random(0.4, 0.6));
        halfB = d.halfWidth * (i % 2 === 1 ? random(0.9, 1.05) : random(0.4, 0.6));
        break;
      case "tapered":
        const taper = Math.sin(t * Math.PI);  // peak in middle
        halfA = d.halfWidth * taper * random(0.85, 1.05);
        halfB = d.halfWidth * taper * random(0.85, 1.05);
        break;
    }

    // The fat stroke — perpendicular to spine. Weight from style.
    const baseW = random(S.weightRange[0], S.weightRange[1]);
    const weight = baseW * random(S.weightJitter[0], S.weightJitter[1]);
    brush.set(d.brushType, col, weight);
    brush.line(
      here.x - cos(perpAngle) * halfA,
      here.y - sin(perpAngle) * halfA,
      here.x + cos(perpAngle) * halfB,
      here.y + sin(perpAngle) * halfB,
    );

    // Occasional thinner accent stroke ON TOP for detail (different color from gradient)
    if (random() < S.accentProb) {
      const accentT = (colorT + 0.5) % 1;
      const accentCol = sampleGradient(d.colorStops, accentT);
      brush.set(d.accentBrush, accentCol, random(0.5, 1.2));
      brush.line(
        here.x - cos(perpAngle) * halfA * 0.7,
        here.y - sin(perpAngle) * halfA * 0.7,
        here.x + cos(perpAngle) * halfB * 0.7,
        here.y + sin(perpAngle) * halfB * 0.7,
      );
    }
  }

  // Thin pencil outline tracing each side of the fan boundary independently.
  // (Previous version tried to spline through both sides as one closed loop,
  // which crossed the entire doodle with a huge line and locked the main thread.)
  if (d.outline) {
    const outlineCol = d.colorStops[0];
    brush.set("cpencil", outlineCol, 0.35);
    const sideSteps = 14;
    for (let side of [-1, 1]) {
      let prev = null;
      for (let i = 0; i < sideSteps; i++) {
        const t = i / (sideSteps - 1);
        const here = sampleSpline(d.spinePts, t);
        const eps = 0.005;
        const aHead = sampleSpline(d.spinePts, Math.min(1, t + eps));
        const aBack = sampleSpline(d.spinePts, Math.max(0, t - eps));
        const tanAngle = Math.atan2(aHead.y - aBack.y, aHead.x - aBack.x) * 180 / Math.PI;
        const perpAngle = tanAngle + 90;
        const halfW = d.halfWidth * (d.fanStyle === "tapered" ? Math.sin(t * Math.PI) : 1);
        const pt = {
          x: here.x + cos(perpAngle) * halfW * side,
          y: here.y + sin(perpAngle) * halfW * side,
        };
        if (prev) brush.line(prev.x, prev.y, pt.x, pt.y);
        prev = pt;
      }
    }
  }
}

// ─── COLOR CURVE — long curving stroke whose color shifts along its length ────
//
// Technique (from Alejandro's Enfantines II):
//  1. Generate a smooth curved path through 3-5 control points
//  2. Walk along the path placing many SHORT overlapping marker strokes
//  3. Interpolate color through a palette gradient as we walk
//  4. p5.brush's spectral blending (mixbox via mask buffer) fuses neighbors
//  5. Marker's built-in bell-curve pressure gives the chunky fade-in/fade-out
//
// The visible result: a thick painterly stroke that gradient-shifts colors
// AND blends them spectrally where they meet (blue→green→yellow, not muddy).
function drawColorCurve(pal) {
  // Pick path archetype
  const archetype = random(["arc", "s-curve", "horizontal-wave", "diagonal-drift", "vertical-flow"]);
  const controls = generatePath(archetype);

  // Pick 2-4 colors from the palette as gradient stops
  const stopCount = Math.floor(random(2, 5));
  const stops = [];
  const used = new Set();
  while (stops.length < stopCount) {
    const idx = Math.floor(random(pal.colors.length));
    if (!used.has(idx)) { used.add(idx); stops.push(pal.colors[idx]); }
  }

  // Brush: marker for thick painterly, occasionally cpencil for skinny color-shift
  const useMarker = random() < 0.75;
  const brushType = useMarker ? random(["marker", "marker2"]) : "cpencil";
  const baseWeight = useMarker ? random(1.4, 2.6) : random(1.2, 2.0);

  // Number of segments — denser = more visible blending
  const segments = Math.floor(random(25, 45));

  // Walk the path
  let prev = sampleSpline(controls, 0);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const pt = sampleSpline(controls, t);

    // Color: interpolate through the stops with mild jitter for variation
    const col = sampleGradient(stops, t + random(-0.04, 0.04));

    // Weight: tiny variation segment-to-segment for organic feel
    const w = baseWeight * random(0.85, 1.15);
    brush.set(brushType, col, w);

    // Draw segment from prev → pt (short enough to spectrally blend with neighbors)
    brush.line(prev.x, prev.y, pt.x, pt.y);
    prev = pt;
  }

  // Optional accent dabs along the curve for texture
  if (random() < 0.4) {
    const dabs = Math.floor(random(3, 8));
    for (let i = 0; i < dabs; i++) {
      const t = random();
      const pt = sampleSpline(controls, t);
      const col = sampleGradient(stops, t);
      brush.set("bristle", col, random(0.7, 1.3));
      const a = random(360);
      brush.line(pt.x, pt.y, pt.x + cos(a) * random(4, 12), pt.y + sin(a) * random(4, 12));
    }
  }
}

// Generate 3-5 control points forming a path archetype
function generatePath(archetype) {
  const m = Math.min(width, height) * 0.12;  // margin
  switch (archetype) {
    case "arc": {
      // Long arc — opposite edges with a curve through the middle
      const side = random() < 0.5;
      const x0 = side ? m : width - m;
      const x1 = side ? width - m : m;
      const y0 = random(height * 0.2, height * 0.8);
      const y1 = random(height * 0.2, height * 0.8);
      const yMid = (y0 + y1) / 2 + random(-height * 0.25, height * 0.25);
      return [
        { x: x0, y: y0 },
        { x: width * 0.35, y: yMid + random(-30, 30) },
        { x: width * 0.65, y: yMid + random(-30, 30) },
        { x: x1, y: y1 },
      ];
    }
    case "s-curve": {
      const x0 = random(width * 0.1, width * 0.3);
      const x1 = random(width * 0.7, width * 0.9);
      return [
        { x: x0, y: m + random(0, height * 0.2) },
        { x: random(width * 0.25, width * 0.45), y: height * 0.35 + random(-30, 30) },
        { x: random(width * 0.55, width * 0.75), y: height * 0.65 + random(-30, 30) },
        { x: x1, y: height - m - random(0, height * 0.2) },
      ];
    }
    case "horizontal-wave": {
      const y = random(height * 0.25, height * 0.75);
      const amp = random(20, 70);
      return [
        { x: m, y: y },
        { x: width * 0.3, y: y + amp * random([-1, 1]) },
        { x: width * 0.5, y: y + amp * random([-1, 1]) },
        { x: width * 0.7, y: y + amp * random([-1, 1]) },
        { x: width - m, y: y },
      ];
    }
    case "diagonal-drift": {
      const x0 = random(m, width * 0.3);
      const y0 = random(m, height * 0.3);
      const x1 = random(width * 0.7, width - m);
      const y1 = random(height * 0.7, height - m);
      return [
        { x: x0, y: y0 },
        { x: lerp(x0, x1, 0.4) + random(-50, 50), y: lerp(y0, y1, 0.4) + random(-50, 50) },
        { x: lerp(x0, x1, 0.7) + random(-50, 50), y: lerp(y0, y1, 0.7) + random(-50, 50) },
        { x: x1, y: y1 },
      ];
    }
    case "vertical-flow": {
      const x = random(width * 0.2, width * 0.8);
      const amp = random(15, 60);
      return [
        { x: x, y: m },
        { x: x + amp * random([-1, 1]), y: height * 0.3 },
        { x: x + amp * random([-1, 1]), y: height * 0.6 },
        { x: x, y: height - m },
      ];
    }
  }
  return [{ x: 0, y: 0 }, { x: width, y: height }];
}

// Catmull-Rom spline sample at t ∈ [0, 1] over a polyline
function sampleSpline(pts, t) {
  if (pts.length < 2) return pts[0];
  if (pts.length === 2) return { x: lerp(pts[0].x, pts[1].x, t), y: lerp(pts[0].y, pts[1].y, t) };

  const n = pts.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n));
  const localT = t * n - seg;

  // Catmull-Rom with phantom endpoints
  const p0 = pts[Math.max(0, seg - 1)];
  const p1 = pts[seg];
  const p2 = pts[seg + 1];
  const p3 = pts[Math.min(pts.length - 1, seg + 2)];

  const t2 = localT * localT;
  const t3 = t2 * localT;

  const x = 0.5 * ((2 * p1.x) +
    (-p0.x + p2.x) * localT +
    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const y = 0.5 * ((2 * p1.y) +
    (-p0.y + p2.y) * localT +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

  return { x, y };
}

// Sample a multi-stop color gradient. Returns a hex string.
// t ∈ [0,1] — outside range is clamped.
function sampleGradient(stops, t) {
  t = Math.max(0, Math.min(1, t));
  if (stops.length === 1) return stops[0];

  const scaled = t * (stops.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(stops.length - 1, i0 + 1);
  const localT = scaled - i0;

  const c0 = color(stops[i0]);
  const c1 = color(stops[i1]);
  const out = lerpColor(c0, c1, localT);
  return colorToHex(out);
}

function colorToHex(c) {
  const r = Math.round(red(c)).toString(16).padStart(2, '0');
  const g = Math.round(green(c)).toString(16).padStart(2, '0');
  const b = Math.round(blue(c)).toString(16).padStart(2, '0');
  return '#' + r + g + b;
}

// ─── Border — subtle margin frame using cpencil ───────────────────────────────
function drawBorder(pal) {
  const margin = Math.min(width, height) * 0.04;
  brush.set("cpencil", pal.colors[0], 0.6);
  brush.line(margin, margin, width - margin, margin);
  brush.line(width - margin, margin, width - margin, height - margin);
  brush.line(width - margin, height - margin, margin, height - margin);
  brush.line(margin, height - margin, margin, margin);
}
