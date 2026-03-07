brush.config({
    R: function () { return random() },
})

let palette = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"]
let colors = []
let seeds = []
let end = false;

brush.addBrush("watercolor", {type: "custom", weight: 5, vibration: 1, definition: 0.5, quality: 8, opacity: 20, spacing: 0.8, blend: true, pressure: { type: "standard", curve: [0.15,0.2], min_max: [0.78,1.3]}, tip: function () { rect(-5,-5,10,10),rect(5,5,4,4)}, rotate: "natural"})


let font;

function preload() {
  // Inter 600
  font = loadFont('https://fonts.gstatic.com/s/inter/v3/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf')
}

function setup() {
  createCanvas(600,600, WEBGL);
  pixelDensity(1), angleMode(DEGREES);
  brush.scale(1.3)
  brush.load();
  translate(-width/2,-height/2)
  for (let i = 0; i < 150; i++) seeds.push(random())
}

let guardar = true;
let rrr = 213123

function draw() {
 
  frameRate(30)
  const t = frameCount / 30
  let scene = floor(t / 5) % 6
  textFont(font)
  translate(-width/2,-height/2)
  
  
  
  if (scene === 1) {
    end = false;
    background("#080f15");
    let flowfields = Array.from(brush.listFields())
    brush.field(flowfields[floor(t % flowfields.length)])
    
    randomSeed(33213 * seeds[67])
    brush.set("charcoal","white",1)
    brush.circle(300,300,180,true)
    
    brush.pick("HB")
    randomSeed(33213 * seeds[97])
    for (let i = 0; i < 30; i ++) {
      brush.flowLine(random(width),random(height),35,0)
    }

      push()
        noStroke()
        fill(210)
        textAlign(CENTER, CENTER)
        textSize(40)
        text('*flowField()', 300, 300)
      pop()
  }
  
  if (scene === 2) {
      end = false;
      let brushes = ["marker", "marker", "watercolor", "watercolor", "charcoal", "HB", "2B", "rotring"]
      background("#e2e7dc");
      randomSeed(33213 * seeds[0])
      brush.field("seabed")
      let cx = 300, cy = 300;
      for (let i = 0; i < 20; i++) {
        let angle = (i * 18 + t * 30)
        // Change color, strokeWeight
        randomSeed(33213 * seeds[i])
        brush.set(random(brushes),random(palette),1)
        brush.flowLine(cx + 100 * cos(- angle),cy + 100 * sin(- angle),random(40,90) * Math.abs(sin(180 + t * 30)) + random(270,300),angle)
      }
      
      if ((t * 10) % 4 == 0) {
        rrr = random(23122,99999);
      }
        randomSeed(rrr)
        brush.set(random(brushes),random(palette),1)
        brush.noField()
        brush.circle(300,300,100, 0.4)
    
      push()
        noStroke()
        fill(40)
        textAlign(CENTER, CENTER)
        textSize(40)
        text('*brush()', 300, 300)
      pop()
  }
  
    if (scene === 3) {
      end = false;

      background("#ffe6d4");
      
      randomSeed(33213 * seeds[56])
      brush.set("cpencil","#003c32",1)
      
      let pol = new brush.Polygon ([
        [80 + 20 * sin(random(0,360) + t * 120),150 + 20 * sin(random(0,360) +t * 120)],
        [180 + 20 * sin(random(0,360) + t * 120),150 + 20 * sin(random(0,360) +t * 120)],
        [420 + 20 * sin(random(0,360) + t * 120),150 + 20 * sin(random(0,360) +t * 120)],
        [480 + 20 * sin(random(0,360) + t * 120),450 + 20 * sin(random(0,360) +t * 120)],
        [280 + 20 * sin(random(0,360) + t * 120),450 + 20 * sin(random(0,360) +t * 120)],
        [130 + 20 * sin(random(0,360) + t * 120),450 + 20 * sin(random(0,360) +t * 120)],
      ])
      pol.draw()
      randomSeed(33213 * seeds[35])
      brush.set("HB","#c76282",1.4)
      pol.hatch(15,45,0.3)
      
      randomSeed(33213 * seeds[75])
      pol = new brush.Polygon ([
        [250 + 20 * cos(360 * sin(random(0,360) + t * 120)),250 + 20 * sin(random(0,360) +t * 120)],
        [500 + 40 * cos(360 * sin(random(0,360) + t * 120)),300 + 50 * sin(random(0,360) +t * 120)],
        [300 + 10 * cos(360 * sin(random(0,360) + t * 120)),520 + 30 * sin(random(0,360) +t * 120)],
      ])
      
      pol.draw(15,45,0.3)
      brush.set("marker","#e0b411",1.1)
      pol.hatch(10,130,0.2)
    
      push()
        noStroke()
        fill(50)
        textAlign(CENTER, CENTER)
        textSize(40)
        text('*hatch()', 300,300)
      pop()
  }
  
      if (scene === 4) {
      if (!end) {
        background("#fffceb"), end = true;
        push()
        noStroke()
        fill(0)
        translate(-20 + width/2,-5 + height/2)
        textAlign(CENTER, CENTER)
        textSize(40)
        text('*fill()', 0, 0)
      pop()
      }
      let colores = ["#7b4800",      "#002185",      "#003c32",      "#fcd300",      "#ff2702",      "#6b9404"];
      if ((10 * t) % 3 == 0) {
              brush.fill(random(colores), random(70,120))
              brush.bleed(random(0.04,0.35))
              brush.rect(random(width),random(height),random(50,140),random(50,140),CENTER)
              brush.noFill()
      }

  }
  
  if (scene === 5) {
    end = false;
    background("#445e87");
    brush.noField()
    
    brush.set("2B","#0e2d58",2)
    randomSeed(33213 * seeds[67])
    brush.circle(155,140,50)
    
    randomSeed(33213 * seeds[67])
    
    let points = [
      [30,30,1],
      [250,100,random(0.8,1.5)],
      [280 - 150 * cos(360 * sin(random(0,360) + t * 90)),300 + 50 * sin(random(0,360) + t * 90),random(0.8,1.5)],
      [570,570,1]
    ]
    if (points[1][0] === points[1][1]) points[1][0] += 1;
    
    brush.set("charcoal","white",1)
    brush.spline(points,1)
    brush.set("2H","white",1)
    for (let i = 1; i <= 4; i++) {
      let p = [
        [points[0][0] + 55 * i,points[0][1],1],
        [points[1][0] - 3 * i,points[1][1] + 5 * i,1],
        points[2],
        [points[3][0] - 100 * i,points[3][1],1],
      ]
      randomSeed(33213 * seeds[62])
      brush.spline(p,1)
    }

      push()
        noStroke()
        fill(210)
        translate(points[2][0],points[2][1])
        textAlign(LEFT, CENTER)
        textSize(40)
        text('*spline()', 0, 0)
      pop()
  }
  
  if (scene === 0) {
    if (!end) {
      background("#fffceb"), end = true;
      push()
        noStroke()
        fill(0)
        translate(-20 + width/2,-5 + height/2)
        textAlign(CENTER, CENTER)
        textSize(50)
        text('*p5.brush', 0, 0)
      pop()
      brush.field("seabed")
    }
    let colores = ["#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"]
    let brushes = ["marker", "watercolor", "spray", "charcoal", "HB", "2B", "cpencil", "2H", "rotring"]
    
    brush.set(random(brushes),random(colores),random(0.7,1.6))
    brush.flowLine(random(width),random(height),random(140,240),random(360))
    

  }
  
   if (guardar) saveGif('whatever',30), guardar = false;
  
}

function mouseClicked () {
  noLoop()
}