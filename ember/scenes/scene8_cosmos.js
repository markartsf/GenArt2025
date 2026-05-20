// Scene 8 — COSMOS: spiral galaxy, palette-coloured, audio-reactive
// Simplified from spiral-galaxy.js — no aesthetic system, pure Ember palette.
// Bass drives core pulse, mid drives rotation/growth speed, high adds shimmer.
window.Ember = window.Ember || {};

Ember.Scene8 = (function() {
  // Colour slots per octave arm (index into palette arrays)
  // 8 arms → cycle through warm[0..3] and paper
  const ARM_COLS = [
    p => p.warm[2],
    p => p.warm[0],
    p => p.warm[1],
    p => p.paper,
    p => p.warm[0],
    p => p.warm[2],
    p => p.warm[1],
    p => p.paper,
  ];

  let canvas, ctx;
  let raf=0, running=false;
  let spiralArms=[];   // 8 arrays of points
  let globalRot=0, radiusGrowth=0, t0=0;
  let sBass=0, sMid=0, sHigh=0, sRMS=0;

  function resize(){
    ctx = Ember.sizeCanvas(canvas, '2d');
  }

  function init(){
    canvas = document.getElementById('c8');
    resize();
    Ember.onResize(resize);
  }

  function start(){
    running=true;
    t0=performance.now();
    spiralArms=Array.from({length:8},()=>[]);
    globalRot=0; radiusGrowth=0;
    sBass=sMid=sHigh=sRMS=0;
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
    const t=(performance.now()-t0)/1000*Ember.state.tempo;
    const pal=Ember.palettes[Ember.state.palette];

    // Audio
    const bands=Ember.Audio.getBands();
    const rms=Ember.Audio.getLevel();
    const α=0.18;
    sBass+=α*(bands.low-sBass);
    sMid +=α*(bands.mid-sMid);
    sHigh+=α*(bands.high-sHigh);
    sRMS +=α*(rms-sRMS);

    // Background fade
    const bgN=parseInt(pal.bg[1].replace('#',''),16);
    ctx.fillStyle=`rgba(${(bgN>>16)&255},${(bgN>>8)&255},${bgN&255},0.06)`;
    ctx.fillRect(0,0,w,h);

    // Rotation & growth driven by audio
    const rotSpeed  = (0.004 + sMid*0.018 + sRMS*0.01) * Ember.state.tempo;
    const growRate  = 2.0 + sMid*6 + sRMS*5;
    globalRot      += rotSpeed;
    radiusGrowth   += growRate;
    if(radiusGrowth > Math.min(w,h)*0.52) radiusGrowth = 0;

    const tightness = 0.07 + sMid*0.18;

    // Spawn new spiral points
    const primaryOctave = Math.floor(sMid*6 + t*0.3) % 8;
    const octavesToGen  = [
      primaryOctave,
      (primaryOctave+1)%8,
      (primaryOctave+3)%8,
      (primaryOctave+5)%8,
    ];
    if(sRMS>0.04) octavesToGen.push((primaryOctave+2)%8);

    for(const oct of octavesToGen){
      const armOff=(oct/8)*Math.PI*2;
      const angle=globalRot+armOff;
      const radius=radiusGrowth+(oct*Math.min(w,h)*0.06);
      spiralArms[oct].push({
        radius, angle,
        life: 1,
        decay: 0.0008 + sMid*0.001,
        size: 5+oct*2.5+sBass*8,
        oct
      });
    }

    // Burst on transient
    if(sRMS > 0.18 && Math.random()<0.3){
      for(let oct=0;oct<8;oct++){
        spiralArms[oct].push({
          radius: radiusGrowth+(oct*Math.min(w,h)*0.06),
          angle: globalRot+(oct/8)*Math.PI*2,
          life: 1, decay: 0.003,
          size: 7+oct*3+sBass*12, oct
        });
      }
    }

    ctx.save();
    ctx.translate(w/2, h/2);

    for(let oct=0;oct<8;oct++){
      const arm=spiralArms[oct];
      const colHex=ARM_COLS[oct](pal);

      for(let i=arm.length-1;i>=0;i--){
        const pt=arm[i];
        pt.life-=pt.decay;
        if(pt.life<=0){ arm.splice(i,1); continue; }
      }

      for(let i=0;i<arm.length;i++){
        const pt=arm[i];
        const sa=pt.angle+(pt.radius*tightness);
        const x=Math.cos(sa)*pt.radius;
        const y=Math.sin(sa)*pt.radius;
        const alpha=pt.life*(0.55+sHigh*0.3);
        const sz=pt.size*(0.5+pt.life*0.5);

        // Glow
        const glow=4+sBass*16+sHigh*10;
        ctx.shadowBlur=glow;
        ctx.shadowColor=hexAlpha(colHex, alpha*0.6);
        ctx.fillStyle=hexAlpha(colHex, alpha);
        ctx.beginPath();
        ctx.arc(x,y,sz,0,Math.PI*2);
        ctx.fill();
        ctx.shadowBlur=0;

        // Connect to previous point in arm
        if(i>0){
          const pp=arm[i-1];
          const psa=pp.angle+(pp.radius*tightness);
          const px=Math.cos(psa)*pp.radius;
          const py=Math.sin(psa)*pp.radius;
          const connAlpha=Math.min(pt.life,pp.life)*0.5;
          ctx.strokeStyle=hexAlpha(colHex,connAlpha);
          ctx.lineWidth=3+sMid*4;
          ctx.lineCap='round';
          ctx.shadowBlur=glow*0.5;
          ctx.shadowColor=hexAlpha(colHex,0.4);
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.stroke();
          ctx.shadowBlur=0;
        }
      }
    }

    // Central core — pulses with bass
    const coreR=14+sBass*55+sMid*20;
    const coreCol=pal.warm[1];
    ctx.shadowBlur=30+sBass*50;
    ctx.shadowColor=hexAlpha(coreCol,0.7);
    ctx.fillStyle=hexAlpha(coreCol,0.85);
    ctx.beginPath(); ctx.arc(0,0,coreR,0,Math.PI*2); ctx.fill();
    // Bright centre
    ctx.shadowBlur=0;
    ctx.fillStyle=hexAlpha(pal.paper,0.9);
    ctx.beginPath(); ctx.arc(0,0,coreR*0.35,0,Math.PI*2); ctx.fill();

    ctx.restore();
  }

  return { init, start, stop };
})();
