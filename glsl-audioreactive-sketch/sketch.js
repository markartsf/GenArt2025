let theShader;
let song;
let fft;
let canvas;

function preload() {
  // Load the shader files
  theShader = loadShader('shader.vert', 'shader.frag');
  // Load the audio file
  song = loadSound('track.mp3');
}

function setup() {
  // Create a WebGL canvas that fills the window
  canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  
  // Create an FFT object to analyze the audio
  // Smoothing, 16 frequency bands
  fft = new p5.FFT(0.8, 16);

  // Add a click handler to start/stop the music
  const instructions = createP('Click to play / pause');
  instructions.style('color', 'white');
  instructions.style('position', 'absolute');
  instructions.style('bottom', '10px');
  instructions.style('left', '10px');
  instructions.style('font-family', 'monospace');
  instructions.style('font-size', '16px');
}

function draw() {
  // Analyze the audio spectrum
  let spectrum = fft.analyze();

  // Activate the shader
  shader(theShader);

  // Send uniforms to the shader
  theShader.setUniform('u_resolution', [width, height]);
  theShader.setUniform('u_time', millis() / 1000.0);
  theShader.setUniform('u_fft', spectrum);

  // Draw a rectangle to cover the entire canvas.
  // The fragment shader will be applied to each pixel of this rectangle.
  rect(0, 0, width, height);
}

function mousePressed() {
  // Check if the song is playing and toggle state
  if (song.isPlaying()) {
    song.pause();
  } else {
    // Loop the song
    song.loop();
  }
}

function windowResized() {
  // Resize the canvas when the window is resized
  resizeCanvas(windowWidth, windowHeight);
}
