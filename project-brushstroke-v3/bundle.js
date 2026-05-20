let mainCanvas,
    colorBuffer,
    colorShader,
    mixboxTexture,
    vert = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vVertTexCoord;

void main(void) {
  vec4 positionVec4 = vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;
  vVertTexCoord = aTexCoord;
}
`













    ,
    main = `
precision highp float;
varying vec2 vVertTexCoord;

//#define MIXBOX_COLORSPACE_LINEAR

uniform sampler2D source;
uniform sampler2D mask;
uniform sampler2D mixbox_lut;
uniform vec4 addColor;
uniform vec2 spotBorder;
uniform vec2 spotSize;
uniform float noiseSeed;
uniform float intensity;

#include "mixbox.glsl"

vec3 rgb(float r, float g, float b){
  return vec3(r / 255.0, g / 255.0, b / 255.0);
}

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

void main() {

    float desfase = sqrt((vVertTexCoord.x-spotBorder.x)*(vVertTexCoord.x-spotBorder.x)+(vVertTexCoord.y-spotBorder.y)*(vVertTexCoord.y-spotBorder.y));
    float relativeDf = 0.3*desfase/spotSize.x;

    vec4 maskColor = texture2D(mask, vVertTexCoord);
    vec4 inColor = texture2D(source, vVertTexCoord);
    vec3 existingColor = vec3(inColor.r,inColor.g,inColor.b);
    vec3 colorToAdd = rgb(addColor.r,addColor.g,addColor.b);
  
    if (maskColor.g > 0.0) { 
      if (maskColor.b > 0.0) {
        float t = (maskColor.a)*intensity + 2.0*(maskColor.b)*intensity + 0.1*intensity*fract(noiseSeed + rand(vVertTexCoord * 3324.5833));
        vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, t);
        gl_FragColor = vec4(finalColor,1.0);
      }
      else {
        float t = (maskColor.a)*intensity*0.8 + 0.15*intensity*fract(noiseSeed + rand(vVertTexCoord * 1234.5678));
        vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, t*(1.0-relativeDf));
        gl_FragColor = vec4(finalColor,1.0);
      }
    }
    else if (maskColor.r > 0.0) {
      float fracc = (1.0-maskColor.a);
      float t = (1.0+fracc)*intensity*0.4;
      vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, 2.0*t*(1.0-relativeDf));
      gl_FragColor = vec4(finalColor,1.0);
    }
    else {
      gl_FragColor = vec4(existingColor,1.0);
    }
}
`
























































    ;
main = main.replace("#include \"mixbox.glsl\"", mixbox.glsl());
let simple = `
precision highp float;
varying vec2 vVertTexCoord;

//#define MIXBOX_COLORSPACE_LINEAR

uniform sampler2D source;
uniform sampler2D mask;
uniform sampler2D mixbox_lut;
uniform vec4 addColor;
uniform float noiseSeed;
uniform float intensity;

#include "mixbox.glsl"

vec3 rgb(float r, float g, float b){
  return vec3(r / 255.0, g / 255.0, b / 255.0);
}

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

void main() {
    vec4 maskColor = texture2D(mask, vVertTexCoord);
    vec4 inColor = texture2D(source, vVertTexCoord);
    vec3 existingColor = vec3(inColor.r,inColor.g,inColor.b);
    vec3 colorToAdd = rgb(addColor.r,addColor.g,addColor.b);
  
    if (maskColor.g > 0.0) { 
      if (maskColor.b > 0.0) {
        float t = (maskColor.a)*intensity + 1.2*(maskColor.b)*intensity + 0.1*intensity*fract(noiseSeed + rand(vVertTexCoord * 3324.5833));
        vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, t);
        gl_FragColor = vec4(finalColor,1.0);
      }
      else {
        float t = (maskColor.a)*intensity*0.6 + 0.15*intensity*fract(noiseSeed + rand(vVertTexCoord * 1234.5678));
        vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, t);
        gl_FragColor = vec4(finalColor,1.0);
      }
    }
    else if (maskColor.r > 0.0) {
      float fracc = (1.0-maskColor.a);
      float t = (1.0+fracc)*intensity*0.4;
      vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, 3.0*t);
      gl_FragColor = vec4(finalColor,1.0);
    }
    else {
      gl_FragColor = vec4(existingColor,1.0);
    }
}
`


















































;
simple = simple.replace("#include \"mixbox.glsl\"", mixbox.glsl());
let markerS = `
precision highp float;
varying vec2 vVertTexCoord;

//#define MIXBOX_COLORSPACE_LINEAR

uniform sampler2D source;
uniform sampler2D mask;
uniform sampler2D mixbox_lut;
uniform vec4 addColor;
uniform float noiseSeed;
uniform float intensity;

#include "mixbox.glsl"

vec3 rgb(float r, float g, float b){
  return vec3(r / 255.0, g / 255.0, b / 255.0);
}

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

