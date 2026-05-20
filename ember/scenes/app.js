// App — glues scenes together, handles click nav, poem, progress, Tweaks.
window.Ember = window.Ember || {};

(function() {
  const SCENES_META = [
    { key: 'c1', mod: 'Scene1', num: 'I',   name: 'EMBER',
      line: 'before anything, a breath of heat remembered itself.' },
    { key: 'c2', mod: 'Scene2', num: 'II',  name: 'DAWN',
      line: 'and the sky learned the color of waiting.' },
    { key: 'c3', mod: 'Scene3', num: 'III', name: 'BREATH',
      line: 'the world inhaled, and was made of motion.' },
    { key: 'c4', mod: 'Scene4', num: 'IV',  name: 'TERRAIN',
      line: 'hills folded themselves into the shape of rest.' },
    { key: 'c5', mod: 'Scene5', num: 'V',   name: 'BLOOM',
      line: 'something soft opened, and called it living.' },
    { key: 'c6', mod: 'Scene6', num: 'VI',  name: 'REMEMBER',
      line: 'each light, looking back, became a story.' },
    { key: 'c7', mod: 'Scene7', num: 'VII', name: 'LIFE',
      line: 'a thousand small wills, finding the same direction.' },
    { key: 'c8', mod: 'Scene8', num: 'VIII',name: 'COSMOS',
      line: 'everything that was scattered, still spiraling home.' },
  ];

  const stage = document.getElementById('stage');
  const chapter = document.getElementById('chapter');
  const chapterNum  = chapter.querySelector('.num');
  const chapterName = chapter.querySelector('.name');
  const progress = document.getElementById('progress');
  const poemEl = document.getElementById('poem');
  const poemLine = poemEl.querySelector('.line');
  const titleEl = document.getElementById('title');
  const endEl = document.getElementById('endcard');
  const hint = document.getElementById('hint');

  SCENES_META.forEach(() => {
    const d = document.createElement('div');
    d.className = 'dot';
    progress.appendChild(d);
  });
  const dots = [...progress.querySelectorAll('.dot')];

  function setProgress(i) {
    dots.forEach((d, k) => {
      d.classList.toggle('cur', k === i);
      d.classList.toggle('done', k < i);
    });
  }

  SCENES_META.forEach(m => Ember[m.mod].init());

  let current = -1;
  let transitioning = false;

  function showScene(idx) {
    if (transitioning) return;
    transitioning = true;

    if (current >= 0 && current < SCENES_META.length) {
      const prev = SCENES_META[current];
      const prevCanvas = document.getElementById(prev.key);
      prevCanvas.classList.remove('active');
      setTimeout(() => Ember[prev.mod].stop(), 1700);
    }

    current = idx;

    if (idx >= SCENES_META.length) {
      Ember.Audio.stopAll();
      setProgress(-1);
      chapter.classList.remove('show');
      chapterNum.textContent = '';
      chapterName.textContent = '';
      poemEl.classList.remove('show');
      hint.style.opacity = 0;
      endEl.classList.add('show');
      transitioning = false;
      return;
    }

    const m = SCENES_META[idx];
    const c = document.getElementById(m.key);
    Ember[m.mod].start();
    requestAnimationFrame(() => c.classList.add('active'));

    chapterNum.textContent = m.num;
    chapterName.textContent = m.name;
    chapter.classList.add('show');
    setProgress(idx);

    poemEl.classList.remove('show');
    poemLine.textContent = m.line;
    setTimeout(() => {
      if (Ember.state.textOn) poemEl.classList.add('show');
    }, 300);

    if (Ember.state.audioOn) Ember.Audio.playScene(idx + 1);

    setTimeout(() => { transitioning = false; }, 1700);
  }

  function beginStory() {
    if (titleEl.classList.contains('gone')) return;
    titleEl.classList.add('gone');
    Ember.Audio.init();
    setTimeout(() => showScene(0), 600);
  }

  function advance() {
    if (transitioning) return;
    if (current < 0) { beginStory(); return; }
    if (current >= SCENES_META.length) return;
    showScene(current + 1);
  }

  function restart() {
    endEl.classList.remove('show');
    current = -1;
    SCENES_META.forEach(m => {
      const c = document.getElementById(m.key);
      c.classList.remove('active');
      Ember[m.mod].stop();
      const ctx2d = c.getContext('2d');
      if (ctx2d && ctx2d.clearRect) ctx2d.clearRect(0, 0, c.width, c.height);
    });
    chapter.classList.remove('show');
    poemEl.classList.remove('show');
    setProgress(-1);
    hint.style.opacity = '';
    titleEl.classList.remove('gone');
  }

  stage.addEventListener('click', (e) => {
    const tweaks = document.getElementById('tweaks');
    if (tweaks.contains(e.target)) return;
    if (e.target.id === 'restart') return;
    if (endEl.contains(e.target)) return;
    advance();
  });
  document.getElementById('restart').addEventListener('click', restart);

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      advance();
    } else if (e.key === 'ArrowLeft') {
      if (current > 0) showScene(current - 1);
    } else if (e.key === 'r') {
      restart();
    }
  });

  stage.addEventListener('click', () => {
    if (hint) hint.style.transition = 'opacity 1s';
    if (hint) hint.style.opacity = '0.25';
  }, { once: true });

  // ——————————————————————————————
  // Tweaks panel
  // ——————————————————————————————
  const TWEAK_DEFAULTS = {
    "palette": "ember",
    "tempo": 1.0,
    "seed": 4271,
    "audioOn": true,
    "vol": 0.55,
    "textOn": true
  };

  Object.assign(Ember.state, TWEAK_DEFAULTS);

  const tweaksEl = document.getElementById('tweaks');
  const paletteGrid = document.getElementById('paletteGrid');
  const tempoEl = document.getElementById('tempo');
  const seedVal = document.getElementById('seedVal');
  const reseedBtn = document.getElementById('reseed');
  const audioBtn = document.getElementById('audioBtn');
  const volEl = document.getElementById('vol');
  const textBtn = document.getElementById('textBtn');

  Object.entries(Ember.palettes).forEach(([k, pal]) => {
    const d = document.createElement('div');
    d.className = 'swatch' + (k === Ember.state.palette ? ' sel' : '');
    d.style.background = `linear-gradient(135deg, ${pal.bg[1]} 0%, ${pal.warm[2]} 40%, ${pal.warm[1]} 75%, ${pal.warm[0]} 100%)`;
    d.title = pal.name;
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = pal.name.slice(0,4);
    d.appendChild(lbl);
    d.addEventListener('click', () => {
      Ember.state.palette = k;
      [...paletteGrid.children].forEach(c => c.classList.remove('sel'));
      d.classList.add('sel');
    });
    paletteGrid.appendChild(d);
  });

  tempoEl.value = Ember.state.tempo;
  tempoEl.addEventListener('input', () => {
    Ember.state.tempo = parseFloat(tempoEl.value);
  });

  seedVal.textContent = Ember.state.seed;
  reseedBtn.addEventListener('click', () => {
    Ember.state.seed = Math.floor(Math.random()*10000);
    seedVal.textContent = Ember.state.seed;
    if (current >= 0 && current < SCENES_META.length) {
      const m = SCENES_META[current];
      Ember[m.mod].stop();
      Ember[m.mod].start();
    }
  });

  function setAudioBtn() {
    audioBtn.classList.toggle('on', Ember.state.audioOn);
    audioBtn.textContent = Ember.state.audioOn ? 'on' : 'off';
  }
  setAudioBtn();
  audioBtn.addEventListener('click', () => {
    Ember.state.audioOn = !Ember.state.audioOn;
    setAudioBtn();
    Ember.Audio.setOn(Ember.state.audioOn);
    if (Ember.state.audioOn && current >= 0 && current < SCENES_META.length) {
      Ember.Audio.playScene(current + 1);
    }
  });

  volEl.value = Ember.state.vol;
  volEl.addEventListener('input', () => {
    Ember.state.vol = parseFloat(volEl.value);
    Ember.Audio.setVolume(Ember.state.vol);
  });

  function setTextBtn() {
    textBtn.classList.toggle('on', Ember.state.textOn);
    textBtn.textContent = Ember.state.textOn ? 'on' : 'off';
  }
  setTextBtn();
  textBtn.addEventListener('click', () => {
    Ember.state.textOn = !Ember.state.textOn;
    setTextBtn();
    poemEl.classList.toggle('show', Ember.state.textOn && current >= 0 && current < SCENES_META.length);
  });

  // T key toggles tweaks panel
  window.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      tweaksEl.classList.toggle('on');
    }
  });

  // ——————————————————————————————
  // MP3 upload
  // ——————————————————————————————
  const trackInput   = document.getElementById('trackInput');
  const dropZone     = document.getElementById('dropZone');
  const uploadPill   = document.getElementById('uploadPill');

  function loadFile(file) {
    if (!file || !file.type.match(/audio/)) return;
    const name = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = (e) => {
      Ember.Audio.init();
      Ember.Audio.loadTrack(e.target.result, name);
    };
    reader.readAsArrayBuffer(file);
  }

  Ember.Audio.onTrackLoaded = (name) => {
    const short = name.length > 26 ? name.slice(0, 24) + '…' : name;
    dropZone.innerHTML = `<span class="track-name">&#9834; ${short}</span>`;
    uploadPill.textContent = `♪ ${short}`;
    uploadPill.classList.add('has-track');
    // If story already running, start the track immediately
    if (current >= 0 && current < SCENES_META.length) {
      Ember.Audio.startTrack(0);
    }
  };

  Ember.Audio.onTrackError = () => {
    dropZone.textContent = 'error decoding file — try another';
  };

  // Click drop zone or pill → open file picker
  dropZone.addEventListener('click', () => trackInput.click());
  uploadPill.addEventListener('click', (e) => { e.stopPropagation(); trackInput.click(); });

  trackInput.addEventListener('change', (e) => {
    loadFile(e.target.files[0]);
    trackInput.value = '';
  });

  // Drag and drop anywhere on stage
  stage.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  stage.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    loadFile(e.dataTransfer.files[0]);
  });

  // Edit-mode protocol for Claude Design
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.type === '__activate_edit_mode') {
      tweaksEl.classList.add('on');
    } else if (d.type === '__deactivate_edit_mode') {
      tweaksEl.classList.remove('on');
    }
  });
  try {
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  } catch(e) {}

})();
