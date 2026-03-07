// CREATE YOUR OWN BRUSHES
brush.add("watercolor", {
    type: "custom",       // this is the TIP TYPE: choose standard / spray / marker / custom / image
    weight: 5,           // Base weight of the brush tip
    vibration: 1,        // Vibration of the lines, spread
    definition: 0.5,     // Between 0 and 1
    quality: 8,          // + quality = more continuous line
    opacity: 5,         // Base opacity of the brush (this will be affected by pressure)
    spacing: 0.3,          // Spacing between the points that compose the brush stroke
    blend: true,         // Activate / Disable realistic color mixing. By default, this is active for marker-custom-image brushes 
    pressure: {
        type: "standard",                       // "standard" or "custom"
        curve: [0.15,0.2],                  // If "standard", pick a and b values for the gauss curve.
        //curve: function (x) {return 1-x},     // If "custom", define the curve function
        min_max: [0.9,1.1]                    // For both cases, define min and max pressure
    },
    // if you select the a custom type brush, define the tip geometry here. Use 0,0 as center of tip. If not, you can remove these lines.
    tip: function () {
        rect(-5,-5,10,10),rect(5,5,4,4);
    },
    // if you select the image type brush, link your image below. If not, you can remove these lines.
    image: {
        //src: "./brush.jpg",
    },
    // For "custom" and "image" types, you can define the tip angle rotation here.
    rotate: "natural", // "none" disables rotation | "natural" follows the direction of the stroke | "random"
})
// Apparently the img brushes don't work in the p5js editor, because it's not accepting crossorigin imgs

let palette = ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"]


function setup() {
  // Canvas should be WEBGL!!
  createCanvas(600,600, WEBGL);
  pixelDensity(2), angleMode(DEGREES);
  translate(-width/2,-height/2)
  
  background(240);
  
  // You can select one of the given flowfields, or disable with brush.disableField()
  brush.field("seabed");
  
  // You can draw lines and flowlines
  brush.pick("marker")
  for (let i = 0; i < 36; i++) {
    // Change color, strokeWeight
    brush.stroke(random(palette))
    brush.strokeWeight(random(0.6,1.5))
    // Draw flowLine(x,y,length,angle)
    brush.flowLine(300,300,random(150,280),i*10)
  }
  
  // You can draw circles
  brush.pick("HB")
  brush.stroke("black")
  brush.circle(300,300,100,0.5)
  
  // And rectangles
  brush.pick("2H")
  brush.stroke("blue")
  for (let i = 0; i < 15; i++) { 
    brush.rect(width * random(0.2,0.8),width * random(0.2,0.8),random(100,200),random(100,200),'CENTER')
  }
  
  // Here I'm using the brush I created above
  brush.strokeWeight(1)
  brush.pick("watercolor")
  brush.rect(300,300,550,550,'CENTER')
  
}