// Web Audio ambience engine — per-scene tonal textures + MP3 track support
window.Ember = window.Ember || {};

Ember.Audio = (function() {
  let ctx = null;
  let masterGain = null;
  let active = null;
  let analyser = null;
  let freqData = null;

  // Custom MP3 track state
  let trackBuffer = null;
  let trackSource = null;
  let trackGain = null;
  let trackName = '';
  let trackOffset = 0;     // seconds into track when paused
  let trackStartedAt = 0;  // ctx.currentTime when source started

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = Ember.state.vol;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
  }

  function setVolume(v) {
    Ember.state.vol = v;
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(Ember.state.audioOn ? v : 0, ctx.currentTime + 0.3);
    }
  }
  function setOn(on) {
    Ember.state.audioOn = on;
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(on ? Ember.state.vol : 0, ctx.currentTime + 0.4);
    }
  }

  function makeDrone(freqs, { type='sine', gain=0.08, detune=6, lpFreq=1800, vibrato=0.3 } = {}) {
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lpFreq;
    lp.Q.value = 0.6;
    g.connect(lp);
    lp.connect(masterGain);

    const oscs = [];
    freqs.forEach((f, i) => {
      for (let k = -1; k <= 1; k++) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = k * detune + (i%2 ? 3 : -3);
        const og = ctx.createGain();
        og.gain.value = 1 / (freqs.length * 3);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07 + i*0.03 + k*0.01;
        const lfoG = ctx.createGain();
        lfoG.gain.value = vibrato * 0.5;
        lfo.connect(lfoG);
        lfoG.connect(og.gain);
        o.connect(og);
        og.connect(g);
        o.start();
        lfo.start();
        oscs.push(o, lfo);
      }
    });

    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 2.5);

    return {
      stop() {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
        setTimeout(() => oscs.forEach(o => { try { o.stop(); } catch(e){} }), 2200);
      },
      node: g
    };
  }

  function makeNoise({ gain=0.04, bp=800, q=2 } = {}) {
    const bufferSize = 2 * ctx.sampleRate;
    const noise = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = bp;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start();
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 3.0);
    return {
      stop() {
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
        setTimeout(() => { try { src.stop(); } catch(e){} }, 2000);
      }
    };
  }

  function makeChimes(scale, { interval=4, gain=0.08 } = {}) {
    let stopped = false;
    function schedule() {
      if (stopped) return;
      const t = ctx.currentTime + 0.01;
      const f = scale[Math.floor(Math.random()*scale.length)];
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
      o.connect(g); g.connect(masterGain);
      o.start(t);
      o.stop(t + 3.2);
      setTimeout(schedule, (interval + Math.random()*interval) * 1000);
    }
    setTimeout(schedule, 1500);
    return { stop() { stopped = true; } };
  }

  const PRESETS = {
    1: () => [
      makeDrone([55, 82.4, 110], { type:'triangle', gain:0.12, lpFreq: 900, vibrato: 0.2 }),
      makeNoise({ gain: 0.02, bp: 200, q: 1.2 })
    ],
    2: () => [
      makeDrone([110, 164.8, 220, 329.6], { type:'sine', gain:0.10, lpFreq: 2200, vibrato: 0.25 }),
      makeNoise({ gain: 0.015, bp: 1800, q: 1.5 }),
      makeChimes([523.25, 659.25, 783.99], { interval: 5, gain: 0.06 })
    ],
    3: () => [
      makeDrone([98, 146.8, 220], { type:'sine', gain:0.07, lpFreq: 1400, vibrato: 0.5 }),
      makeNoise({ gain: 0.06, bp: 700, q: 0.9 })
    ],
    4: () => [
      makeDrone([65.4, 98, 130.8, 196], { type:'triangle', gain:0.11, lpFreq: 1100, vibrato: 0.2 }),
      makeNoise({ gain: 0.02, bp: 350, q: 1.4 })
    ],
    5: () => [
      makeDrone([87.3, 130.8, 174.6, 261.6, 392], { type:'sine', gain:0.09, lpFreq: 2400, vibrato: 0.35 }),
      makeChimes([523.25, 587.33, 698.46, 880], { interval: 3.5, gain: 0.07 })
    ],
    6: () => [
      makeDrone([73.4, 110, 146.8], { type:'sine', gain:0.07, lpFreq: 1600, vibrato: 0.4 }),
      makeChimes([440, 554.37, 659.25, 880], { interval: 6, gain: 0.05 })
    ]
  };

  // ——— MP3 track loading ———

  function loadTrack(arrayBuffer, name) {
    init();
    trackName = name || 'custom track';
    ctx.decodeAudioData(arrayBuffer, (buffer) => {
      trackBuffer = buffer;
      Ember.Audio.onTrackLoaded && Ember.Audio.onTrackLoaded(trackName);
    }, (err) => {
      console.error('Failed to decode audio:', err);
      Ember.Audio.onTrackError && Ember.Audio.onTrackError();
    });
  }

  function startTrack(offset) {
    if (!trackBuffer || !ctx) return;
    stopTrack();
    trackGain = ctx.createGain();
    trackGain.gain.value = Ember.state.vol;
    trackGain.connect(analyser);
    trackSource = ctx.createBufferSource();
    trackSource.buffer = trackBuffer;
    trackSource.loop = true;
    trackSource.connect(trackGain);
    trackOffset = offset || 0;
    trackStartedAt = ctx.currentTime;
    trackSource.start(0, trackOffset);
  }

  function stopTrack() {
    if (trackSource) {
      trackOffset = (ctx.currentTime - trackStartedAt + trackOffset) % trackBuffer.duration;
      try { trackSource.stop(); } catch(e) {}
      trackSource = null;
    }
    if (trackGain) {
      trackGain.disconnect();
      trackGain = null;
    }
  }

  function hasTrack() { return !!trackBuffer; }
  function getTrackName() { return trackName; }

  function playScene(n) {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    // Stop generated drones — they run silently when a track is loaded
    if (active) {
      active.forEach(node => node.stop && node.stop());
    }
    // Only play generated ambience when no custom track is loaded
    if (!trackBuffer) {
      const preset = PRESETS[n];
      active = preset ? preset() : [];
    } else {
      active = [];
      // Track plays continuously — resume if not already running
      if (!trackSource) startTrack(trackOffset);
    }
  }

  function stopAll() {
    if (active) active.forEach(node => node.stop && node.stop());
    active = null;
    stopTrack();
  }

  function getLevel() {
    if (!analyser) return 0;
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 2; i < 60; i++) sum += freqData[i];
    return sum / (58 * 255);
  }
  function getBands() {
    if (!analyser) return { low: 0, mid: 0, high: 0 };
    analyser.getByteFrequencyData(freqData);
    let l=0, m=0, h=0;
    for (let i=0; i<20; i++)  l += freqData[i];
    for (let i=20; i<80; i++) m += freqData[i];
    for (let i=80; i<freqData.length; i++) h += freqData[i];
    return {
      low: l / (20*255),
      mid: m / (60*255),
      high: h / ((freqData.length-80)*255)
    };
  }

  return { init, playScene, stopAll, setVolume, setOn, getLevel, getBands,
           loadTrack, startTrack, stopTrack, hasTrack, getTrackName };
})();