void main() {
    vec4 maskColor = texture2D(mask, vVertTexCoord);
    vec4 inColor = texture2D(source, vVertTexCoord);
    vec3 existingColor = vec3(inColor.r,inColor.g,inColor.b);
    vec3 colorToAdd = rgb(addColor.r,addColor.g,addColor.b);
    
  
    if (maskColor.g > 0.0) { 
      if (maskColor.b > 0.0) {
        float t = intensity + 2.0*(maskColor.b)*intensity + 0.1*intensity*fract(noiseSeed + rand(vVertTexCoord * 3324.5833));
        vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, t);
        gl_FragColor = vec4(finalColor,1.0);
      }
      else {
        float t = intensity + 0.15*intensity*fract(noiseSeed + rand(vVertTexCoord * 1234.5678));
        vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, t);
        gl_FragColor = vec4(finalColor,1.0);
      }
    }
    else if (maskColor.r > 0.0) {
      float fracc = (1.0-maskColor.a);
      float t = (1.0+fracc)*intensity;
      vec3 finalColor = mixbox_lerp(existingColor, colorToAdd, t);
      gl_FragColor = vec4(finalColor,1.0);
    }
    else {
      gl_FragColor = vec4(existingColor,1.0);
    }

}
`




















































;
markerS = markerS.replace("#include \"mixbox.glsl\"", mixbox.glsl());
let i0 = 0,
    i1 = 0,
    i2 = 0;
function paintColor(e, s, a, l, n) {
    let t = [float(red(color(e))), float(green(color(e))), float(blue(color(e))), 50];
    push(),
    noStroke(),
    "marker" == a ? (0 == i0 && (markerShader = createShader(vert, markerS), i0++), shader(markerShader), markerShader.setUniform("intensity", s), markerShader.setUniform("addColor", t), markerShader.setUniform("mixbox_lut", mixboxTexture), markerShader.setUniform("source", mainCanvas), markerShader.setUniform("noiseSeed", 999 * fxrand()), markerShader.setUniform("mask", maskBuffer)) : "simple" == a ? (0 == i1 && (simpleShader = createShader(vert, simple), i1++), shader(simpleShader), simpleShader.setUniform("intensity", s), simpleShader.setUniform("addColor", t), simpleShader.setUniform("mixbox_lut", mixboxTexture), simpleShader.setUniform("source", mainCanvas), simpleShader.setUniform("noiseSeed", 999 * fxrand()), simpleShader.setUniform("mask", maskBuffer)) : (0 == i2 && (colorShader = createShader(vert, main), i2++), shader(colorShader), l = [l.x / widthW, l.y / heightW], n = [n / widthW, n / heightW], colorShader.setUniform("spotBorder", l), colorShader.setUniform("spotSize", n), colorShader.setUniform("intensity", s), colorShader.setUniform("addColor", t), colorShader.setUniform("mixbox_lut", mixboxTexture), colorShader.setUniform("source", mainCanvas), colorShader.setUniform("noiseSeed", 999 * fxrand()), colorShader.setUniform("mask", maskBuffer)),
    rect(widthW / 2, heightW / 2, widthW, heightW),
    maskBuffer.clear(),
    pop()
}
let canvasProp = 1.1,
    pDensity = 2;
new URLSearchParams(window.location.search).get("pixelDensity") && (pDensity = parseFloat(new URLSearchParams(window.location.search).get("pixelDensity")));
let widthW,
    heightW,
    pixel;
171 === pDensity ? (heightW = window.innerHeight, pixel = heightW / 704, widthW = window.innerWidth, pDensity = 2) : window.innerHeight <= window.innerWidth * canvasProp ? (heightW = window.innerHeight, pixel = heightW / 704, widthW = heightW / canvasProp) : (widthW = window.innerWidth, heightW = widthW * canvasProp, pixel = heightW / 704);
let marg = weightedRand({
        .07: 40,
        .09: 20,
        .12: 10,
        0: 20
    }),
    margin = widthW * marg,
    w1Active = margin,
    w2Active = widthW - margin,
    h1Active = margin,
    h2Active = heightW - margin;
function rand(s, e) {
    return mapRange(fxrand(), 0, 1, s, e)
}
function rande(s, e) {
    return Math.floor(mapRange(fxrand(), 0, 1, s, e))
}
function weightedRand(s) {
    var e,
        l,
        t = [];
    for (e in s)
        for (l = 0; l < 10 * s[e]; l++)
            t.push(e);
    return t[Math.floor(fxrand() * t.length)]
}
function createNCarray(e) {
    for (colorArray = [], i = 0; 6 > i; i++)
        7 < e + i ? colorArray.push(e + i - 6) : colorArray.push(e + i);
    return colorArray
}
function mapRange(e, s, a, l, n) {
    return e = (e - s) / (a - s), l + e * (n - l)
}
function shuffler(e) {
    for (let s = e.length - 1; 0 < s; s--) {
        const a = Math.floor(fxrand() * (s + 1)),
            l = e[s];
        e[s] = e[a],
        e[a] = l
    }
    return e
}
function getOccurrence(e, s) {
    var a = 0;
    return e.forEach(e => e === s && a++), a
}
let userAgentString = navigator.userAgent,
    chromeAgent = -1 < userAgentString.indexOf("Chrome"),
    safariAgent = -1 < userAgentString.indexOf("Safari");
chromeAgent && safariAgent && (safariAgent = !1);
const movements = [{
        name: "Petit pr\xE9lude \xE0 la journ\xE9e",
        color_intensity: 120,
        opacity: .9,
        probability: 30,
        print: "first"
    }, {
        name: "Berceuse",
        color_intensity: 120,
        opacity: .55,
        probability: 30,
        print: "second"
    }, {
        name: "Marche du grand escalier",
        color_intensity: 120,
        opacity: .9,
        probability: 15,
        print: "third"
    }],
    mvtSel = parseInt(weightedRand({
        0: movements[0].probability,
        1: movements[1].probability,
        2: movements[2].probability
    })),
    movement = movements[mvtSel],
    nrWCmax = movement.color_intensity,
    versions = [{
        name: "Parfait",
        probability: 30
    }, {
        name: "Normal",
        probability: 40
    }, {
        name: "Nuances Dynamique",
        probability: 20
    }, {
        name: "Accords",
        probability: 5
    }, {
        name: "Sautillante",
        probability: 5
    }],
    pianoVersion = parseInt(weightedRand({
        0: versions[0].probability,
        1: versions[1].probability,
        2: versions[2].probability,
        3: versions[3].probability,
        4: versions[4].probability
    })),
    version = versions[pianoVersion];
let palette = parseInt(weightedRand({
    0: 60,
    1: 100,
    2: 40,
    3: 65,
    4: 0,
    5: 20,
    6: 45,
    7: 15
}));
0 == parseFloat(marg) && 5 == palette && (palette = 1);
const colors = [["Blanc Ivoire", "#fffceb", "#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"], ["Outremer Gris", "#e2e7dc", "#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"], ["Gris Clair", "#ccccc6", "#474238", "#f4bd48", "#9c2128", "#395a8e", "#7facc6", "#2c695a"], ["Le Rubis", "#ffe6d4", "#6c2b3b", "#c76282", "#445e87", "#003c32", "#e0b411", "#c8491b"], ["Playgrounds", "#c49a70", "#4e0042", "#002185", "#076d16", "#feec00", "#ff6900", "#ff2702"], ["Bleu Outremer", "#4e6498", "#cdd3e3", "#c6353c", "#f6684f", "#fcd300", "#488b6d", "#7fb4b5"], ["Bleu Outremer Fonc\xE9", "#0e2d58", "#f4f4f4", "#c8c9ca", "#939598", "#616568", "#0e1318", "#080f15"], ["Noir d'Ivoire", "#080f15", "#C8C1B7", "#d7d7d7", "#b0b0b0", "#8b8b8b", "#676767", "#464646"]],
    escal = rande(3, 5.9),
    bgPalettes = [[["#fffceb", "#2c695a"], ["#0c2f3b", "#fffceb"], [colors[palette][escal], colors[palette][escal + 2]], "#2c695a", "#ffffff"], [["#e2e7dc", "#7b4800"], ["#000a27", "#e2e7dc"], [colors[palette][escal], colors[palette][escal + 2]], "#7b4800", "#ffffff"], [["#ccccc6", "#f4b631"], ["#0e1318", "#ccccc6"], [colors[palette][escal], colors[palette][escal + 2]], "#2e4873", "#ffffff"], [["#ffe6d4", "#f4b631"], ["#37132D", "#003c32"], [colors[palette][escal], colors[palette][escal + 2]], "#003c32", "#fffceb"], [["#c49a70", "#ffffff"], ["#8b8b8b", "#000000"], [colors[palette][escal], colors[palette][escal + 2]], "#fffceb", "#000000"], [["#cdd3e3", "#ffffff"], ["#000000", "#000000"], [colors[palette][escal], colors[palette][escal + 2]], "#ffb7aa", "#ffffff"], [["#0e2d58", "#ffffff"], ["#0e1318", "#000000"], [colors[palette][escal], colors[palette][escal + 2]], "#69b5e0", "#ffffff"], [["#b0b0b0", "#ffb7aa"], ["#080f15", "#b0b0b0"], [colors[palette][escal], colors[palette][escal + 2]], "#d7d7d7", "#ffffff"]],
    bgColors = bgPalettes[palette][mvtSel];
let gridColor = colors[palette][2];
const composition = [{
    name: "Ensemble",
    probability: 85,
    field: [10, 8, 15, 15, 20, 5, 15, 5],
    rainbow: 10,
    selective: 15,
    bugged: 1
}, {
    name: "Tears in the Rain",
    probability: 7,
    field: [5, 10, 15, 15, 15, 0, 15, 0],
    rainbow: 35,
    selective: 40,
    bugged: 3
}, {
    name: "Duet",
    probability: 7,
    field: [0, 12, 15, 15, 20, 5, 15, 0],
    rainbow: 10,
    selective: 10,
    bugged: 2
}];
let compSel = parseInt(weightedRand({
    0: composition[0].probability,
    1: composition[1].probability,
    2: composition[2].probability
}));
const ffTypes = [["curved", 1.05], ["truncated", 1.1], ["tilted", 1.05], ["zigzag", 1], ["waves", 1.08], ["scales", 1.2], ["seabed", 1.08], ["partiture", 1]];
let ffSel = parseInt(weightedRand({
        0: composition[compSel].field[0],
        1: composition[compSel].field[1],
        2: composition[compSel].field[2],
        3: composition[compSel].field[3],
        4: composition[compSel].field[4],
        5: composition[compSel].field[5],
        6: composition[compSel].field[6],
        7: composition[compSel].field[7]
    })),
    ffType = ffTypes[ffSel][0],
    typeDistributions = [[0, 1, 2], [2, 1, 0], [0, 2, 1], [1, 1, 1], [2, 2, 2]],
    typeSelect = parseInt(weightedRand({
        0: 40,
        1: 30,
        2: 10,
        3: 15,
        4: 10
    })),
    typeDist = typeDistributions[typeSelect],
    superOrder = parseInt(weightedRand({
        0: 75,
        1: 15,
        2: 5
    })),
    caffeine = parseInt(weightedRand({
        0: 95,
        1: 5
    }));
0 < superOrder && (caffeine = 0);
let selective = parseInt(weightedRand({
    0: 75,
    1: composition[compSel].selective
}));
const rainbow = parseInt(weightedRand({
    0: 55,
    1: 40,
    2: 10,
    3: composition[compSel].rainbow
}));
let bugged = parseInt(weightedRand({
    0: 100,
    1: composition[compSel].bugged
}));
bugged = !(1 != bugged);
const shadow = parseInt(weightedRand({
    0: 90,
    1: 10
}));
let border = parseInt(weightedRand({
    0: 40,
    1: 80
}));
1 == mvtSel && (border = 1);
const wac = parseInt(weightedRand({
    0: 10,
    1: 90
}));
let hat = parseInt(weightedRand({
    0: 5,
    1: 95
}));
const bgbrush = parseInt(weightedRand({
    0: 15,
    1: 85
}));
let ban = parseInt(weightedRand({
        0: 2,
        1: 98
    })),
    dott = 0;
0 == wac && (hat = 1, dott = 1, border = 1);
const venues = [{
        name: "House",
        reverb: 0,
        probability: 97,
        print: "his Home Piano"
    }, {
        name: "Concert Hall",
        reverb: .4,
        probability: 3,
        print: "a Concert Hall"
    }],
    venue = venues[parseInt(weightedRand({
        0: venues[0].probability,
        1: venues[1].probability
    }))];
let styles = ["pen", "2B", "HB", "2H", "cpencil", "spray", "rotring", "marker", "charcoal"],
    selectiveStyles = ["pen", "cpencil", "charcoal", "marker"],
    selectiveStylesB = ["pen", "cpencil", "2B", "marker"];
4 == palette && (selective = 1, ban = 0, dott = 1, hat = 1),
5 == palette && (selectiveStylesB = ["pen", "cpencil", "2B", "charcoal"], border = 1),
1 == mvtSel && (styles = ["pen", "2B", "marker", "2B", "charcoal", "spray", "rotring", "marker", "charcoal"]),
5 <= palette && (styles = ["pen", "2B", "HB", "2H", "charcoal", "charcoal", "cpencil", "spray", "rotring"], selectiveStyles = ["pen", "cpencil", "charcoal", "2B"]);
let minAngle,
    resolucion = parseFloat(.01 * 640),
    left_x = parseFloat(-320),
    right_x = parseFloat(960),
    top_y = parseFloat(-352),
    bottom_y = parseFloat(1056),
    num_columns = Math.round((right_x - left_x) / resolucion),
    num_rows = Math.round((bottom_y - top_y) / resolucion),
    flow_field = [],
    step_length = .4 * pixel;
function createField(e) {
    switch (e) {
    case "curved":
        for (angleRange = rande(-25, -15), 0 == rande(0, 100) % 2 && (angleRange *= -1), column = 0; column < num_columns; column++)
            for (flow_field.push([0]), row = 0; row < num_rows; row++) {
                var s = parseFloat(.02 * column),
                    a = parseFloat(.02 * row),
                    l = noise(parseFloat(s.toFixed(3)), parseFloat(a.toFixed(3))),
                    n = map(l, 0, 1, -angleRange, angleRange);
                flow_field[column][row] = 3 * n
            }
        minAngle = 10;
        break;
    case "truncated":
        for (angleRange = rande(-25, -15), 0 == rande(0, 100) % 2 && (angleRange *= -1), truncate = rande(5, 10), column = 0; column < num_columns; column++)
            for (flow_field.push([0]), row = 0; row < num_rows; row++) {
                var s = parseFloat(.02 * column),
                    a = parseFloat(.02 * row),
                    l = noise(parseFloat(s.toFixed(3)), parseFloat(a.toFixed(3))),
                    n = map(l, 0, 1, -angleRange, angleRange),
                    n = round(n / truncate) * truncate;
                flow_field[column][row] = 4 * n
            }
        minAngle = 10;
        break;
    case "tilted":
        angleRange = rande(-45, -25),
        0 == rande(0, 100) % 2 && (angleRange *= -1);
        var t = angleRange;
        for (column = 0; column < num_columns; column++) {
            flow_field.push([0]);
            var n = 0;
            for (row = 0; row < num_rows; row++)
                flow_field[column][row] = n,
                n += t,
                t = -1 * t
        }
        minAngle = 20;
        break;
    case "zigzag":
        angleRange = rande(-30, -15),
        0 == rande(0, 100) % 2 && (angleRange *= -1);
        var t = angleRange,
            n = 0;
        for (column = 0; column < num_columns; column++) {
            for (flow_field.push([0]), row = 0; row < num_rows; row++)
                flow_field[column][row] = n,
                n += t,
                t = -1 * t;
            n += t,
            t = -1 * t
        }
        minAngle = 15;
        break;
    case "waves":
        for (sinrange = rande(10, 15), cosrange = rande(3, 6), baseAngle = rande(20, 35), column = 0; column < num_columns; column++)
            for (flow_field.push([0]), row = 0; row < num_rows; row++)
                n = sin(sinrange * column) * (baseAngle * cos(row * cosrange)) + rande(-3, 3),
                flow_field[column][row] = n;
        minAngle = 10;
        break;
    case "scales":
        for (baseSize = rand(.3, .8), baseAngle = rande(20, 45), column = 0; column < num_columns; column++)
            for (flow_field.push([0]), row = 0; row < num_rows; row++)
                addition = rande(row / 65, row / 35),
                n = baseAngle * cos(baseSize * column * row) + addition,
                flow_field[column][row] = n;
        minAngle = 25;
        break;
    case "seabed":
        for (baseSize = rand(.3, .8), baseAngle = rande(18, 26), column = 0; column < num_columns; column++)
            for (flow_field.push([0]), row = 0; row < num_rows; row++)
                addition = rande(15, 20),
                n = baseAngle * sin(baseSize * row * column + addition),
                flow_field[column][row] = 1.1 * n;
        minAngle = 22;
        break;
    case "partiture":
        for (column = 0; column < num_columns; column++)
            for (flow_field.push([0]), row = 0; row < num_rows; row++)
                flow_field[column][row] = 0;
        minAngle = 10;
    }
}
class Pos {
    constructor(e, s)
    {
        this.x = e,
        this.y = s,
        this.update(this.x, this.y),
        this.plotted = 0
    }
    update(e, s)
    {
        this.x = e,
        this.y = s,
        this.x_offset = Math.round(1e4 * this.x / pixel) / 1e4 - left_x,
        this.y_offset = Math.round(1e4 * this.y / pixel) / 1e4 - top_y,
        this.column_index = Math.round(this.x_offset / resolucion),
        this.row_index = Math.round(this.y_offset / resolucion)
    }
    reset()
    {
        this.plotted = 0
    }
    isIn()
    {
        return 0 <= this.column_index && 0 <= this.row_index && this.column_index < num_columns && this.row_index < num_rows
    }
    isInCanvas()
    {
        return Math.round(1e3 * this.x / pixel) / 1e3 >= -32 && Math.round(1e3 * this.x / pixel) / 1e3 <= 672 && Math.round(1e3 * this.y / pixel) / 1e3 >= -32 && Math.round(1e3 * this.y / pixel) / 1e3 <= 672
    }
    angle()
    {
        return this.grid_angle = this.isIn() ? flow_field[this.column_index][this.row_index] : 0, this.grid_angle
    }
    moveTo(e, s, a)
    {
        if ("undefined" == typeof a && (a = .4), this.num_steps = e / a, this.isIn())
            for (this.i = 0; this.i < this.num_steps; this.i++)
                this.update(this.x, this.y),
                this.x_step = pixel * a * cos(this.angle() - s),
                this.y_step = pixel * a * sin(this.angle() - s),
                this.x += this.x_step,
                this.y += this.y_step,
                this.plotted += a;
        else
            this.plotted += a;
        this.update(this.x, this.y)
    }
    plotTo(e, s, a)
    {
        if ("undefined" == typeof a && (a = .4), this.num_steps = s / a, this.isIn())
            for (this.i = 0; this.i < this.num_steps; this.i++)
                this.update(this.x, this.y),
                this.x_step = pixel * a * cos(this.angle() - e.angle(this.plotted)),
                this.y_step = pixel * a * sin(this.angle() - e.angle(this.plotted)),
                this.x += this.x_step,
                this.y += this.y_step,
                this.plotted += a;
        else
            this.plotted += a;
        this.update(this.x, this.y)
    }
}
class LineStyle {
    constructor(e)
    {
        switch (this.type = e, this.type) {
        case "pen":
            this.params = [1, .3, .5, 5, 230, .4];
            break;
        case "rotring":
            this.params = [1, .1, .8, 15, 200, .6];
            break;
        case "2B":
            this.params = [.7, 1.5, .3, 10, 255, .4];
            break;
        case "HB":
            this.params = [.55, .9, .5, 4, 210, .4];
            break;
        case "2H":
            this.params = [.7, .6, .5, 1, 170, .4];
            break;
        case "cpencil":
            this.params = [1, 1, .9, 10, 120, .3];
            break;
        case "charcoal":
            this.params = [1.5, 4, .85, 2, 150, .1];
            break;
        case "marker":
            this.params = [5, .5, .5, 4, 60, 1],
            this.marker = !0;
            break;
        case "spray":
            this.params = [.5, 20, .5, 50, 190, 2],
            this.spray = !0;
        }
        this.weight = this.params[0] * pixel,
        this.vibration = this.params[1],
        this.def = this.params[2],
        this.quality = this.params[3],
        this.opacity = this.params[4],
        this.step_length = this.params[5]
    }
    brushvariation()
    {
        switch (this.type) {
        case "pen":
            this.param = [rand(.35, .65), rand(.7, .8), 1.3, .8, rand(3.5, 5)];
            break;
        case "rotring":
            this.param = [rand(.45, .55), rand(.7, .8), 1.1, .9, rand(3.5, 5)];
            break;
        case "2H":
        case "2B":
        case "HB":
            this.param = [rand(.35, .65), rand(.7, .8), 1.3, .8, rand(3.5, 5)];
            break;
        case "cpencil":
            this.param = [rand(.35, .65), rand(.7, .8), 1.2, .9, rand(3.5, 5)];
            break;
        case "charcoal":
            this.param = [rand(.35, .65), rand(.7, .8), 1.3, .8, rand(3.5, 5)];
            break;
        case "marker":
            this.param = [rand(.45, .55), rand(.85, .9), 1, .75, rand(3, 6)];
            break;
        case "spray":
            this.param = [rand(.45, .55), rand(.85, .9), .3, 1.2, rand(5, 7)];
        }
        this.a = this.param[0],
        this.b = this.param[1],
        this.m1 = this.param[2],
        this.m2 = this.param[3],
        this.c = this.param[4],
        this.adj = 1,
        this.adj2 = 1,
        stroke(this.tono),
        fill(this.tono),
        this.marker ? (this.adj = this.scale, this.adj2 = .9 * this.scale, this.randMark = rand(.1, .3), this.randMark2 = rand(.7, .9)) : noStroke()
    }
    plot(e, s, a, l, n)
    {
        push(),
        this.scale = n,
        this.tono = color(l),
        this.distance = 0,
        this.tono.setAlpha(this.opacity),
        this.brushvariation(),
        this.x = s + e.adjust[0] * pixel,
        this.y = a + e.adjust[1] * pixel,
        this.length = e.length,
        this.linepoint = new Pos(this.x, this.y),
        this.step = this.step_length / this.scale * sq(this.adj2);
        let t = Math.round(e.length / this.step);
        for (let p = 0; p < t; p++)
            this.brush(),
            this.linepoint.plotTo(e, this.step, this.step);
        this.marker && paintColor(this.tono, .4),
        pop()
    }
    line(e, s, a, l, n, t, p)
    {
        if (push(), this.scale = t, this.tono = color(n), this.distance = 0, this.tono.setAlpha(this.opacity), this.brushvariation(), "straight" == p) {
            this.x2 = a,
            this.y2 = l,
            this.difX = this.x2 - e,
            this.difY = this.y2 - s,
            this.difM = Math.max(Math.abs(this.difX), Math.abs(this.difY)),
            this.linepoint = new Pos(e, s),
            this.length = dist(this.x2, this.y2, e, s);
            for (let a = 0; a <= Math.round(2 * (1e3 * this.difM) / this.weight) / 1e3; a++)
                this.brush(),
                this.x_step = map(a, 0, 2 * this.difM / this.weight, 0, this.difX),
                this.y_step = map(a, 0, 2 * this.difM / this.weight, 0, this.difY),
                this.linepoint.update(e + this.x_step, s + this.y_step)
        } else {
            this.x = e,
            this.y = s,
            this.length = a,
            this.dir = l,
            this.linepoint = new Pos(this.x, this.y),
            this.step = this.step_length / this.scale * sq(this.adj2);
            let n = Math.round(this.length / pixel / this.step);
            for (let e = 0; e < n; e++)
                this.brush(),
                this.linepoint.moveTo(this.step, this.dir, this.step)
        }
        this.marker && paintColor(this.tono, .4, "marker"),
        pop()
    }
    brush()
    {
        if (this.spray) {
            this.vibr = pixel * this.scale * this.vibration * this.bell(.5, .9, 3, .2, 1) + pixel * this.vibration / 5 * randomGaussian();
            let e = rand(.9 * this.weight, 1.1 * this.weight);
            for (this.j = 0; this.j < this.quality; this.j++)
                this.randSp = rand(.9, 1.1),
                this.randX = rand(this.randSp * -this.vibr, this.randSp * this.vibr),
                this.randY = rand(-1, 1) * sqrt(sq(this.randSp * this.vibr) - this.randX * this.randX),
                circle(this.linepoint.x + this.randX, this.linepoint.y + this.randY, e)
        } else if (this.marker) {
            for (maskBuffer.push(), maskBuffer.fill(0, 255, 0, 100), maskBuffer.circle(this.linepoint.x, this.linepoint.y, this.scale * this.weight * this.bell(this.a, this.b, 5, this.m1, this.m2)), this.markerOpacity(0, this.randMark, "inicio"), this.markerOpacity(this.randMark2, 1, "final"), this.j = 0; this.j < rande(1, 4); this.j++)
                this.markerOpacity(.25 * this.j + rand(.05, .3), .25 * this.j + rand(.25, .4));
            maskBuffer.pop()
        } else
            this.vibr = pixel * this.scale * this.vibration * (this.def + (1 - this.def) * this.bell(.5, .9, 5, .2, 1) * randomGaussian()),
            .4 < rand(0, this.quality) && circle(this.linepoint.x + .7 * rand(-this.vibr, this.vibr), this.linepoint.y + rand(-this.vibr, this.vibr), rand(.9 * this.weight, 1.1 * this.weight) * this.bell(this.a, this.b, 5, this.m1, this.m2))
    }
    markerOpacity(e, s, a)
    {
        this.distance = this.linepoint.plotted * pixel,
        this.distance < s * this.length && this.distance > e * this.length && (this.opacity2 = "inicio" == a ? this.opacity * (1 - map(this.distance, e * this.length, s * this.length, 0, 1)) : "final" == a ? this.opacity * (1 - map(this.distance, e * this.length, s * this.length, 1, 0)) : this.opacity * (1 - Math.abs(map(this.distance, e * this.length, s * this.length, -1, 1))), maskBuffer.push(), maskBuffer.fill(0, 0, 255, this.opacity2), maskBuffer.circle(this.linepoint.x + rand(-this.vibration, this.vibration), this.linepoint.y + rand(-this.vibration, this.vibration), this.scale * this.weight), (this.distance <= rand(.01, .015) * this.length || this.distance >= rand(.985, .99) * this.length) && maskBuffer.circle(this.linepoint.x, this.linepoint.y, this.scale * this.weight), maskBuffer.pop())
    }
    bell(e, s, a, l, n)
    {
        return this.distance = this.linepoint.plotted * pixel, this.graph = 1 / (1 + pow(Math.abs((this.distance - e * this.length) / (s * this.length / 2)), 2 * a)), map(this.graph, 0, 1, l, n)
    }
}
let textureC,
    textureC1,
    textureC2,
    bgtexture = new LineStyle("spray"),
    bgtexture2 = new LineStyle("2H");
function bgTexture(e) {
    let s = color(colors[palette][1]);
    if (0 == palette) {
        0 == e && (textureC = color(red(s) - 8, green(s) - 8, blue(s) - 8));
        for (let s = 0; 13 > s; s++)
            bgtexture2.line((13 * 2.5 * e + 2.5 * s) * pixel, 0, (13 * 2.5 * e + 2.5 * s) * pixel, heightW, textureC, .3, "straight")
    } else if (4 == palette)
        ;
    else
        6 >= palette ? (0 == e && (textureC = color(red(s) - 25, green(s) - 25, blue(s) - 25)), 0 == e % 4 && bgtexture.line(160 * e / 4 * pixel, 0, 160 * e / 4 * pixel, heightW, textureC, 30, "straight")) : (0 == e && (textureC = color(red(s) + 25, green(s) + 25, blue(s) + 25)), 0 == e % 5 && bgtexture.line(640 / 3 * e / 5 * pixel, 0, 640 / 3 * e / 5 * pixel, heightW, textureC, 40, "straight"))
}
let doodleNumber,
    density,
    doodles = [],
    totalElE = 0,
    totalElO = 0,
    borderMask = [],
    dots = [],
    distSel = parseInt(weightedRand({
        0: 25,
        1: 25,
        2: 20,
        3: 10
    }));
(1 <= compSel || .5 == compSel) && (distSel = 1);
function compose() {
    function e(e) {
        s = parseInt(weightedRand({
            0: e[0],
            1: e[1],
            2: e[2],
            3: e[3]
        }))
    }
    let s;
    switch (compSel) {
    case 0:
        doodleNumber = 2 * rande(2, 3.7);
        let g = rande(3, 4.9),
            d = 1;
        for (0 == marg && (g = 4), 4 == g && (doodleNumber = 6, d = .9), u = 0; u < g + 1; u++)
            for (dots.push([]), j = 0; j < g + 1; j++)
                dots[u][j] = [2 * w1Active + j * (w2Active - w1Active - 2 * w1Active) / g, 2 * h1Active + u * (h2Active - h1Active - 2 * w1Active) / g, 0],
                cross(dots[u][j][0], dots[u][j][1], 7);
        let c = rande(1, g - .01),
            f = 1,
            b = rande(1, g - .01),
            y = 1;
        1 == c && (f = 2),
        1 == b && (y = 2);
        let x = 0,
            v = 0,
            w = 0,
            S = 0;
        function k(e) {
            let s;
            return sum = .8 > fxrand() ? 1 : 0, mult = .5 > fxrand() ? -1 : 1, s = 0 == e ? e + sum : e == g ? e - sum : e + mult * sum, s
        }
        for (doodles.push(new Doodle(new Plot(u, d * rand(1, 1.5) - marg), dots[f][y][0], dots[f][y][1])), dots[f][y][2] = 1, u = 0; u < doodleNumber - 1; u++)
            for (doodles.push(new Doodle(new Plot(u, d * rand(1, 1.5) - marg), dots[c][b][0], dots[c][b][1])), dots[c][b][2] = 1, dRowp = c, dColp = b; c == dRowp && b == dColp;) {
                for (; 1 == dots[c][b][2];)
                    c = k(c),
                    b = k(b);
                0 == b && 1 == w || b == g && 1 == S || 0 == c && 1 == x || c == g && 1 == v ? (c = dRowp, b = dColp) : (0 == c ? x = 1 : c == g && (v = 1), (1 !== x || 1 !== v) && (0 == b ? w = 1 : b == g && (S = 1)))
            }
        density = .85,
        5 > doodleNumber && (density = .95);
        break;
    case 1:
        density = rand(.5, .85),
        2 <= s && (density = rand(.45, .75));
        var a = 2 * rande(4, 5.99) + 1,
            l = (w2Active - w1Active) / (a - 1),
            n = Math.round((h2Active - h1Active) / l) + 1;
        doodleNumber = 0,
        e([30, 25, 10, 5]),
        2 == mvtSel && e([25, 25, 25, 25]);
        for (var t, p = rand(.15, .35), r = new Pos(w1Active, h1Active), u = 0; u < n; u++) {
            for (t = new Pos(r.x, r.y), j = 0; j < a; j++)
                fxrand() > p && (doodles.push(new Doodle(new Plot(s, rand(.28, .38) - marg / 3), t.x, t.y)), doodleNumber++),
                cross(t.x, t.y, 10 - a),
                t.moveTo(Math.round(1e3 * l / pixel) / 1e3, 0);
            r.moveTo(Math.round(1e3 * ((h2Active - h1Active) / (n - 1)) / pixel) / 1e3, 270, .4, 1)
        }
        break;
    case 2:
        var h = fxrand();
        function _(e) {
            return .5 > h ? e * widthW / 3 : (3 - e) * widthW / 3
        }
        e([90, 10, 0, 0]),
        2 == mvtSel && e([25, 25, 25, 25]),
        doodles.push(new Doodle(new Plot(s, rand(1.7, 2.2) - marg), _(1), heightW / 3)),
        doodles.push(new Doodle(new Plot(s, rand(1.7, 2.2) - marg), _(2), 2 * heightW / 3)),
        doodleNumber = 2,
        density = 1;
    }
    doodles = shuffler(doodles)
}
function cross(e, s, a) {
    gridLines.line(e, s, e, s + a * pixel, gridColor, .5, "straight"),
    gridLines.line(e, s, e, s - a * pixel, gridColor, .5, "straight"),
    gridLines.line(e, s, e + a * pixel, s, gridColor, .5, "straight"),
    gridLines.line(e, s, e - a * pixel, s, gridColor, .5, "straight")
}
class Plot {
    constructor(e, s)
    {
        this.segments = [],
        this.angles = [],
        this.scales = [],
        this.outer = [],
        this.doodleScale = s,
        this.dist;
        var a = 0;
        switch (mvtSel) {
        case 0:
            switch (this.dist = [[0, 0, 0, 0, 0, 0], [0, 1, 2, 3, 1, 0], [0, 2, 3, 2, 0, 3], [1, 3, 1, 0, 1, 1]], this.dist[distSel][e]) {
            case 0:
                this.doodle = "sun",
                this.dir = 0,
                this.type = .15 > rand(0, 1) ? "truncated" : "curve";
                var n = 140 * this.doodleScale,
                    t = rand(14, 17),
                    p = rand(75, 85),
                    r = rande(60, 80);
                this.adjust = [-n / 1.1, 0];
                var u;
                for (u = 0; u <= rande(9, 14); u++)
                    a = 5 > u ? 1 : 0,
                    this.push(p - r * u, 2.5 - compSel / 2 - u / 10, n - u * n / t, a);
                this.angles.push(p - r * u);
                break;
            case 1:
                this.doodle = "flower",
                this.dir = 0,
                this.type = "curve";
                var h = rande(20, 25),
                    g = this.doodleScale * rand(90, 200);
                this.adjust = [0, g],
                this.push(rande(80, 120), 0, g),
                this.push(this.angles[0] + rande(-10, 10), 0, 0),
                this.push(this.angles[1], 0, 0);
                var d = rand(50, 90);
                this.push(this.angles[2] + 90, -.3, this.doodleScale * d),
                this.push(this.angles[3] - 180, -.3, this.doodleScale * d),
                this.push(this.angles[4] - 180, 0, 0),
                this.push(this.angles[5], 0, 0),
                this.angles.push(this.angles[6] - 270);
                for (var c, u = 0; 6 > u; u++)
                    c = this.doodleScale * rande(250, 350),
                    this.push(this.angles[7 + 6 * u] - h, -.5, c / 3, 1),
                    this.push(this.angles[8 + 6 * u] - 90, -1, c / 7, 1),
                    this.push(this.angles[9 + 6 * u] - 90, -1, c / 7, 1),
                    this.push(this.angles[10 + 6 * u] - h, -.5, c / 3, 1),
                    this.push(this.angles[11 + 6 * u] - 110, 0, 0, 1),
                    this.push(this.angles[12 + 6 * u] - 90, 0, 0, 1);
                break;
            case 2:
                this.doodle = "cloud",
                this.dir = 0,
                this.type = "curve";
                var p = rande(160, 190),
                    f = 85 * this.doodleScale;
                for (this.adjust = [-1.3 * f, .7 * f / 2], u = 0; 5 > u; u++) {
                    var b = Math.abs(Math.abs(-2 + u) - 2);
                    this.push(p - 410 * u + 10 * u, -.5, rand(b * f, (b + 1) * f), 1),
                    this.push(p - 180 - 25 - 410 * u + 20 * u, 0, 0, 1)
                }
                this.push(0, 0, 0, 1),
                this.push(195, 2, 3 * f, 1);
                for (let e = 0; 5 > e; e++) {
                    var y = Math.abs(Math.abs(-2 + u) - 2);
                    this.push(p - 410 * e + 10 * e, .3, rand(.7 * (y * f), .7 * ((y + 1) * f))),
                    this.push(p - 180 - 25 - 410 * e + 20 * e, 0, 0)
                }
                this.angles.push(180);
                break;
            case 3:
                this.doodle = "butterfly",
                this.type = "curve",
                this.dir = 180;
                var x = 1.5 * this.doodleScale,
                    v = rand(20, 60);
                this.adjust = [-rande(20, 70) * x, 10 * x],
                this.push(v, 0, 10),
                this.push(this.angles[0] - 90, 0, 40 * x),
                this.push(this.angles[1] - 10, 0, 0),
                this.push(this.angles[2] + 55, 0, 75 * x),
                this.push(this.angles[3] - 30, 0, 5 * x),
                this.push(this.angles[4] + 90, 0, 5 * x),
                this.push(this.angles[5] + 90, 0, 20 * x),
                this.push(this.angles[6], 0, 0),
                this.push(this.angles[7] - 160, 0, 0),
                this.push(this.angles[8], .15, 30 * x, 1),
                this.push(this.angles[9] + 170, .15, 10 * x, 1),
                this.push(this.angles[10], 0, 0),
                this.push(this.angles[11] - 170, .15, 10 * x, 1),
                this.push(this.angles[12], .15, 20 * x, 1),
                this.push(this.angles[13] + 190, .15, 10 * x, 1),
                this.push(this.angles[14], 0, 0),
                this.push(this.angles[15] - 160, .15, 40 * x, 1),
                this.push(this.angles[16] - 10, .15, 15 * x, 1),
                this.push(this.angles[17] - 150, .15, 15 * x, 1),
                this.push(this.angles[18], 0, 0),
                this.push(this.angles[19] + 160, 0, 35 * x, 1),
                this.push(this.angles[20] - 180, 0, 0),
                this.push(this.angles[21] + 150, 0, 25 * x, 1),
                this.push(this.angles[22] - 150, 0, 0),
                this.push(this.angles[23] + 120, -.15, 15 * x, 1),
                this.push(this.angles[24] + 120, -.3, 40 * x, 1),
                this.push(this.angles[25] + 15, -.3, 55 * x, 1),
                this.push(this.angles[26] + 110, 0, 0),
                this.push(this.angles[27] - 170, .15, 25 * x, 1),
                this.push(this.angles[28], .15, 25 * x, 1),
                this.push(this.angles[29] + 170, .15, 15 * x, 1),
                this.push(this.angles[30], 0, 0),
                this.push(this.angles[31] - 150, .15, 20 * x, 1),
                this.push(this.angles[32], .15, 20 * x, 1),
                this.push(this.angles[33] + 160, .15, 10 * x, 1),
                this.push(this.angles[34], 0, 0),
                this.push(this.angles[35] - 160, .15, 30 * x, 1),
                this.push(this.angles[36] + 20, .15, 20 * x, 1),
                this.push(this.angles[37] + 150, .15, 45 * x, 1),
                this.push(this.angles[38] + 30, 0, 0),
                this.push(this.angles[39] - 170, .2, 65 * x, 1),
                this.push(this.angles[40] - 30, .5, 30 * x, 1),
                this.push(this.angles[41] - 140, .5, 50 * x, 1),
                this.push(this.angles[42] + 30, .5, 65 * x, 1),
                this.push(this.angles[43] - 115, .2, 50 * x, 1),
                this.push(this.angles[44] - 15, 0, 0),
                this.push(this.angles[45] - 130, .15, 18 * x, 1),
                this.push(this.angles[46] + 10, .15, 17 * x, 1),
                this.push(this.angles[47] + 150, .15, 13 * x, 1),
                this.push(this.angles[48] + 20, 0, 0),
                this.push(this.angles[49] - 170, .15, 18 * x, 1),
                this.push(this.angles[50] + 20, .15, 13 * x, 1),
                this.push(this.angles[51] + 150, .15, 13 * x, 1),
                this.push(this.angles[52] + 15, 0, 0),
                this.push(this.angles[53] - 160, .15, 40 * x, 1),
                this.push(this.angles[54], .15, 15 * x, 1),
                this.push(this.angles[55] + 170, .1, 105 * x, 1),
                this.push(this.angles[56] + 50, 0, 5 * x),
                this.push(this.angles[57] - 180, .2, 135 * x, 1),
                this.push(this.angles[58] - 50, .5, 35 * x, 1),
                this.push(this.angles[59] - 160, .5, 40 * x, 1),
                this.push(this.angles[60] + 20, .4, 35 * x, 1),
                this.push(this.angles[61] + 35, .5, 35 * x, 1),
                this.push(this.angles[62] - 120, .5, 25 * x, 1),
                this.push(this.angles[63], 0, 20 * x),
                this.push(this.angles[64] - 180, 0, 25 * x),
                this.push(this.angles[65] - 25, 0, 30 * x),
                this.push(this.angles[66], 0, 10 * x),
                this.push(this.angles[67] - 80, .5, 55 * x, 1),
                this.push(this.angles[68] - 20, 0, 10 * x),
                this.push(this.angles[69] - 107, .2, 68 * x, 1),
                this.push(this.angles[70] + 25, 0, 5 * x),
                this.push(this.angles[71] + 150, 0, 50 * x),
                this.push(this.angles[72] + 20, 0, 10 * x),
                this.push(this.angles[73] + 170, 0, 50 * x),
                this.push(this.angles[74] + 10, 0, 8 * x),
                this.push(this.angles[75] + 40, 0, 15 * x),
                this.push(this.angles[76] - 180, 0, 3 * x),
                this.push(this.angles[77], 0, 5 * x),
                this.push(this.angles[78] - 270, 0, 35 * x),
                this.push(this.angles[79] + 30, 0, 20 * x),
                this.angles.push(this.angles[80] + 40);
            }
            break;
        case 1:
            switch (this.dist = [[0, 0, 0, 2, 1, 1], [0, 1, 3, 1, 2, 0], [1, 2, 2, 1, 3, 2], [0, 1, 2, 1, 0, 1]], this.dist[distSel][e]) {
            case 0:
                this.doodle = "star",
                this.dir = 0,
                this.type = "truncated";
                var n = 300 * this.doodleScale,
                    w = 5,
                    p = 36,
                    S = rande(-15, 15);
                this.adjust = [-n / 2.7, +n / 4],
                .3 > fxrand() && (w = 7, p = 180 / 7, this.adjust = [-n / 2, +n / 6.3]),
                this.push(p + S, 1 * rand(.6, 1.8), 3 * n / 8, 1),
                this.push(p + S, .1, 2 * n / 8),
                this.push(p + S, 1 * rand(.6, 1.8), 3 * n / 8, 1);
                for (var u = 0; u < w - 1; u++)
                    this.push(this.angles[3 * u] + (180 + p), 1 * rand(.6, 1.8), 3 * n / 8, 1),
                    this.push(this.angles[3 * u] + (180 + p), .1, 2 * n / 8),
                    this.push(this.angles[3 * u] + (180 + p), 1 * rand(.6, 1.8), 3 * n / 8, 1);
                this.angles.push(p + S + (180 + p));
                break;
            case 1:
                this.doodle = "moon",
                this.dir = 0,
                this.type = "curve";
                var n = 500 * this.doodleScale,
                    p = rande(-15, 15);
                const s = [[], [230 + p, -250, -45, 163, .68 * n], [230 + p, -250, -20, 130, .5 * n]],
                    a = parseInt(weightedRand({
                        0: 5,
                        1: 50,
                        2: 50
                    }));
                1 <= a ? (this.adjust = [n / 6, +n / 6], this.push(s[a][0], 1.5, n, 1), this.push(s[a][0] + s[a][1], 0, 0, 1), this.push(s[a][0] + s[a][2], -1, s[a][4], 1), this.push(s[a][0] + s[a][3], 0, 0, 1)) : 0 == a && (n = 350 * this.doodleScale, this.adjust = [0, +n / 3.2], this.push(180 + p, 1.5, n, 1), this.push(0 + p, 0, 0, 1), this.push(360 + p, 1, n, 1), this.push(180 + p, 0, 0, 1), this.push(this.angles[3] + rande(-5, 5), 0, n / 3 * rand(.9, 1.1)), this.push(this.angles[4] - 150, .8, n / 5 * rand(.9, 1.4)), this.push(this.angles[5] - 180, -.2, n / 5 * rand(.9, 1.4)), this.push(this.angles[6] - 180, 0, 0), this.push(this.angles[7] + rande(-5, 5), 0, n / 3 * rand(.9, 1.1)), this.push(this.angles[8] + 150, .25, n / 4 * rand(.75, 1.3)), this.push(this.angles[9] + 180, -.8, n / 4 * rand(.75, 1.3)), this.push(this.angles[10] + 180, 0, 0), this.push(this.angles[11] - 100 + rande(-5, 5), 0, n / 3 * rand(.9, 1.1)), this.push(this.angles[12] - 130, .8, n / 7 * rand(.6, 1)), this.push(this.angles[13] - 180, -.25, n / 7 * rand(.6, 1)), this.push(this.angles[14] - 180, 0, 0)),
                this.angles.push(p);
                break;
            case 2:
                this.doodle = "flower_night",
                this.dir = 0,
                this.type = "curve";
                var n = 230 * this.doodleScale;
                this.adjust = [0, 1 * n];
                var p = rande(95, 105);
                this.push(p, 0, n / 2),
                this.push(this.angles[0] - 20, 0, n / 4),
                this.push(this.angles[1] - 30, -.3, n / 3),
                this.push(this.angles[2] - 20, 0, 0),
                this.push(this.angles[3] - 120, .3, n / 2),
                this.push(this.angles[4] - 50, .3, n / 5),
                this.push(this.angles[5] - 130, 0, n / 3),
                this.push(this.angles[6] + 10, 0, n / 3),
                this.push(this.angles[7] + 10, 1.3, n / 2, 1),
                this.push(this.angles[8] + 90, 1.3, n / 5, 1),
                this.push(this.angles[9] + 90, 1.3, n / 5, 1),
                this.push(this.angles[10] + 20, 1.3, n / 2, 1),
                this.push(this.angles[11] + 70, 0, n / 3, 1),
                this.push(this.angles[12] + 70, 0, n / 3, 1),
                this.push(this.angles[13] + 10, 1, n / 2.5, 1),
                this.push(this.angles[14] + 90, 1, n / 6, 1),
                this.push(this.angles[15] + 90, 1, n / 6, 1),
                this.push(this.angles[16] + 10, 1, n / 2, 1),
                this.push(this.angles[17] + 40, .2, n / 4, 1),
                this.push(this.angles[18] + 90, .7, n / 4, 1),
                this.push(this.angles[19] + 25, .9, n / 3, 1),
                this.push(this.angles[20] + 90, .9, n / 6, 1),
                this.push(this.angles[21] + 90, .9, n / 6, 1),
                this.push(this.angles[22] + 15, .9, n / 4, 1),
                this.push(this.angles[23] + 10, -.5, n / 7, 1),
                this.push(this.angles[24] - 60, -.5, n / 4, 1),
                this.push(this.angles[25] - 70, 0, n / 2),
                this.push(this.angles[26] - 60, -.15, n / 3, 1),
                this.push(this.angles[27] - 90, -.15, n / 8),
                this.angles.push(this.angles[28] - 40);
                break;
            case 3:
                this.doodle = "owl",
                this.type = "curve";
                var p = 290 + rande(-10, 10);
                this.dir = 0;
                var n = 250 * this.doodleScale;
                this.adjust = [-n / 2.7, -n / 10],
                this.push(p - 10, .5, n / 4, 1);
                for (var u = 0; 5 > u; u++)
                    this.push(this.angles[0 + 6 * u], .5, n / 7, 1),
                    this.push(this.angles[1 + 6 * u] + 95, .5, n / 15, 1),
                    this.push(this.angles[2 + 6 * u] + 80, 0, (1 + u) / 2 * n / 30),
                    this.push(this.angles[3 + 6 * u] - 10, 0, (1 + u) / 5 * n / 25 + n / 23),
                    this.push(this.angles[4 + 6 * u] + 170, .5, (1 + u) / 5 * n / 25 + n / 23),
                    this.push(this.angles[5 + 6 * u] + 30, .5, (1 + u) / 2 * n / 30 + u * n / 30, 1);
                this.push(this.angles[30], 1, n / 15, 1),
                this.push(this.angles[31] + 90, 0, n / 30, 1),
                this.push(this.angles[32] + 58, .5, n / 1.7, 1),
                this.push(this.angles[33] + 14, 1, n / 1.4, 1),
                this.push(this.angles[34] + 92, .6, n / 3.5, 1),
                this.push(this.angles[35] - 110, .3, n / 10, 1),
                this.push(this.angles[36] - 15, 0, 0),
                this.push(this.angles[37] + 205, 0, n / 12),
                this.push(this.angles[38] + 10, 0, n / 4),
                this.push(this.angles[39] + 190, 0, n / 5),
                this.push(this.angles[40] + 190, rande(0, 1.2), n / 6),
                this.push(this.angles[41] + 190, rande(0, 1.2), n / 6),
                this.push(this.angles[42] + 340, 0, n / 3.5),
                this.push(this.angles[43] + 70, 0, n / 13),
                this.push(this.angles[44] + 180, .3, n / 5, 1),
                this.push(this.angles[45] + 10, .5, n / 8, 1),
                this.push(this.angles[46] - 30, .3, n / 5, 1),
                this.push(this.angles[47] + 10, 0, n / 11),
                this.push(this.angles[48] + 180, 0, n / 17),
                this.push(this.angles[49] + 10, 0, n / 4),
                this.push(this.angles[50] + 97, .3, n / 11),
                this.push(this.angles[51] + 185, .3, n / 11),
                this.push(this.angles[52] + 155, rande(.5, 1.3), n / 4.5),
                this.push(this.angles[53] + 160, rande(.5, 1.3), n / 4, 1),
                this.push(this.angles[54] + 175, 0, n / 6.5, 1),
                this.push(this.angles[55] + 30, 0, 0),
                this.push(this.angles[56] + 210, 0, n / 15),
                this.angles.push(this.angles[57]);
            }
            break;
        case 2:
            switch (this.dist = [[0, 0, 0, 3, 1, 1], [0, 1, 2, 3, 1, 0], [2, 0, 2, 1, 3, 2], [1, 3, 2, 1, 0, 1]], this.dist[distSel][e]) {
            case 0:
                this.doodle = "diamond",
                this.dir = 0;
                var S = rande(-5, 5);
                this.type = "curve";
                var n = 195 * this.doodleScale;
                this.adjust = [-n / 2, 0];
                var k = rande(3, 5),
                    _ = rand(4, 6),
                    C = rande(5, 30);
                this.push(50 + S, rand(1.2, 1.8), n, 1),
                this.push(70 + S, 0, 0);
                for (var z = 0; z <= k; z++)
                    2 > z && (a = 1),
                    this.push(this.angles[0 + 4 * z] + 270 - C, rand(.8, 1.8), n - z * n / _, a),
                    1 == z && (a = 0),
                    this.push(this.angles[1 + 4 * z] + 270 - C, 0, 0),
                    this.push(this.angles[2 + 4 * z] + 270 + C, rand(.8, 1.8), n - z * n / _, a),
                    this.push(this.angles[3 + 4 * z] + 270 + C, 0, 0);
                this.angles.push(90);
                break;
            case 1:
                this.doodle = "club",
                this.dir = 0,
                this.type = "curve";
                var S = rande(-5, 5),
                    n = 220 * this.doodleScale;
                this.adjust = [0, +n / 1.2];
                var I = 3;
                .15 > fxrand() && I++,
                this.push(80 + S, 0, n),
                this.push(this.angles[0] + 10, 0, 0);
                for (var _, u = 0; u < I; u++)
                    _ = rand(.9, 1.1),
                    this.push(this.angles[1] + 135 - rande(75, 95) * u, -.85, n / 2 * rand(.9, 1.1) * _, 1),
                    this.push(this.angles[2 + 6 * u] - 51, -.85, n / 2 * rand(.9, 1.1) * _, 1),
                    this.push(this.angles[3 + 6 * u] - 185, 0, n / 10 * rand(.9, 1.1) * _, 1),
                    this.push(this.angles[4 + 6 * u] - 185, -.25, n / 2 * rand(.9, 1.1) * _, 1),
                    this.push(this.angles[5 + 6 * u] - 185, -.25, n / 2 * rand(.9, 1.1) * _, 1),
                    this.push(this.angles[6 + 6 * u] - 51, 0, 0);
                this.angles.push(0);
                break;
            case 2:
                this.doodle = "heart",
                this.dir = 0,
                this.type = "curve";
                var S = rande(-5, 5),
                    n = 220 * this.doodleScale;
                this.adjust = [-n / 6, +n / 1.8];
                for (var _, M = rande(2.4, 4.2), u = 0; u < M; u++)
                    _ = rand(.9, 1.1),
                    a = 0 == u ? 1 : 0,
                    this.push(135 + S, -rand(.8, 1.9), n * rand(.9, 1.1) - u * n / 5, a),
                    this.push(this.angles[0 + 6 * u] - 51, -rand(.8, 1.9), n * rand(.9, 1.1) - u * n / 10, a),
                    this.push(this.angles[1 + 6 * u] - 185, 0, n / 5 * rand(.9, 1.1), a),
                    this.push(this.angles[2 + 6 * u] - 185, -.2, n - u * n / 10, a),
                    this.push(this.angles[3 + 6 * u] - 185, -.2, n * rand(.9, 1.1) - u * n / 10, a),
                    this.push(this.angles[4 + 6 * u] - 51, 0, 0);
                this.angles.push(0);
                break;
            case 3:
                this.doodle = "spade",
                this.dir = 0,
                this.type = "curve";
                var S = rande(-5, 5),
                    n = 180 * this.doodleScale;
                this.adjust = [-n / 3, +n / 1.6],
                this.push(45 + S, -.5, n / 2, 1),
                this.push(this.angles[0] + 25, -.5, 0),
                this.push(this.angles[1] + 150, -rand(.5, 1.8), n, 1),
                this.push(this.angles[2] - 180, -rand(.5, 1.8), n / 1.45, 1),
                this.push(this.angles[3] + 10, 0, 0),
                this.push(this.angles[4] + 180 + 80, -rand(.5, 1.8), n / 1.45, 1),
                this.push(this.angles[5] + 10, -rand(.5, 1.8), n, 1),
                this.push(this.angles[6] - 180, 0, 0),
                this.push(this.angles[7] + 150, -.7, n / 2, 1),
                this.push(this.angles[8] + 25, -.95, 0),
                this.push(this.angles[9] - 135, .7, n / 1.5, 1),
                this.angles.push(this.angles[10]);
            }
        }
        this.length = Math.round(1e3 * this.segments.reduce((e, s) => e + s, 0)) / 1e3
    }
    push(e, s, a, l)
    {
        "undefined" != typeof e && this.angles.push(e);
        "undefined" != typeof a && (0 == a && (a = 1), this.segments.push(a));
        "undefined" != typeof s && this.scales.push(s),
        "undefined" == typeof l ? this.outer.push(0) : this.outer.push(l)
    }
    angle(e)
    {
        if (e > this.length)
            return 0;
        switch (this.calcIndex(e), this.type) {
        case "curve":
            return map(e - this.suma, 0, this.segments[this.index], this.angles[this.index], this.angles[this.index + 1], !0);
        case "truncated":
            return this.angles[this.index];
        }
    }
    border(e)
    {
        return e > this.length ? 0 : (this.calcIndex(e), this.outer[this.index])
    }
    scale(e)
    {
        return e > this.length ? 0 : (this.calcIndex(e), this.scales[this.index])
    }
    calcIndex(e)
    {
        this.index = -1;
        let s = 0;
        for (this.suma = 0; s <= e;)
            this.suma = s,
            s += this.segments[this.index + 1],
            this.index++
    }
}
class Doodle {
    constructor(e, s, a)
    {
        this.origin = {
            x: s,
            y: a
        },
        this.plot = e;
        0 === compSel ? this.param = [rande(9, 15), 4] : 1 === compSel ? this.param = [rande(13, 17), 2.8] : 2 === compSel ? this.param = [rande(13, 17), 5] : .5 === compSel ? this.param = [rande(15, 20), 4] : void 0;
        this.baseSize = this.param[0] * pixel,
        this.separacion = 0 == superOrder ? rand(.8, 1.2) * this.param[1] : this.param[1],
        this.size = 3.5 * e.doodleScale * this.baseSize,
        this.elements = [],
        this.length = 0,
        this.bg = [],
        this.hull = [],
        1 == selective && (1 == compSel ? this.globalBrush = selectiveStylesB[rande(0, selectiveStyles.length - .1)] : this.globalBrush = selectiveStyles[rande(0, selectiveStyles.length - .1)]),
        this.randColor = rande(2, 7.9),
        this.groupnr = 0,
        this.groupsize = rande(4, 10),
        this.gridColor = gridColor,
        5 == palette && 0 <= rainbow && (gridColor = colors[palette][Math.floor(2 + 5.9 * fxrand())])
    }
    guideLines()
    {
        gridLines.plot(this.plot, this.origin.x, this.origin.y, this.gridColor, .7)
    }
    distribute(e)
    {
        for (this.id = e, this.maxR = this.plot.length / this.separacion, this.prob = fxrand(), this.current = new Pos(this.origin.x + this.plot.adjust[0] * pixel, this.origin.y + this.plot.adjust[1] * pixel), this.k = 0; this.k < int(this.maxR); this.k++) {
            let e = this.plot.scale(this.current.plotted),
                s = this.plot.angle(this.current.plotted);
            if (0 > e && (s += 180, e *= -1), this.adjust = 1 == caffeine ? e * rand(1.2, 1.5) : e, 0 !== e)
                switch (this.weight = this.k <= this.maxR / 2 ? this.maxR - this.k / 2 + 1 : this.maxR - 2 * (this.maxR - this.k) + 1, this.area = parseInt(weightedRand({
                    0: pow(this.maxR, 2) / pow(this.k + 1, 3),
                    1: pow(this.maxR, 2) / pow(this.weight, 3),
                    2: pow(this.maxR, 2) / pow(this.maxR - this.k + 1, 3)
                })), this.area) {
                case 0:
                    this.obsession(1) && this.typeLines(typeDist[0], s - this.plot.dir);
                    break;
                case 1:
                    this.obsession(3) && this.typeLines(typeDist[1], s - this.plot.dir);
                    break;
                case 2:
                    this.obsession(4.5) && this.typeLines(typeDist[2], s - this.plot.dir);
                }
            1 == this.plot.border(this.current.plotted) && 0 == this.k % int(randomGaussian(5, 4)) && this.hull.push([this.current.x, this.current.y]),
            this.current.plotTo(this.plot, this.separacion)
        }
        let s = rande(0, this.hull.length);
        this.hull = this.hull.slice(s, this.hull.length).concat(this.hull.slice(0, s));
        for (let s of this.hull)
            this.bg.push(createVector(s[0], s[1]));
        this.bgLayers = watercolor.genMask(this.bg),
        this.length = this.elements.length
    }
    typeLines(e, s)
    {
        switch (this.brush = 1 == selective ? 4 == rande(0, 12.8) ? "spray" : this.globalBrush : 1 == compSel ? styles[rande(0, 7.5)] : styles[rande(0, 8.9)], e) {
        case 0:
            this.displace = rande(0, 4.9),
            this.lineColor = colors[palette][this.displace + rande(2, 3.5)],
            this.strokew = .8 * map(this.plot.doodleScale, 0, 3, .7, 1.2),
            "charcoal" == this.brush && (this.strokew = .7),
            0 !== rainbow && (this.lineColor = this.rainbow(this.id + 1));
            var a = [this.brush, this.current.x, this.current.y, .7 * (this.adjust * this.size) * rand(.8, 1.2), 90 + s, this.lineColor, this.strokew];
            break;
        case 1:
            this.displace = rande(0, 3.9),
            this.lineColor = colors[palette][this.displace + rande(2, 4.5)],
            this.strokew = 1 * map(this.plot.doodleScale, 0, 3, .8, 1.3),
            "charcoal" == this.brush && (this.strokew = .9),
            0 !== rainbow && (this.lineColor = this.rainbow(this.id + 1));
            var a = [this.brush, this.current.x, this.current.y, this.adjust * this.size * rand(.8, 1.2), 90 + s, this.lineColor, this.strokew];
            break;
        case 2:
            this.lineColor = colors[palette][rande(2, 7.9)],
            this.strokew = rand(1.2, 1.5) * map(this.plot.doodleScale, 0, 3, .7, 1.5),
            "charcoal" == this.brush && (this.strokew = 1),
            0 !== rainbow && (this.lineColor = this.rainbow(this.id + 1)),
            this.numRows = rande(2, 2 + 5.5 * this.k / this.maxR);
            var a = [this.brush, this.current.x, this.current.y, 1.3 * (this.adjust * this.size) * rand(.8, 1.2), 90 + s, this.lineColor, this.strokew];
        }
        this.current.isInCanvas() && this.prob < density && this.elements.push(a)
    }
    obsession(e)
    {
        return 0 === superOrder ? rande(0, this.k * rand(0, 3)) >= 10 * e : 1 === superOrder ? 0 == this.k % 2 : 2 === superOrder ? 0 == this.k % 3 : void 0
    }
    rainbow()
    {
        return 1 === rainbow ? (this.groupnr++, this.groupnr == this.groupsize && (this.groupnr = 0, this.randColor++, 7 < this.randColor && (this.randColor = 2)), colors[palette][this.randColor]) : 2 === rainbow ? colors[palette][Math.floor(map(this.id, 0, doodleNumber, 2, 7.9, !0))] : 3 === rainbow ? colors[palette][this.randColor] : void 0
    }
}
let bgTip,
    bgDir,
    bgDots,
    masks = [],
    bgHatch = [],
    bgBands = [],
    nrWC = 0,
    empty = ["no"],
    marcoMask = [],
    doneW = 0,
    doneH = 0;
class PaintBrush {
    constructor(e)
    {
        "watercolor" === e ? this.polygon = e => {
            for (this.v = [], this.m = [], this.i = 0; 8 > this.i; this.i++)
                this.a = 45 * this.i,
                this.v.push(createVector(cos(this.a + 45) * e, sin(this.a + 45) * e)),
                .8 > fxrand() ? this.m.push(.05) : this.m.push(rand(.3, .8))
        } : void 0
    }
    fill(e, s, a, l)
    {
        this.color = a,
        this.v = e,
        this.m = [];
        let n = rand(0, .4 * this.v.length);
        for (let t = 0; t < this.v.length; t++)
            t < n ? this.m.push(-(rand(.5, 1.1) * s)) : this.m.push(-(rand(.4, 1) * s / 3));
        this.tip = new Tip(this.v, this.m, this.color, this.calcCenter()),
        this.tip.fill(.015 * l, .019 * l)
    }
    bgBand(e, s, a)
    {
        this.color = a,
        this.v = e,
        this.m = [];
        for (let l = 0; 2 > l; l++) {
            for (let e = 0; e < (this.v.length - 2) / 2; e++)
                this.m.push(-s);
            this.m.push(-.1)
        }
        this.tip = new Tip(this.v, this.m, this.color, this.calcCenter()),
        this.tip.band(.012, .016)
    }
    stroke(e, s, a, l)
    {
        this.polygon(l),
        this.color = e,
        this.tip = new Tip(this.v, this.m, this.color, createVector(s, a), s, a),
        this.tip.stroke(.008, .004)
    }
    genMask(e, s)
    {
        if (this.v = e, !s) {
            this.m = [];
            let e = rand(0, .4 * this.v.length);
            for (i = 0; i < this.v.length; i++)
                i < e ? this.m.push(-(.3 * rand(.5, 1.1))) : this.m.push(.3 * rand(.5, 1.1))
        } else {
            this.m = [];
            for (let a of e)
                this.m.push(s)
        }
        return this.tip = new Tip(this.v, this.m, this.color, this.calcCenter()), this.tip.mask()
    }
    calcCenter()
    {
        let e = 0,
            s = 0;
        for (let a = 0; a < this.v.length; ++a)
            e += this.v[a].x,
            s += this.v[a].y;
        return e /= this.v.length, s /= this.v.length, createVector(e, s)
    }
}
class BgBrush {
    constructor(e, s)
    {
        this.position = new Pos(e, s),
        this.angle = 0,
        this.tip = new PaintBrush("watercolor"),
        this.c = 0
    }
    isXIn()
    {
        return this.position.x < w2Active && this.position.x > w1Active
    }
    isYIn()
    {
        return this.position.y > h1Active && this.position.y < h2Active
    }
    move(e, s)
    {
        this.size = s,
        this.isXIn() && this.isYIn() ? this.position.moveTo(.2 * this.size * e, noise(frameCount) * this.angle) : (this.position = new Pos(rand(w1Active, .4 * widthW), rand(h1Active, .9 * h2Active)), this.angle = rande(-50, 50), this.c = abs(this.c - 1))
    }
    paint(e)
    {
        this.tip.stroke(bgColors[this.c], this.position.x, this.position.y, this.size * e * pixel)
    }
}
class BgHatch {
    constructor(e, s, a)
    {
        this.position = new Pos(e, s),
        this.angle = a,
        this.tip = new LineStyle("2H"),
        this.count = 0,
        this.finished = !1,
        this.inclin = parseInt(weightedRand({
            45: 50,
            0: 10,
            90: 10,
            315: 5
        }))
    }
    isIn()
    {
        return this.position.x <= w2Active && this.position.x >= w1Active && this.position.y >= h1Active && this.position.y <= h2Active
    }
    move()
    {
        this.isIn() && this.position.moveTo(5, this.angle)
    }
    draw()
    {
        20 > this.count && this.tip.line(this.position.x, this.position.y, 5 * pixel, this.inclin, bgPalettes[palette][3], .5),
        !this.isIn() && 20 > this.count ? this.count++ : 20 == this.count && (this.finished = !0)
    }
}
class Tip {
    constructor(e, s, a, l, n, t)
    {
        this.vertices = e,
        this.modifiers = s,
        this.color = a,
        n || (n = 0),
        t || (t = 0),
        this.x = n,
        this.y = t,
        this.midP = l,
        this.size = p5.Vector.sub(this.midP, this.vertices[0]).mag()
    }
    grow(e)
    {
        const s = [],
            a = [];
        var l = this.vertices.length;
        .2 <= e && (l = int(e * this.vertices.length));
        for (let n = 0; n < l; n++) {
            const t = (n + 1) % l,
                p = this.vertices[n],
                r = this.vertices[t];
            let u = this.modifiers[n];
            n == l - 1 && .2 <= e && (u = -1);
            const h = e => e + .1 * (randomGaussian(.5, .1) - .5);
            s.push(p),
            a.push(h(u));
            const g = p5.Vector.sub(r, p),
                d = g.mag();
            g.mult(randomGaussian(.5, .2));
            const c = p5.Vector.add(g, p);
            g.rotate(-90 + 45 * randomGaussian(0, .4)),
            g.setMag(randomGaussian(.5, .2) * rand(.6, 1.4) * d * u),
            c.add(g),
            s.push(c),
            a.push(h(u))
        }
        return new Tip(s, a, this.color, this.midP, this.x, this.y)
    }
    layer(e)
    {
        maskBuffer.push(),
        maskBuffer.fill(0, 255, 0),
        maskBuffer.stroke(255, 0, 0),
        maskBuffer.strokeWeight(1.5 * map(e, 0, 12, 0, 5) * pixel),
        maskBuffer.beginShape();
        for (let s of this.vertices)
            maskBuffer.vertex(s.x + this.x, s.y + this.y);
        maskBuffer.endShape(CLOSE),
        maskBuffer.noFill(0, 255, 0),
        maskBuffer.strokeWeight(2 * pixel),
        maskBuffer.beginShape();
        for (let s of this.vertices)
            maskBuffer.vertex(s.x + this.x, s.y + this.y);
        maskBuffer.endShape(CLOSE),
        maskBuffer.noStroke(),
        maskBuffer.pop()
    }
    subtlelayer()
    {
        maskBuffer.fill(0, 255, 0),
        maskBuffer.noStroke(),
        maskBuffer.beginShape();
        for (let e of this.vertices)
            maskBuffer.vertex(e.x + this.x, e.y + this.y);
        maskBuffer.endShape(CLOSE)
    }
    texture(e)
    {
        maskBuffer.fill(0, 0, 255, e),
        maskBuffer.strokeWeight(2 * pixel),
        maskBuffer.beginShape();
        for (let s of this.vertices)
            maskBuffer.vertex(s.x + this.x, s.y + this.y);
        maskBuffer.endShape(CLOSE)
    }
    erase(e)
    {
        for (maskBuffer.erase(e), i = 0; i < rande(65, 95); i++)
            maskBuffer.ellipse(this.midP.x + 1.3 * rand(-this.size, this.size), this.midP.y + 1.3 * rand(-this.size, this.size), rand(.02, .2) * this.size * pixel);
        maskBuffer.noErase()
    }
    fill(e, s)
    {
        let a = this.grow(),
            n = this.grow(.4),
            t = n.grow().grow().grow(.3);
        const p = 10;
        let r = 0;
        for (let l = 0; l < p; l++)
            (l == int(p / 4) || l == int(5) || l == int(30 / 4)) && (a = a.grow(), n = n.grow(), t = t.grow()),
            maskBuffer.push(),
            a.grow().grow().grow().layer(l),
            n.grow().grow().grow().grow().texture(60),
            t.grow().grow().grow().grow().texture(140),
            n.grow().grow().grow().erase(180),
            0 == l % 3 && (r = int(l / 3)),
            this.noPaint(r, 0),
            maskBuffer.pop(),
            paintColor(this.color, map(l, 0, p, s, e), "spot", this.vertices[rande(0, this.vertices.length)], 2 * this.size)
    }
    band(e, s)
    {
        let a = this.grow(),
            l = this.grow(.7);
        const n = 4;
        for (let t = 0; t < n; t++)
            2 == t && (a = a.grow(), l = l.grow()),
            maskBuffer.push(),
            a.grow().grow().grow().layer(t),
            l.grow().grow().grow().grow().texture(100),
            a.grow().grow().grow().erase(100),
            this.noPaint(t, 0),
            maskBuffer.pop(),
            paintColor(this.color, map(t, 0, n, s, e), "spot", this.vertices[rande(0, this.vertices.length)], 2 * this.size)
    }
    stroke(e, s)
    {
        let a = this.grow(0);
        const l = 4;
        for (let n = 0; n < l; n++)
            2 == n && (a = a.grow()),
            maskBuffer.push(),
            a.grow().grow().grow().subtlelayer(n),
            a.grow().grow().grow().erase(100),
            this.noPaint(n),
            maskBuffer.pop(),
            paintColor(this.color, map(n, 0, l, s, e), "simple")
    }
    mask()
    {
        let e = this.grow();
        this.dMask = [];
        for (let s = 0; s < 4; s++)
            2 == s && (e = e.grow().grow()),
            this.dMask.push(e.grow().grow().grow().vertices);
        return this.dMask
    }
    noPaint(e, s)
    {
        maskBuffer.erase();
        for (let a of doodles) {
            let s = movement.opacity;
            if (1 == compSel && .45 > fxrand() && 0 == a.length && (s = .1), fxrand() < s) {
                maskBuffer.beginShape();
                for (let s of a.bgLayers[e])
                    maskBuffer.vertex(s.x, s.y);
                maskBuffer.endShape(CLOSE)
            }
        }
        if (0 !== s)
            for (let s of borderMask) {
                maskBuffer.beginShape();
                for (let a of s[e])
                    maskBuffer.vertex(a.x, a.y);
                maskBuffer.endShape(CLOSE)
            }
        for (let a of marcoMask) {
            maskBuffer.beginShape();
            for (let s of a[e])
                maskBuffer.vertex(s.x, s.y);
            maskBuffer.endShape(CLOSE)
        }
        maskBuffer.noErase()
    }
}
let hatchFinished = [!1];
function createHatch() {
    let e = w1Active,
        s = 1 - parseInt(weightedRand({
            0: 50,
            2: 50
        })),
        a = rande(25, 45);
    .5 > fxrand() && (e = w2Active, a += 180);
    let l = rande(15, 35);
    for (i = 0; i < l; i++)
        bgHatch.push(new BgHatch(e, h1Active + i * ((h2Active - h1Active) / l), s * a));
    if (.4 >= fxrand() || 4 == palette) {
        let s = rande(110, 150);
        .5 > fxrand() && (e = h1Active, s += 180);
        for (j = 0; j < .75 * l; j++)
            bgHatch.push(new BgHatch(w1Active + j * ((w2Active - w1Active) / (.75 * l)), h2Active, 150))
    }
}
let hBG = 0;
function hatchBG() {
    hatchBuffer = createGraphics(widthW, heightW),
    hatchBuffer.pixelDensity(pDensity);
    let e = color(bgPalettes[palette][4]),
        s = 4e5;
    for ((4 <= palette || 1 !== mvtSel) && (s = 8e4), i = 0; i < s; i++)
        e.setAlpha(int(randomGaussian(100, 50))),
        maskBuffer.fill(e),
        maskBuffer.noStroke(),
        maskBuffer.circle(rand(0, widthW), rand(0, heightW), rand(.3, 1.2) * pixel)
}
function hatchFill(e) {
    hatchBuffer.push(),
    hatchBuffer.fill(0, 0, 0, 0),
    hatchBuffer.noStroke(),
    hatchBuffer.beginShape();
    for (let s of e.bgLayers[3])
        hatchBuffer.vertex(s.x, s.y);
    hatchBuffer.endShape(CLOSE),
    hatchBuffer.drawingContext.clip(),
    hatchBuffer.image(maskBuffer, 0, 0),
    hatchBuffer.pop(),
    image(hatchBuffer, 0, 0, widthW, heightW),
    hatchBuffer.clear()
}
function createBands() {
    let e = (h2Active - h1Active) / 30;
    for (m = 0; 30 > m; m++) {
        let s = [],
            a = rande(1, 7.9),
            l = rand(.05, .12);
        for ((2 > m || 28 < m) && (l = rand(.05, .065)), s.push(createVector(w1Active, h1Active + m * e)), o = 1; o <= a; o++)
            s.push(createVector(w1Active + o * (w2Active - w1Active) / a, h1Active + m * e));
        for (s.push(createVector(w2Active, h1Active + m * e)), s.push(createVector(w2Active, h1Active + e + m * e)), o = 1; o <= a; o++)
            s.push(createVector(w2Active - o * (w2Active - w1Active) / a, h1Active + e + m * e));
        s.push(createVector(w1Active, h1Active + e + m * e)),
        1 == mvtSel && 4 == palette ? bgBands.push([s, l, bgColors[1]]) : bgBands.push([s, l, bgColors[parseInt(weightedRand({
            0: 40,
            1: 30 + 25 * mvtSel
        }))]])
    }
}
class BgDots {
    constructor(e)
    {
        for (this.bgDots = [], column = 0; column < num_columns / 2; column++)
            for (row = 0; row < num_rows / 2; row++) {
                let s = new Pos(2 * ((right_x - left_x) / num_columns * column), 2 * ((bottom_y - top_y) / num_rows * row));
                if (s.angle() >= rande(e, 2 * e) || s.angle() <= -rande(e, 2 * e))
                    for (i = 0; i < rande(2, 5); i++)
                        s.moveTo(3, 45),
                        this.bgDots.push([s.x, s.y])
            }
        this.bgDots = shuffle(this.bgDots),
        this.i = 0
    }
    draw()
    {
        push(),
        fill(bgPalettes[palette][3]),
        noStroke();
        for (let e = 0; 15 > e; e++)
            this.i + e < this.bgDots.length && circle(this.bgDots[this.i + e][0], this.bgDots[this.i + e][1], 1 * pixel, 1 * pixel);
        pop(),
        this.i += 15
    }
}
let marco;
0 === compSel ? marco = 30 * pixel : 1 === compSel ? marco = 25 * pixel : 2 === compSel ? marco = 40 * pixel : void 0;
function borderMasks() {
    borderMask.push(watercolor.genMask(vertRect([w1Active / 2 - .2 * widthW / 2, heightW / 2], w1Active + .2 * widthW, heightW, 8), .06)),
    borderMask.push(watercolor.genMask(vertRect([w2Active / 2 + 1.2 * widthW / 2, heightW / 2], w1Active + .2 * widthW, heightW, 8), .06)),
    borderMask.push(watercolor.genMask(vertRect([widthW / 2, h1Active / 2 - .2 * heightW / 2], widthW, h1Active + .2 * heightW, 8), .06)),
    borderMask.push(watercolor.genMask(vertRect([widthW / 2, h2Active / 2 + 1.2 * heightW / 2], widthW, h1Active + .2 * heightW, 8), .06)),
    2 == mvtSel && 0 !== parseFloat(marg) && (console.log("WHY?"), marcoMask.push(watercolor.genMask(vertRect([(w1Active + marco) / 2, (h1Active + marco) / 2], w1Active + marco, h1Active + marco, 8), .2)), marcoMask.push(watercolor.genMask(vertRect([(w1Active + marco) / 2, heightW - (h1Active + marco) / 2], w1Active + marco, h1Active + marco, 8), .2)), marcoMask.push(watercolor.genMask(vertRect([widthW - (w1Active + marco) / 2, (h1Active + marco) / 2], w1Active + marco, h1Active + marco, 8), .2)), marcoMask.push(watercolor.genMask(vertRect([widthW - (w1Active + marco) / 2, heightW - (h1Active + marco) / 2], w1Active + marco, h1Active + marco, 8), .2)))
}
function vertRect(e, s, a, l) {
    let n = [createVector(e[0] - s / 2, e[1] - a / 2)],
        t = int(rand(.5, 1) * l);
    for (i = 1; i <= t; i++)
        n.push(createVector(e[0] - s / 2, e[1] - a / 2 + i * a / t));
    for (t = int(rand(.5, 1) * l), i = 1; i <= t; i++)
        n.push(createVector(e[0] - s / 2 + i * s / t, e[1] + a / 2));
    for (t = int(rand(.5, 1) * l), i = 1; i <= t; i++)
        n.push(createVector(e[0] + s / 2, e[1] + a / 2 - i * a / t));
    for (t = int(rand(.5, 1) * l), i = 1; i < t; i++)
        n.push(createVector(e[0] + s / 2 - i * s / t, e[1] - a / 2));
    return n
}
function drawBorder() {
    2 !== mvtSel || 0 == marg ? (borderLines.line(w1Active - 3 * pixel, h1Active, w2Active + 3 * pixel, h1Active, colors[palette][2], .6, "straight"), borderLines.line(w1Active, h1Active - 3 * pixel, w1Active, h2Active + 3 * pixel, colors[palette][2], .6, "straight"), borderLines.line(w2Active, h1Active - 3 * pixel, w2Active, h2Active + 3 * pixel, colors[palette][2], .6, "straight"), borderLines.line(w1Active - 3 * pixel, h2Active, w2Active + 3 * pixel, h2Active, colors[palette][2], .6, "straight")) : (borderLines.line(w1Active - 3 * pixel + marco, h1Active, w2Active + 3 * pixel - marco, h1Active, colors[palette][2], .6, "straight"), borderLines.line(w1Active, h1Active - 3 * pixel + marco, w1Active, h2Active + 3 * pixel - marco, colors[palette][2], .6, "straight"), borderLines.line(w2Active, h1Active - 3 * pixel + marco, w2Active, h2Active + 3 * pixel - marco, colors[palette][2], .6, "straight"), borderLines.line(w1Active - 3 * pixel + marco, h2Active, w2Active + 3 * pixel - marco, h2Active, colors[palette][2], .6, "straight"), borderLines.line(w1Active, h1Active + marco, w1Active + marco, h1Active + marco, colors[palette][2], .6, "straight"), borderLines.line(w2Active - marco, h1Active + marco, w2Active, h1Active + marco, colors[palette][2], .6, "straight"), borderLines.line(w1Active, h2Active - marco, w1Active + marco, h2Active - marco, colors[palette][2], .6, "straight"), borderLines.line(w2Active - marco, h2Active - marco, w2Active, h2Active - marco, colors[palette][2], .6, "straight"), borderLines.line(w1Active + marco, h1Active, w1Active + marco, h1Active + marco, colors[palette][2], .6, "straight"), borderLines.line(w2Active - marco, h1Active, w2Active - marco, h1Active + marco, colors[palette][2], .6, "straight"), borderLines.line(w1Active + marco, h2Active, w1Active + marco, h2Active - marco, colors[palette][2], .6, "straight"), borderLines.line(w2Active - marco, h2Active, w2Active - marco, h2Active - marco, colors[palette][2], .6, "straight"))
}
function star(e, s, a) {
    for (let l = 0; 8 > l; l++)
        stars.line(e, s, a * pixel, 45 * l, bgPalettes[palette][3], 1.5)
}
let watercolor = new PaintBrush("watercolor");
let soundFile,
    myFont,
    mode,
    nrmode,
    nrmodeE,
    nrmodeO,
    track,
    noteVelocity,
    notePitch,
    piece,
    selected,
    soundJSON,
    reverb,
    noteDone = 0,
    noteParDone = 0,
    noteImparDone = 0,
    strokeID = 0,
    strokesEven_ID = 0,
    strokesOdd_ID = 0,
    firstNoteColor = Math.floor(2 + 5.9 * fxrand()),
    noteColors = createNCarray(firstNoteColor);
function preload() {}
let notesTrackE,
    notesTrackO,
    currentDoodle = 0,
    currentDoodleEven = 0,
    currentDoodleOdd = 1,
    lyricDone = 0;
used = [0, 0];
function writeLyrics(e, s, a) {
    if (0 == pianoPlayer && (adjustement = .9), lyricDone < lyrics.length && lyrics[lyricDone][0 + pianoPlayer] - 0 < e) {
        if ("partiture" == ffType || "tilted" == ffType) {
            push(),
            noStroke(),
            textSize(7 * pixel),
            textAlign(LEFT, CENTER),
            textFont(myFont),
            fill(colors[palette][2]);
            var l = s;
            if (s <= 10 * pixel)
                var l = 10 * pixel;
            var n = a + 17 * pixel - lyrics[lyricDone][3] * pixel;
            l <= used[0] && n == used[1] && (l = used[0]);
            var t = l + textWidth(lyrics[lyricDone][2]) + 8 * pixel;
            t <= height - 10 * pixel && (text(lyrics[lyricDone][2], l, n), used = [t, n]),
            pop()
        }
        console.log(lyrics[lyricDone][2]),
        lyricDone++
    }
}
let lyrics = [[0, 1.5, "I. Le Chant Guerrier Du Roi Des Haricots", 9], [1.3, 3.4, "Quel roi jovial !", 0], [4.4, 7.25, "Sa figure est toute rouge.", 0], [7.75, 10.25, "Il sait danser lui-m\xEAme.", 0], [11, 13.6, "Son nez est couvert de poils.", 0], [14.25, 17.1, "Il se tape sur le ventre.", 0], [20.8, 24, "Quand il rit, il en a pour une heure.", 0], [24.2, 27.4, "Quel bon roi !", 0], [27.2, 31, "C'est un grand guerrier.", 0], [31, 34.7, "Il faut le voir \xE0 cheval.", 0], [34.3, 38.16, "Il porte un chapeau rouge.", 0], [37.2, 41.1, "Son cheval sait danser lui-m\xEAme.", 0], [43.6, 48, "Il donne des fortes claques \xE0 son cheval.", 0], [50.16, 54.8, "C'est un brave cheval !", 0], [53.5, 58.25, "Aussi aime-t-il la guerre et les boulets.", 0], [59.75, 65, "Quel beau cheval !", 0], [60, 67, "", 0], [66, 70, "II. Ce Que Dit La Petite Princesse Des Tulipes", 9], [66.3, 73.2, "J'aime beaucoup la soupe aux choux,", 0], [76.5, 83.7, "Mais j'aime encore mieux ma petite maman.", 0], [86.7, 94.5, "Parlons bas, car ma poup\xE9e a mal \xE0 la t\xEAte :", 0], [95.2, 103.7, "Elle est tomb\xE9e du 3e \xE9tage.", 0], [100.4, 109.7, "Le docteur dit que ce n'est rien.", 0], [102, 112, "", 0], [107.5, 116, "III. Valse Du Chocolat Aux Amandes", 9], [108, 120, "Tu vas en avoir un peu.", 0], [118.3, 130.2, "Tu aimes le chocolat ?", 0], [121.75, 133.64, "Laisse-le fondre dans la bouche.", 0], [128.4, 140.5, "Maman, il y a un os.", 0], [131.5, 143.75, "Non, mon petit : c'est une amande.", 0], [137.2, 159.2, "Le petit gar\xE7on veut manger toute la bo\xEEte.", 0], [144, 156, "Comme il est gourmand !", 0], [150.7, 162.8, "Sa maman lui refuse doucement :\nil ne faut pas qu'il se rende malade.", 0], [159.1, 171.4, "Horreur : il tr\xE9pigne de col\xE8re.", 0]],
    midiMaxMin = [999, 0],
    velMaxMin = [999, 0],
    durMaxMin = [999, 0];
function MinMax() {
    for (i = 0; 2 > i; i++)
        for (j = 0; j < soundJSON.tracks[i].notes.length; j++)
            midiMaxMin = [Math.min(soundJSON.tracks[i].notes[j].midi, midiMaxMin[0]), Math.max(soundJSON.tracks[i].notes[j].midi, midiMaxMin[1])],
            velMaxMin = [Math.min(soundJSON.tracks[i].notes[j].velocity, velMaxMin[0]), Math.max(soundJSON.tracks[i].notes[j].velocity, velMaxMin[1])],
            durMaxMin = [Math.min(soundJSON.tracks[i].notes[j].duration, durMaxMin[0]), Math.max(soundJSON.tracks[i].notes[j].duration, durMaxMin[1])]
}
