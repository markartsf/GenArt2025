// Scene 7 — LIFE: three-group boid flocking with distinct colours, weights & motion
// Group A (warm[0] — orange):  thick trails, slower, loose cohesion  → "elders"
// Group B (warm[1] — gold):    medium trails, balanced                → "main flock"
// Group C (paper  — cream):    thin hairline trails, fast, tight      → "scouts"
// Audio: bass scatters, mid aligns, high clusters. Beat = radial burst.
window.Ember = window.Ember || {};

Ember.Scene7 = (function() {
  const TWO_PI = Math.PI * 2;

  // ─── Vec2 ────────────────────────────────────────────────────────────────
  class Vec2 {
    constructor(x=0,y=0){this.x=x;this.y=y;}
    static random(s=1){const a=Math.random()*TWO_PI;return new Vec2(Math.cos(a)*s,Math.sin(a)*s);}
    clone(){return new Vec2(this.x,this.y);}
    add(v){this.x+=v.x;this.y+=v.y;return this;}
    sub(v){this.x-=v.x;this.y-=v.y;return this;}
    mult(s){this.x*=s;this.y*=s;return this;}
    sclAdd(v,s){this.x+=v.x*s;this.y+=v.y*s;return this;}
    zero(){this.x=0;this.y=0;return this;}
    sqrMag(){return this.x*this.x+this.y*this.y;}
    mag(){return Math.hypot(this.x,this.y);}
    angle(){return Math.atan2(this.y,this.x);}
    sqrDist(v){const dx=this.x-v.x,dy=this.y-v.y;return dx*dx+dy*dy;}
    setMag(s){const m=this.sqrMag();if(m>0){const f=s/Math.sqrt(m);this.x*=f;this.y*=f;}return this;}
    limit(max){if(this.sqrMag()>max*max)this.setMag(max);return this;}
    min(s){if(this.sqrMag()<s*s)this.setMag(s);return this;}
    rotate(a){const c=Math.cos(a),s=Math.sin(a),rx=this.x*c-this.y*s;this.y=this.x*s+this.y*c;this.x=rx;return this;}
    div(s){if(s!==0){this.x/=s;this.y/=s;}return this;}
  }

  // ─── Spatial grid ────────────────────────────────────────────────────────
  class SpatialGrid {
    constructor(w,h,cell){
      this.cell=cell;
      this.cols=Math.ceil(w/cell);
      this.rows=Math.ceil(h/cell);
      this.buckets=new Array(this.cols*this.rows);
    }
    clear(){this.buckets.fill(null);}
    resize(w,h,cell){
      this.cell=cell;this.cols=Math.ceil(w/cell);this.rows=Math.ceil(h/cell);
      this.buckets=new Array(this.cols*this.rows);
    }
    insert(b){
      const c=Math.floor(b.pos.x/this.cell),r=Math.floor(b.pos.y/this.cell);
      const idx=r*this.cols+c;
      if(idx>=0&&idx<this.buckets.length){
        if(!this.buckets[idx])this.buckets[idx]=[];
        this.buckets[idx].push(b);
      }
    }
    neighbors(b,radius){
      const res=[],sqR=radius*radius;
      const c=Math.floor(b.pos.x/this.cell),r=Math.floor(b.pos.y/this.cell);
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        const nr=r+dr,nc=c+dc;
        if(nr<0||nr>=this.rows||nc<0||nc>=this.cols)continue;
        const bucket=this.buckets[nr*this.cols+nc];
        if(!bucket)continue;
        for(const o of bucket){
          if(o!==b){const d=b.pos.sqrDist(o.pos);if(d<sqR)res.push({boid:o,sqDist:d});}}
      }
      return res;
    }
  }

  // ─── Group definitions ───────────────────────────────────────────────────
  // count, maxSpeed, maxForce, trailLen, lineWidth, alignW, cohesionW, sepW, vision, colorKey
  const GROUPS = [
    { count:110, maxSpeed:2.8, maxForce:0.14, trailLen:14, lineWidth:2.4, alignW:0.9, cohesionW:0.8, sepW:1.4, vision:70, colorKey:'warm0' },
    { count:100, maxSpeed:4.0, maxForce:0.20, trailLen: 9, lineWidth:1.3, alignW:1.2, cohesionW:1.0, sepW:1.1, vision:58, colorKey:'warm1' },
    { count: 80, maxSpeed:6.0, maxForce:0.30, trailLen: 5, lineWidth:0.5, alignW:1.5, cohesionW:1.4, sepW:0.9, vision:44, colorKey:'paper' },
  ];

  function getColor(pal, key) {
    if (key === 'warm0') return pal.warm[0];
    if (key === 'warm1') return pal.warm[1];
    return pal.paper;
  }

  // ─── State ───────────────────────────────────────────────────────────────
  let canvas, ctx;
  let raf=0, running=false;
  let groups=[];  // array of { boids[], grid, def }
  let sBass=0,sMid=0,sHigh=0,sRMS=0,prevRMS=0,beatFlash=0,beatCooldown=0;

  function resize(){
    ctx = Ember.sizeCanvas(canvas, '2d');
    groups.forEach(g => {
      if (g.grid) g.grid.resize(window.innerWidth, window.innerHeight, g.def.vision);
    });
  }

  function init(){
    canvas = document.getElementById('c7');
    resize();
    Ember.onResize(resize);
  }

  function spawnGroups(){
    const w=window.innerWidth, h=window.innerHeight;
    groups = GROUPS.map(def => {
      const boids = [];
      for (let i=0;i<def.count;i++){
        boids.push({
          pos: new Vec2(Math.random()*w, Math.random()*h),
          vel: Vec2.random(def.maxSpeed * (0.4+Math.random()*0.6)),
          acc: new Vec2(),
          trail: [],
          group: def,
        });
      }
      return { boids, grid: new SpatialGrid(w,h,def.vision), def };
    });
  }

  function start(){
    running=true;
    sBass=sMid=sHigh=sRMS=prevRMS=beatFlash=beatCooldown=0;
    spawnGroups();
    const pal=Ember.palettes[Ember.state.palette];
    const n=parseInt(pal.bg[0].replace('#',''),16);
    ctx.fillStyle=`rgb(${(n>>16)&255},${(n>>8)&255},${n&255})`;
    ctx.fillRect(0,0,window.innerWidth,window.innerHeight);
    loop();
  }
  function stop(){ running=false; cancelAnimationFrame(raf); }
  function loop(){ if(!running)return; raf=requestAnimationFrame(loop); draw(); }

  function hexAlpha(hex,a){
    const n=parseInt(hex.replace('#',''),16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  function draw(){
    const w=window.innerWidth, h=window.innerHeight;
    const pal=Ember.palettes[Ember.state.palette];

    // Audio
    const bands=Ember.Audio.getBands();
    const rms=Ember.Audio.getLevel();
    const α=0.2;
    sBass+=α*(bands.low-sBass);
    sMid +=α*(bands.mid-sMid);
    sHigh+=α*(bands.high-sHigh);
    sRMS +=α*(rms-sRMS);
    const rmsDelta=rms-prevRMS; prevRMS=rms;
    if(beatCooldown>0)beatCooldown--;
    if(rmsDelta>0.055&&beatCooldown===0){beatFlash=1;beatCooldown=14;}
    beatFlash*=0.88;

    // Background
    const bgN=parseInt(pal.bg[0].replace('#',''),16);
    ctx.fillStyle=`rgba(${(bgN>>16)&255},${(bgN>>8)&255},${bgN&255},${0.12+beatFlash*0.25})`;
    ctx.fillRect(0,0,w,h);

    // Per-group audio weights — each group responds differently
    const groupAudio = [
      // Group A (elders): driven by bass
      { sep:1.4+sBass*5, align:0.9+sMid*2, coh:0.8+sHigh*3, speed:2.8*(1+sRMS*1.2)*Ember.state.tempo, noise:0.01+sBass*0.08 },
      // Group B (main):   balanced
      { sep:1.1+sBass*3.5, align:1.2+sMid*3, coh:1.0+sHigh*4, speed:4.0*(1+sRMS*1.8)*Ember.state.tempo, noise:0.02+sMid*0.06 },
      // Group C (scouts): driven by high freq
      { sep:0.9+sBass*2, align:1.5+sMid*2.5, coh:1.4+sHigh*6, speed:6.0*(1+sRMS*2.5)*Ember.state.tempo, noise:0.03+sHigh*0.12 },
    ];

    for (let gi=0;gi<groups.length;gi++){
      const {boids, grid, def} = groups[gi];
      const ga = groupAudio[gi];
      const dynVision = def.vision*(1+sBass*0.4);
      const dynForce  = def.maxForce*(1+sRMS*1.5);

      if(Math.ceil(dynVision)!==grid.cell)
        grid.resize(w,h,Math.max(28,Math.ceil(dynVision)));

      grid.clear();
      for(const b of boids) grid.insert(b);

      for(const boid of boids){
        boid.acc.zero();
        const ns=grid.neighbors(boid,dynVision);
        if(ns.length>0){
          const aln=new Vec2(),csn=new Vec2(),sep=new Vec2();
          for(const {boid:o,sqDist:d} of ns){
            aln.add(o.vel); csn.add(o.pos);
            const inv=1/(d||0.00001);
            sep.x+=(boid.pos.x-o.pos.x)*inv;
            sep.y+=(boid.pos.y-o.pos.y)*inv;
          }
          aln.setMag(ga.speed).sub(boid.vel).limit(dynForce);
          csn.div(ns.length).sub(boid.pos).setMag(ga.speed).sub(boid.vel).limit(dynForce);
          sep.setMag(ga.speed).sub(boid.vel).limit(dynForce);
          boid.acc.sclAdd(aln,ga.align).sclAdd(csn,ga.coh).sclAdd(sep,ga.sep);
        }
        // Beat explosion
        if(beatFlash>0.1){
          const cx=w/2,cy=h/2,dx=boid.pos.x-cx,dy=boid.pos.y-cy;
          const d2=dx*dx+dy*dy||1;
          boid.acc.sclAdd(new Vec2(dx,dy).setMag(beatFlash*650/Math.sqrt(d2)),1);
        }
        boid.vel.add(boid.acc).mult(0.994);
        if(ga.noise>0)boid.vel.rotate((Math.random()-0.5)*ga.noise);
        boid.vel.min(0.8).limit(ga.speed);
        boid.pos.add(boid.vel);
        boid.pos.x=((boid.pos.x%w)+w)%w;
        boid.pos.y=((boid.pos.y%h)+h)%h;
        boid.trail.push(boid.pos.clone());
        const trailLen=def.trailLen+Math.floor(sRMS*18);
        if(boid.trail.length>trailLen)boid.trail.splice(0,boid.trail.length-trailLen);
      }
    }

    // Draw — each group with its own colour and line style
    for(let gi=0;gi<groups.length;gi++){
      const {boids,def}=groups[gi];
      const col=getColor(pal,def.colorKey);
      // Group-specific brightness driven by its "lead" band
      const bright = gi===0 ? 0.5+sBass*0.5 : gi===1 ? 0.5+sMid*0.5 : 0.45+sHigh*0.55;

      for(const boid of boids){
        const speed=boid.vel.mag();
        const speedN=Math.min(speed/(def.maxSpeed*1.2),1);
        const angle=boid.vel.angle();

        // Trail — distinct line width per group
        if(boid.trail.length>1){
          ctx.beginPath();
          ctx.moveTo(boid.trail[0].x,boid.trail[0].y);
          for(let i=1;i<boid.trail.length;i++){
            const dx=boid.trail[i].x-boid.trail[i-1].x;
            const dy=boid.trail[i].y-boid.trail[i-1].y;
            if(dx*dx+dy*dy>10000)ctx.moveTo(boid.trail[i].x,boid.trail[i].y);
            else ctx.lineTo(boid.trail[i].x,boid.trail[i].y);
          }
          // Group A: thick warm trails; Group B: medium; Group C: fine hairlines
          const trailW = gi===0
            ? def.lineWidth*(1+sBass*2.5)
            : gi===1
            ? def.lineWidth*(1+sMid*1.5)
            : def.lineWidth*(1+sHigh*1.2);

          ctx.strokeStyle=hexAlpha(col,(0.18+sRMS*0.25)*bright);
          ctx.lineWidth=trailW;
          ctx.lineCap='round';
          ctx.stroke();
        }

        // Body — triangle, size varies by group
        const size=gi===0 ? 3+sBass*4 : gi===1 ? 2.2+sMid*2.5 : 1.5+sHigh*1.8+speedN*1.5;
        ctx.save();
        ctx.translate(boid.pos.x,boid.pos.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(size,0);
        ctx.lineTo(-size*0.7,-size*0.5);
        ctx.lineTo(-size*0.5,0);
        ctx.lineTo(-size*0.7,size*0.5);
        ctx.closePath();
        ctx.fillStyle=hexAlpha(col,0.65+beatFlash*0.25);
        ctx.fill();
        ctx.restore();
      }
    }

    // Beat radial lines — replaces the plain glow, one coloured line per palette slot
    if(beatFlash>0.08){
      const cx=w/2,cy=h/2;
      const lineColors=[pal.warm[0],pal.warm[1],pal.paper];
      const nLines=12;
      for(let i=0;i<nLines;i++){
        const angle=(i/nLines)*Math.PI*2;
        const len=(80+Math.random()*200)*beatFlash;
        const col=lineColors[i%lineColors.length];
        ctx.save();
        ctx.strokeStyle=hexAlpha(col,beatFlash*0.6);
        ctx.lineWidth=0.5+beatFlash*2.5*(1+(i%3)*0.5);
        ctx.shadowBlur=6+beatFlash*14;
        ctx.shadowColor=hexAlpha(col,0.5);
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        ctx.lineTo(cx+Math.cos(angle)*len,cy+Math.sin(angle)*len);
        ctx.stroke();
        ctx.restore();
      }
      ctx.shadowBlur=0;
    }
  }

  return { init, start, stop };
})();
