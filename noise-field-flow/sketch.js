// Noise Field Flow — p5.js
// Perlin noise vector field with particle trails

let particles = [];
const NUM_PARTICLES = 1800;
const TRAIL_LENGTH = 60;
let noiseScale = 0.003;
let noiseStrength = 2.2;
let zOff = 0;
let paused = false;
let bgGraphics, trailGraphics;
let palette = 0;

const palettes = [
  // Aurora
  [[180, 220, 255], [120, 255, 200], [80, 180, 255], [200, 150, 255]],
  // Ember
  [[255, 80, 30], [255, 160, 20], [255, 220, 80], [200, 40, 60]],
  // Bioluminescence
  [[0, 255, 180], [0, 200, 255], [100, 255, 160], [0, 255, 120]],
  // Dusk
  [[255, 120, 180], [200, 100, 255], [255, 180, 100], [140, 80, 255]],
];

function getColor(x, y) {
  const cols = palettes[palette];
  const idx = floor(map(noise(x * 0.001, y * 0.001), 0, 1, 0, cols.length - 0.01));
  const c = cols[idx];
  return color(c[0], c[1], c[2]);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255);

  bgGraphics = createGraphics(width, height);
  bgGraphics.background(0);

  trailGraphics = createGraphics(width, height);
  trailGraphics.colorMode(RGB, 255);
  trailGraphics.clear();

  initParticles();
}

function initParticles() {
  particles = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      px: 0,
      py: 0,
      age: random(TRAIL_LENGTH),
      speed: random(1.5, 3.5),
      size: random(0.5, 1.8),
    });
  }
}

function draw() {
  if (paused) return;

  // Fade trail graphics
  trailGraphics.fill(0, 0, 0, 8);
  trailGraphics.noStroke();
  trailGraphics.rect(0, 0, width, height);

  for (let p of particles) {
    p.px = p.x;
    p.py = p.y;

    // Sample noise field
    const angle = noise(p.x * noiseScale, p.y * noiseScale, zOff) * TWO_PI * 3;
    const vx = cos(angle) * p.speed;
    const vy = sin(angle) * p.speed;

    p.x += vx;
    p.y += vy;
    p.age++;

    // Wrap edges
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    // Reset old particles
    if (p.age > TRAIL_LENGTH + random(TRAIL_LENGTH)) {
      p.x = random(width);
      p.y = random(height);
      p.age = 0;
    }

    // Draw trail segment
    const alpha = map(p.age, 0, TRAIL_LENGTH, 0, 180);
    const c = getColor(p.x, p.y);
    trailGraphics.stroke(red(c), green(c), blue(c), alpha);
    trailGraphics.strokeWeight(p.size);
    trailGraphics.line(p.px, p.py, p.x, p.y);
  }

  // Composite
  background(0);
  image(trailGraphics, 0, 0);

  zOff += 0.0005;
}

function clearCanvas() {
  trailGraphics.clear();
  trailGraphics.background(0, 0);
  initParticles();
  zOff = random(1000);
}

function randomizePalette() {
  palette = (palette + 1) % palettes.length;
}

function toggleFlow() {
  paused = !paused;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  trailGraphics = createGraphics(width, height);
  trailGraphics.colorMode(RGB, 255);
  initParticles();
}

// Mouse interaction — disturb field
function mouseDragged() {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: mouseX + random(-20, 20),
      y: mouseY + random(-20, 20),
      px: mouseX,
      py: mouseY,
      age: 0,
      speed: random(2, 5),
      size: random(1, 3),
    });
  }
  if (particles.length > NUM_PARTICLES * 1.5) {
    particles.splice(0, particles.length - NUM_PARTICLES);
  }
}
