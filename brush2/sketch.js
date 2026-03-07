let brush;

function setup() {
  createCanvas(800, 600);
  brush = new Brush();
}

function draw() {
  if (mouseIsPressed) {
    brush.stroke(mouseX, mouseY);
  }
}
