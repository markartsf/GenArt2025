let mic, amplitude;
let angle = 0;
let x, y;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background("#f7f7f7");
  angleMode(DEGREES);

  // A palette of colors
  const palette = ["#003049", "#d62828", "#f77f00", "#fcbf49", "#eae2b7"];
  
  // Initialize brush library
  brush.scaleBrushes(1);
  brush.pick("HB");
  brush.stroke(random(palette));
  
  // Start in the center
  x = width / 2;
  y = height / 2;

  // Create an audio input and start it
  mic = new p5.AudioIn();
  mic.start();

  // Create an amplitude analyzer
  amplitude = new p5.Amplitude();
  amplitude.setInput(mic);

  // Add a message to the user
  textAlign(CENTER, CENTER);
  fill(0, 100);
  noStroke();
  text("Click to start audio. Make some noise!", width / 2, height / 2);
}

function draw() {
  // Only start drawing after audio is enabled
  if (getAudioContext().state !== 'running') {
    return;
  }

  // Get the overall volume (between 0 and 1.0)
  let level = amplitude.getLevel();

  // Map the volume to brush parameters
  let pressure = map(level, 0, 0.5, 0.1, 2.5, true); // Use true to constrain the value
  let length = map(level, 0, 0.5, 1, 30, true);

  // Update angle based on a noise field for smooth, organic movement
  angle = noise(x * 0.005, y * 0.005) * 360 * 2;

  // Update position based on the angle and length
  x += cos(angle) * length;
  y += sin(angle) * length;

  // Use the brush to draw from the previous to the current position
  brush.line(x - cos(angle) * length, y - sin(angle) * length, x, y, pressure);


  // If the line goes off-screen, or randomly, start a new one
  if (x > width || x < 0 || y > height || y < 0 || random(1) < 0.005) {
    x = random(width);
    y = random(height);
    const palette = ["#003049", "#d62828", "#f77f00", "#fcbf49", "#eae2b7"];
    brush.stroke(random(palette)); // Change color for the new line
  }
}

// Add a click handler to start the audio context
function mousePressed() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume().then(() => {
      console.log("Audio context resumed.");
      background("#f7f7f7"); // Clear the initial text
    });
  }
}

// Handle window resizing
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background("#f7f7f7");
  x = width/2;
  y = height/2;
  text("Click to start audio. Make some noise!", width / 2, height / 2);
}
