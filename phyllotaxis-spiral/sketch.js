// Phyllotaxis Spiral — SVG + JavaScript
// Golden ratio sunflower pattern, animated and plotter-ready

const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.508°

let N = 800;
let animFrame = null;
let animating = true;
let currentN = 0;
let paletteIndex = 0;
let svg, svgNS;

const palettes = [
  {
    bg: '#0a0a0a',
    dots: (t) => `hsl(${200 + t * 60}, 80%, ${40 + t * 30}%)`,
    stroke: 'rgba(255,255,255,0.08)',
  },
  {
    bg: '#0a0005',
    dots: (t) => `hsl(${300 + t * 80}, 90%, ${35 + t * 35}%)`,
    stroke: 'rgba(255,180,255,0.06)',
  },
  {
    bg: '#001a0a',
    dots: (t) => `hsl(${140 + t * 50}, 80%, ${35 + t * 35}%)`,
    stroke: 'rgba(100,255,180,0.07)',
  },
  {
    bg: '#0a0800',
    dots: (t) => `hsl(${20 + t * 60}, 90%, ${40 + t * 30}%)`,
    stroke: 'rgba(255,200,80,0.08)',
  },
];

function getSize() {
  return Math.min(window.innerWidth, window.innerHeight) * 0.92;
}

function getRadius(size) {
  return size * 0.48;
}

function init() {
  svgNS = 'http://www.w3.org/2000/svg';
  svg = document.getElementById('canvas');
  resize();
  window.addEventListener('resize', resize);
  startAnimation();
}

function resize() {
  const size = getSize();
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  if (!animating) render(N);
}

function startAnimation() {
  currentN = 0;
  if (animFrame) cancelAnimationFrame(animFrame);
  clearSVG();
  step();
}

function step() {
  if (!animating) return;
  const batchSize = 12;
  for (let i = 0; i < batchSize && currentN <= N; i++, currentN++) {
    addDot(currentN);
  }
  if (currentN <= N) {
    animFrame = requestAnimationFrame(step);
  }
}

function clearSVG() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const size = getSize();
  const pal = palettes[paletteIndex];

  // Background rect
  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('width', size);
  bg.setAttribute('height', size);
  bg.setAttribute('fill', pal.bg);
  svg.appendChild(bg);

  // Subtle radial grid lines for plotter aesthetic
  const cx = size / 2, cy = size / 2;
  const maxR = getRadius(size);
  const numRings = 6;
  for (let r = 1; r <= numRings; r++) {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', (r / numRings) * maxR);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', pal.stroke);
    circle.setAttribute('stroke-width', '0.5');
    svg.appendChild(circle);
  }

  // Radial spokes
  const numSpokes = 12;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (i / numSpokes) * Math.PI * 2;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', cx);
    line.setAttribute('y1', cy);
    line.setAttribute('x2', cx + Math.cos(angle) * maxR);
    line.setAttribute('y2', cy + Math.sin(angle) * maxR);
    line.setAttribute('stroke', pal.stroke);
    line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);
  }
}

function addDot(i) {
  const size = getSize();
  const cx = size / 2, cy = size / 2;
  const maxR = getRadius(size);

  const t = i / N;
  const r = Math.sqrt(t) * maxR;
  const theta = i * GOLDEN_ANGLE;

  const x = cx + r * Math.cos(theta);
  const y = cy + r * Math.sin(theta);

  // Dot size: larger at center, smaller at edge — then reverses slightly
  const dotR = map(t, 0, 1, 1.8, 0.6) + Math.sin(t * Math.PI) * 1.2;

  const pal = palettes[paletteIndex];
  const fillColor = pal.dots(t);

  const circle = document.createElementNS(svgNS, 'circle');
  circle.setAttribute('cx', x.toFixed(2));
  circle.setAttribute('cy', y.toFixed(2));
  circle.setAttribute('r', dotR.toFixed(2));
  circle.setAttribute('fill', fillColor);
  svg.appendChild(circle);
}

function render(n) {
  clearSVG();
  for (let i = 0; i <= n; i++) {
    addDot(i);
  }
}

function map(v, a, b, c, d) {
  return c + (d - c) * ((v - a) / (b - a));
}

// Button handlers
window.toggleAnimation = function () {
  animating = !animating;
  if (animating) {
    startAnimation();
  }
};

window.cyclePalette = function () {
  paletteIndex = (paletteIndex + 1) % palettes.length;
  if (animating) {
    startAnimation();
  } else {
    render(N);
  }
};

window.setN = function (val) {
  N = parseInt(val);
  if (animating) {
    startAnimation();
  } else {
    render(N);
  }
};

window.downloadSVG = function () {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `phyllotaxis-${N}-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
};

window.addEventListener('DOMContentLoaded', init);
