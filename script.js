/* ==========================================================================
   script.js — Application wiring (UI, controls, audio, calculator, quiz).
   Depends on: physics.js, engine.js, audio.js, scene.js, content.js
   ========================================================================== */
(function () {
  'use strict';

  var Phys = window.DopplerPhysics, Eng = window.DopplerEngine, Audio = window.DopplerAudio, Content = window.DopplerContent;
  var SYM = Phys.SYMBOLS, PRIME = SYM.PRIME;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------- helpers */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); toast(ok ? okMsg : 'Copy is not available in this browser');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else { fallback(); }
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function setIcon(btn, id) { var u = $('use', btn); if (u) u.setAttribute('href', '#' + id); }

  /* ------------------------------------------------------- image fallbacks */
  var assets = { car: $('#asset-car'), person: $('#asset-person'), bg: $('#asset-bg') };
  $$('img[data-asset]').forEach(function (img) {
    img.addEventListener('error', function () { img.classList.add('img-missing'); });
    img.addEventListener('load', function () { img.classList.remove('img-missing'); if (scene) scene.bg = null; });
  });

  /* ------------------------------------------------------------------ state */
  var sim = new Eng.Simulation();
  var canvas = $('#scene');
  var scene = new window.DopplerScene.Scene(canvas, sim, assets);
  var toneMode = 'obs';          // 'obs' | 'orig'
  var attenOn = false;

  /* ------------------------------------------------------------------ theme */
  function setTheme(t) {
    document.body.setAttribute('data-theme', t);
    var b = $('#btn-theme'); setIcon(b, t === 'dark' ? 'i-sun' : 'i-moon'); $('.lbl', b).textContent = t === 'dark' ? 'Light' : 'Dark';
    store('doppler-theme', t);
  }
  $('#btn-theme').addEventListener('click', function () { setTheme(document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });
  setTheme(load('doppler-theme') === 'light' ? 'light' : 'dark');

  /* ------------------------------------------------------------------ intro */
  var intro = $('#intro'), introTimer = null, introPlayedOnce = false;
  (function buildTitle() {
    var t = $('#intro-title'), txt = t.textContent; t.textContent = '';
    txt.split('').forEach(function (ch, i) {
      var s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true'); t.appendChild(s);
    });
  })();
  (function buildWave() {            // a Doppler wave: wavelength shrinks from left to right (source approaching)
    var d = '', x, ph = 0, n = 420;
    for (x = 0; x <= n; x += 2) {
      var k = x / n, w = 0.2 + 0.16 * k;   // local angular step grows -> crests squeezed on the right
      ph += w; d += (x ? 'L' : 'M') + x + ' ' + (22 - 15 * Math.sin(ph) * Math.min(1, x / 30)).toFixed(1);
    }
    $('#intro-wave-path').setAttribute('d', d);
  })();
  function endIntro() {
    clearTimeout(introTimer);
    intro.classList.add('leaving');
    setTimeout(function () { intro.classList.add('gone'); intro.classList.remove('run', 'leaving'); }, 700);
    if (!introPlayedOnce) { introPlayedOnce = true; setPlaying(true); }
  }
  function playIntro() {
    clearTimeout(introTimer);
    intro.classList.remove('gone', 'leaving', 'run'); void intro.offsetWidth; intro.classList.add('run');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    introTimer = setTimeout(endIntro, 11800);
  }
  $('#skip-intro').addEventListener('click', endIntro);
  $('#btn-replay').addEventListener('click', playIntro);

  /* ------------------------------------------------------- scenario / modes */
  function cfg() { return sim.config; }

  function renderCases() {
    var c = cfg(), box = $('#case-controls');
    var t = c.mode === 'A' ? 'Drag the <b>person</b> left / right \u2014 the car stays still'
          : c.mode === 'B' ? 'Drag the <b>car</b> left / right \u2014 the person stays still'
          : 'Drag the <b>car</b> and / or the <b>person</b> \u2014 nothing moves by itself';
    if (box.dataset.m !== c.mode) { box.innerHTML = '<span class="hint-ic">\u21C6</span><span>' + t + '</span>'; box.dataset.m = c.mode; }
  }

  function applyScenario(s) {
    sim.setScenario(s);
    refreshScenarioUI();
  }
  function refreshScenarioUI() {
    var c = cfg(), e = sim.effective(), lab = Phys.liveLabel(e);
    $$('.mode-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === c.mode)); });
    renderCases();
    $('#row-vs').hidden = c.mode === 'A';       // stationary source: no source velocity control
    $('#row-vL').hidden = c.mode === 'B';       // stationary listener: no listener velocity control
    $('#scene-title').textContent = lab.title + ' • ' + lab.caseText;
    $('#scene-text').textContent = Phys.explanation(e.mode, e.srcDir, e.listDir, e);
    syncCalcFromSim(); syncAudio(true); updateValues();
  }
  $$('.mode-btn').forEach(function (b) { b.addEventListener('click', function () { applyScenario({ mode: b.dataset.mode }); }); });

  /* ---------------------------------------------------------------- sliders */
  var SL = {
    f:  { el: $('#sl-f'),  out: $('#out-f'),  fmt: function (x) { return x + ' Hz'; } },
    v:  { el: $('#sl-v'),  out: $('#out-v'),  fmt: function (x) { return x + ' m/s'; } },
    vs: { el: $('#sl-vs'), out: $('#out-vs'), fmt: function (x) { return x + ' m/s'; } },
    vL: { el: $('#sl-vL'), out: $('#out-vL'), fmt: function (x) { return x + ' m/s'; } }
  };
  Object.keys(SL).forEach(function (k) {
    SL[k].el.addEventListener('input', function () {
      var val = +SL[k].el.value; SL[k].out.textContent = SL[k].fmt(val);
      var p = {}; p[k] = val; sim.setParams(p); syncCalcFromSim(); syncAudio(true); updateValues();
    });
  });
  $('#sl-speed').addEventListener('input', function (e) { sim.speed = +e.target.value; $('#out-speed').textContent = (+e.target.value).toFixed(1) + '×'; });
  $('#sl-vol').addEventListener('input', function (e) { Audio.setVolume(+e.target.value / 100); $('#out-vol').textContent = e.target.value + '%'; });

  /* --------------------------------------------------------------- transport */
  function setPlaying(p) {
    sim.playing = !!p;
    $('#btn-play').setAttribute('aria-pressed', String(sim.playing));
    $('#btn-pause').setAttribute('aria-pressed', String(!sim.playing));
  }
  $('#btn-play').addEventListener('click', function () { setPlaying(true); });
  $('#btn-pause').addEventListener('click', function () { setPlaying(false); });
  $('#btn-reset').addEventListener('click', function () { sim.softReset(); setPlaying(false); });
  $('#btn-restart').addEventListener('click', function () { sim.softReset(); setPlaying(true); });
  setPlaying(true);

  /* -------------------------------------------------------------------- audio */
  function currentPitch() {
    var e = sim.effective(), r = Phys.compute(e);
    return toneMode === 'orig' || !r.valid ? e.f : r.fObs;
  }
  function attenuation() {
    if (!attenOn) return 1;
    var d = sim.lis.x - sim.src.x, L = Eng.LAYOUT;
    return Math.max(0.35, 1 - 0.65 * Math.min(1, Math.max(0, (d - L.minGap) / (L.maxGap - L.minGap))));
  }
  function updateAudioUI() {
    var on = Audio.playing, hz = currentPitch();
    $('#audio-status').textContent = !Audio.supported ? 'not supported' : (on ? (Audio.muted ? 'muted' : 'playing ' + hz.toFixed(1) + ' Hz') : 'stopped');
    var hb = $('#btn-sound'); hb.setAttribute('aria-pressed', String(on));
    setIcon(hb, on ? 'i-sound' : 'i-mute'); $('.lbl', hb).textContent = on ? 'Sound On' : 'Sound Off';
    $('#mute-lbl').textContent = Audio.muted ? 'Unmute' : 'Mute'; $('#btn-mute').setAttribute('aria-pressed', String(Audio.muted));
  }
  var lastHz = 0;
  function syncAudio(force) {
    var hz = currentPitch();
    if (force || Math.abs(hz - lastHz) > 0.01) { Audio.setFrequency(hz); lastHz = hz; }
    Audio.setAttenuation(attenuation());
    updateAudioUI();
  }
  function startSound() {
    if (!Audio.supported) { toast('Web Audio is not supported in this browser'); return; }
    Audio.play(currentPitch()); lastHz = currentPitch(); updateAudioUI();
  }
  function stopSound() { Audio.pause(); updateAudioUI(); }
  $('#btn-play-sound').addEventListener('click', startSound);
  $('#btn-pause-sound').addEventListener('click', stopSound);
  $('#btn-sound').addEventListener('click', function () { Audio.playing ? stopSound() : startSound(); });
  $('#btn-mute').addEventListener('click', function () { Audio.setMuted(!Audio.muted); updateAudioUI(); });
  function setTone(m) {
    toneMode = m;
    $('#tone-orig').setAttribute('aria-pressed', String(m === 'orig')); $('#tone-obs').setAttribute('aria-pressed', String(m === 'obs'));
    syncAudio(true);
  }
  $('#tone-orig').addEventListener('click', function () { setTone('orig'); });
  $('#tone-obs').addEventListener('click', function () { setTone('obs'); });
  $('#chk-atten').addEventListener('change', function (e) { attenOn = e.target.checked; syncAudio(true); });

  /* ----------------------------------------------- fullscreen & presentation */
  var wrap = $('#scene-wrap');
  function toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (wrap.requestFullscreen) wrap.requestFullscreen().catch(function () { toast('Full screen is not available here'); });
    else toast('Full screen is not supported in this browser');
  }
  document.addEventListener('fullscreenchange', function () {
    var fs = !!document.fullscreenElement;
    [$('#btn-fullscreen'), $('#btn-fs2')].forEach(function (b) { setIcon(b, fs ? 'i-close' : 'i-full'); });
    $('#btn-fullscreen .lbl').textContent = fs ? 'Exit full screen' : 'Full screen';
    setTimeout(function () { scene.resize(); }, 60);
  });
  $('#btn-fullscreen').addEventListener('click', toggleFullscreen);
  $('#btn-fs2').addEventListener('click', toggleFullscreen);

  function setPresentation(on) {
    document.body.classList.toggle('presentation', on);
    $('#btn-present').setAttribute('aria-pressed', String(on));
    if (on) window.scrollTo(0, 0);
    setTimeout(function () { scene.resize(); }, 60);
  }
  $('#btn-present').addEventListener('click', function () { setPresentation(!document.body.classList.contains('presentation')); });
  $('#btn-exit-present').addEventListener('click', function () { setPresentation(false); });

  if (window.ResizeObserver) new ResizeObserver(function () { scene.resize(); }).observe(canvas);
  window.addEventListener('resize', function () { scene.resize(); });

  /* ---------------------------------------------------------------- reset all */
  $('#btn-resetall').addEventListener('click', function () {
    var D = Phys.DEFAULTS;
    SL.f.el.value = D.f; SL.v.el.value = D.v; SL.vs.el.value = 80; SL.vL.el.value = 80;
    Object.keys(SL).forEach(function (k) { SL[k].out.textContent = SL[k].fmt(+SL[k].el.value); });
    $('#sl-speed').value = 1; sim.speed = 1; $('#out-speed').textContent = '1.0×';
    $('#sl-vol').value = 50; $('#out-vol').textContent = '50%'; Audio.setVolume(0.5); Audio.setMuted(false);
    $('#chk-atten').checked = false; attenOn = false; setTone('obs'); stopSound();
    sim.setParams({ f: D.f, v: D.v, vs: 80, vL: 80 });
    sim.config.mode = 'A'; sim.softReset();
    if (document.body.classList.contains('presentation')) setPresentation(false);
    $('#calc-sync').checked = true;
    refreshScenarioUI(); setPlaying(true); toast('Everything has been reset to the defaults');
  });

  /* ================================================================ CALCULATOR */
  var calcEls = { sc: $('#calc-scenario'), sd: $('#calc-srcdir'), ld: $('#calc-lisdir'), f: $('#calc-f'), v: $('#calc-v'), vs: $('#calc-vs'), vL: $('#calc-vL'), sync: $('#calc-sync') };
  var lastCalcText = '';

  function calcInfo() {
    switch (calcEls.sc.value) {
      case '1': return { mode: 'A', sd: 0, ld: 1 };
      case '2': return { mode: 'A', sd: 0, ld: -1 };
      case '3': return { mode: 'B', sd: 1, ld: 0 };
      case '4': return { mode: 'B', sd: -1, ld: 0 };
      default:  return { mode: 'C', sd: +calcEls.sd.value, ld: +calcEls.ld.value };
    }
  }
  function updateCalcFields() {
    var i = calcInfo();
    $('#cf-vs').hidden = i.mode === 'A'; $('#cf-vL').hidden = i.mode === 'B'; $('#cf-dirs').hidden = i.mode !== 'C';
  }
  function runCalc() {
    updateCalcFields();
    var i = calcInfo(), out = $('#calc-out');
    var vals = { f: parseFloat(calcEls.f.value), v: parseFloat(calcEls.v.value), vs: parseFloat(calcEls.vs.value), vL: parseFloat(calcEls.vL.value) };
    var need = ['f', 'v'].concat(i.mode !== 'A' ? ['vs'] : [], i.mode !== 'B' ? ['vL'] : []);
    var missing = need.filter(function (k) { return !isFinite(vals[k]); });
    if (missing.length) {
      out.innerHTML = '<p class="muted-msg">Enter ' + missing.join(', ') + ' to see the full working.</p>'; lastCalcText = ''; return;
    }
    if (vals.vs < 0 || vals.vL < 0) {
      out.innerHTML = '<p class="error-msg">Velocities cannot be negative. Choose the direction (towards / away) instead.</p>'; lastCalcText = ''; return;
    }
    var ex = Phys.explain(i.mode, i.sd, i.ld, vals), lab = Phys.scenarioLabel(i.mode, i.sd, i.ld);
    if (!ex.res.valid) {
      out.innerHTML = '<h3>' + esc(lab.title) + '</h3><div class="error-msg">' + ex.errors.map(esc).join('<br>') + '</div>'; lastCalcText = ''; return;
    }
    var r = ex.res, h = '';
    h += '<h3>' + esc(lab.title) + '</h3><p class="case-line">' + esc(lab.caseText) + '</p>';
    h += '<div class="co-grid"><div><h4>Given</h4><ul class="given">' + ex.given.map(function (g) { return '<li><b>' + esc(g[0]) + '</b> = ' + esc(g[2]) + ' <span>' + esc(g[1]) + '</span></li>'; }).join('') + '</ul></div>';
    h += '<div><h4>Selected formula</h4><div class="formula-box">' + esc(ex.formula) + '</div></div></div>';
    h += '<h4>Substitution (step by step)</h4><ol class="steps">' + ex.substitution.map(function (s) { return '<li><code>' + esc(s) + '</code></li>'; }).join('') + '</ol>';
    h += '<div class="final"><span>Final answer</span><strong>' + esc(ex.final) + '</strong></div>';
    h += '<h4>Wavelengths</h4><ul class="plain">' + ex.wavelength.map(function (s) { return '<li><code>' + esc(s) + '</code></li>'; }).join('') + '</ul>';
    h += '<table class="res-table"><tbody>' +
         '<tr><th>Original wavelength</th><td class="c-purple">' + SYM.LAMBDA + ' = ' + Phys.fix(r.lambda, 3) + ' m</td></tr>' +
         '<tr><th>Observed wavelength</th><td class="c-teal">' + SYM.LAMBDA + PRIME + ' = ' + Phys.fix(r.lambdaObs, 3) + ' m</td></tr>' +
         '<tr><th>Frequency difference</th><td class="c-green">' + SYM.DELTA + 'f = ' + Phys.signed(r.df, 1) + ' Hz</td></tr>' +
         '<tr><th>Wavelength difference</th><td class="c-yellow">' + SYM.DELTA + SYM.LAMBDA + ' = ' + Phys.signed(r.dLambda, 3) + ' m</td></tr>' +
         '<tr><th>Percentage frequency change</th><td>' + Phys.signed(r.pct, 2) + ' % ' + (r.df > 0.05 ? '<span class="up">▲ higher pitch</span>' : (r.df < -0.05 ? '<span class="down">▼ lower pitch</span>' : '')) + '</td></tr>' +
         '</tbody></table>';
    h += '<p class="note">' + esc(ex.note) + '</p>';
    out.innerHTML = h;

    var L = ['DOPPLER EFFECT CALCULATION — ' + lab.title, lab.caseText, '', 'Given:'];
    ex.given.forEach(function (g) { L.push('  ' + g[0] + ' = ' + g[2]); });
    L.push('', 'Formula:', '  ' + ex.formula, '', 'Substitution:'); ex.substitution.forEach(function (s) { L.push('  ' + s); });
    L.push('', 'Final answer:', '  ' + ex.final, '', 'Wavelengths:'); ex.wavelength.forEach(function (s) { L.push('  ' + s); });
    L.push('', SYM.DELTA + 'f = ' + Phys.signed(r.df, 1) + ' Hz', SYM.DELTA + SYM.LAMBDA + ' = ' + Phys.signed(r.dLambda, 3) + ' m', 'Frequency change = ' + Phys.signed(r.pct, 2) + ' %');
    lastCalcText = L.join('\n');
  }
  function unlinkAndRun() { calcEls.sync.checked = false; runCalc(); }
  ['sc', 'sd', 'ld', 'f', 'v', 'vs', 'vL'].forEach(function (k) {
    calcEls[k].addEventListener('input', unlinkAndRun); calcEls[k].addEventListener('change', unlinkAndRun);
  });

  /** Copy simulation values into the calculator (when "Follow the simulation" is ticked). */
  function syncCalcFromSim() {
    if (!calcEls.sync.checked) return;
    var c = cfg(), e = sim.effective();
    if (c.mode === 'A') calcEls.sc.value = e.listDir > 0 ? '1' : '2';
    else if (c.mode === 'B') calcEls.sc.value = e.srcDir > 0 ? '3' : '4';
    else { calcEls.sc.value = '5'; calcEls.sd.value = String(e.srcDir); calcEls.ld.value = String(e.listDir); }
    calcEls.f.value = e.f; calcEls.v.value = e.v; calcEls.vs.value = e.vs; calcEls.vL.value = e.vL;
    runCalc();
  }
  calcEls.sync.addEventListener('change', function () { if (calcEls.sync.checked) syncCalcFromSim(); });
  $('#calc-run').addEventListener('click', runCalc);
  $('#calc-clear').addEventListener('click', function () {
    calcEls.sync.checked = false; ['f', 'v', 'vs', 'vL'].forEach(function (k) { calcEls[k].value = ''; }); runCalc();
  });
  $('#calc-reset').addEventListener('click', function () {
    var D = Phys.DEFAULTS; calcEls.sync.checked = false;
    calcEls.f.value = D.f; calcEls.v.value = D.v; calcEls.vs.value = D.vs; calcEls.vL.value = D.vL; runCalc();
  });
  $('#calc-copy').addEventListener('click', function () {
    if (!lastCalcText) { toast('Nothing to copy yet — enter valid values first'); return; }
    copyText(lastCalcText, 'Calculation copied');
  });

  /* ============================================================ STATIC CONTENT */
  // Understanding grid
  $('#var-grid').innerHTML = Content.VARIABLES.map(function (v) {
    return '<article class="var-card" style="--accent:' + v.col + '"><div class="var-ill">' + v.ill + '</div>' +
           '<div class="var-sym">' + v.sym + '</div><h3>' + esc(v.name) + '</h3><p class="var-unit">SI unit: <b>' + esc(v.unit) + '</b></p><p>' + esc(v.text) + '</p></article>';
  }).join('');

  // Formula sheet
  $('#formula-sheet').innerHTML = Content.FORMULAS.map(function (g) {
    return '<div class="f-group"><h3>' + esc(g.group) + '</h3>' + g.items.map(function (it, i) {
      return '<div class="f-item"><div><span class="f-label">' + esc(it.label) + '</span><div class="f-math">' + it.html + '</div><span class="f-note">' + esc(it.note) + '</span></div>' +
             '<button type="button" class="btn icon small" data-copy="' + esc(it.copy) + '" aria-label="Copy formula: ' + esc(it.label) + '" data-tip="Copy"><svg class="ic"><use href="#i-copy"/></svg></button></div>';
    }).join('') + '</div>';
  }).join('');
  $('#units-line').innerHTML = '<b>SI units:</b> ' + Content.SYMBOL_UNITS.map(function (u) { return esc(u[0]) + ' → ' + esc(u[1]); }).join(' &nbsp;•&nbsp; ');
  $('#formula-sheet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy, 'Formula copied');
  });
  $('#btn-copy-formulas').addEventListener('click', function () {
    var t = 'DOPPLER EFFECT — FORMULA SHEET\n';
    Content.FORMULAS.forEach(function (g) { t += '\n' + g.group.toUpperCase() + '\n'; g.items.forEach(function (it) { t += '  ' + it.label + ': ' + it.copy + '\n'; }); });
    t += '\nSI units: f in Hz, v/vs/vL in m/s, λ in m';
    copyText(t, 'All formulas copied');
  });

  // Comparison table
  $('#compare-body').innerHTML = Content.COMPARE.map(function (r) {
    return '<tr><th scope="row">' + esc(r.sit) + '</th><td>' + r.moving + '</td><td>' + r.still + '</td><td><code>' + esc(r.f) + '</code></td>' +
           '<td class="' + (r.up ? 'up' : 'down') + '"><span class="arrow">' + (r.up ? '▲' : '▼') + '</span> ' + esc(r.fb) + '</td><td>' + esc(r.wb) + '</td></tr>';
  }).join('');

  // Applications
  $('#app-grid').innerHTML = Content.APPS.map(function (a) {
    return '<article class="app-card"><div class="app-ico">' + a.icon + '</div><h3>' + esc(a.title) + '</h3><p>' + esc(a.text) + '</p></article>';
  }).join('');

  /* ===================================================================== QUIZ */
  var quiz = { i: 0, score: 0, answered: false };
  var quizEl = $('#quiz');
  function renderQuiz() {
    var Q = Content.QUIZ, N = Q.length;
    if (quiz.i >= N) {
      var pct = Math.round(quiz.score / N * 100);
      var msg = pct === 100 ? 'Perfect! You have mastered the Doppler Effect.' : (pct >= 70 ? 'Great work! You understand the key ideas.' : (pct >= 40 ? 'Good start — review the formula sheet and try again.' : 'Keep going — play with the simulation and try again.'));
      quizEl.innerHTML = '<div class="quiz-result"><p class="eyebrow">Final score</p><div class="score-ring" style="--p:' + pct + '"><span>' + quiz.score + '<small>/' + N + '</small></span></div><h3>' + pct + '%</h3><p>' + msg + '</p>' +
        '<button type="button" class="btn primary" id="quiz-restart"><svg class="ic"><use href="#i-reset"/></svg>Restart quiz</button></div>';
      return;
    }
    var q = Q[quiz.i];
    quizEl.innerHTML = '<div class="quiz-top"><span>Question ' + (quiz.i + 1) + ' of ' + N + '</span><span>Score: ' + quiz.score + '</span></div>' +
      '<div class="quiz-bar"><i style="width:' + (quiz.i / N * 100) + '%"></i></div>' +
      '<h3 class="quiz-q">' + esc(q.q) + '</h3><div class="quiz-opts" role="group" aria-label="Answer choices">' +
      q.a.map(function (t, k) { return '<button type="button" class="opt" data-k="' + k + '"><b>' + 'ABCD'[k] + '</b><span>' + esc(t) + '</span></button>'; }).join('') +
      '</div><div class="quiz-fb" id="quiz-fb" hidden></div><div class="quiz-nav"><button type="button" class="btn primary" id="quiz-next" hidden>' + (quiz.i === N - 1 ? 'See my score' : 'Next question') + '</button></div>';
    quiz.answered = false;
  }
  quizEl.addEventListener('click', function (e) {
    var o = e.target.closest('.opt');
    if (o && !quiz.answered) {
      quiz.answered = true;
      var q = Content.QUIZ[quiz.i], k = +o.dataset.k, ok = k === q.c;
      if (ok) quiz.score++;
      $$('.opt', quizEl).forEach(function (b) {
        b.disabled = true;
        if (+b.dataset.k === q.c) b.classList.add('correct');
        else if (b === o) b.classList.add('wrong');
      });
      var fb = $('#quiz-fb'); fb.hidden = false; fb.className = 'quiz-fb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = '<strong>' + (ok ? '✓ Correct!' : '✗ Not quite.') + '</strong> ' + esc(q.why);
      $('#quiz-next').hidden = false; $('#quiz-next').focus();
      return;
    }
    if (e.target.closest('#quiz-next')) { quiz.i++; renderQuiz(); var f = $('.quiz-q') || $('#quiz-restart'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } }
    if (e.target.closest('#quiz-restart')) { quiz = { i: 0, score: 0, answered: false }; renderQuiz(); }
  });
  renderQuiz();


  /* ============================================================ VALUES PANEL */
  var valEls = {};
  $$('#values-grid .val').forEach(function (v) { valEls[v.dataset.k] = $('strong', v); });
  /** Fill the values panel. Uses the SAME physics functions as the animation, calculator and audio. */
  function updateValues() {
    var e = sim.effective(), r = Phys.compute(e);
    if (!r.valid) return;
    var d = Phys.describe(e, r), still = e.vs === 0, set = function (k, t) { if (valEls[k].textContent !== t) valEls[k].textContent = t; };
    set('f', Phys.num(e.f) + ' Hz');
    set('fobs', Phys.fix(r.fObs, 1) + ' Hz');
    set('v', Phys.num(e.v) + ' m/s');
    set('vs', Phys.num(e.vs) + ' m/s');
    set('vL', Phys.num(e.vL) + ' m/s');
    set('lam', Phys.fix(r.lambda, 3) + ' m');
    set('lamF', Phys.fix(r.lambdaFront, 3) + ' m' + (still ? ' (= \u03BB, all directions)' : ''));
    set('lamB', Phys.fix(r.lambdaBehind, 3) + ' m' + (still ? ' (= \u03BB, all directions)' : ''));
    set('lamObs', Phys.fix(r.lambdaObs, 3) + ' m' + (still ? ' (= \u03BB, unchanged)' : ''));
    set('df', Phys.signed(r.df, 1) + ' Hz');
    set('dlam', Phys.signed(r.dLambda, 3) + ' m');
    set('pct', Phys.signed(r.pct, 2) + ' %  ' + (r.df > 0.05 ? '\u25B2' : (r.df < -0.05 ? '\u25BC' : '=')));
    set('src', d.source);
    set('lis', d.listener);
    set('formula', Phys.formulaText(e.mode, e.srcDir, e.listDir) + '   \u2192   ' + Phys.formulaNumeric(e.mode, e.srcDir, e.listDir, e, r) + ' = ' + Phys.fix(r.fObs, 1) + ' Hz');
    set('cond', d.condition);
  }

  /* ============================================================== LIVE READOUT */
  function updateLive() {
    var e = sim.effective(), r = Phys.compute(e);
    if (!r.valid) return;
    $('#live-fobs').textContent = Phys.fix(r.fObs, 1) + ' Hz';
    var p = $('#live-pitch');
    p.textContent = r.df > 0.05 ? '▲ higher than f' : (r.df < -0.05 ? '▼ lower than f' : '= same as f');
    p.className = r.df > 0.05 ? 'green' : (r.df < -0.05 ? 'red' : '');
    var m = sim.measuredFreq(); $('#live-meas').textContent = m ? m.toFixed(1) + ' Hz' : (sim.playing ? 'measuring…' : '–');
    $('#live-hits').textContent = sim.hitCount;
    canvas.setAttribute('aria-label', 'Doppler effect scene. ' + Phys.scenarioLabel(e.mode, e.srcDir, e.listDir).caseText + '. Observed frequency ' + Phys.fix(r.fObs, 1) + ' hertz.');
  }

  /** The values come from the REAL movement of the objects, so when you drag them everything follows. */
  var lastKey = '';
  function liveSync() {
    var e = sim.effective(), key = [e.mode, e.f, e.v, e.vs, e.vL, e.srcDir, e.listDir].join('|');
    if (key === lastKey) return;
    lastKey = key;
    var lab = Phys.liveLabel(e);
    $('#scene-title').textContent = lab.title + ' \u2022 ' + lab.caseText;
    $('#scene-text').textContent = Phys.explanation(e.mode, e.srcDir, e.listDir, e);
    syncCalcFromSim(); updateValues();
  }

  /* ============================================================ DRAG CONTROL */
  /** Pointer position -> logical scene coordinates (1600 x 800). */
  function toScene(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * Eng.LAYOUT.w, y: (ev.clientY - r.top) / r.height * Eng.LAYOUT.h };
  }
  var drag = null, selected = 'lis';
  function endDrag() { if (drag) { sim.release(drag.which); drag = null; canvas.style.cursor = ''; } }
  canvas.addEventListener('pointerdown', function (ev) {
    var p = toScene(ev), hit = scene.hitTest(p.x, p.y);
    if (!hit) return;
    if (!sim.canMove(hit)) { toast(hit === 'src' ? 'In this mode the source is stationary \u2014 drag the listener' : 'In this mode the listener is stationary \u2014 drag the source'); return; }
    if (!sim.playing) setPlaying(true);                       // grabbing an object resumes the simulation
    if (sim.maxSpeed(hit) <= 0) toast('Raise the max speed slider \u2014 it is 0 m/s');
    ev.preventDefault();
    drag = { which: hit, id: ev.pointerId, off: sim[hit].x - p.x };
    selected = hit; scene.touched = true; sim.grab(hit); sim.setTarget(hit, p.x + drag.off);
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    canvas.style.cursor = 'grabbing'; canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', function (ev) {
    var p = toScene(ev);
    if (drag && ev.pointerId === drag.id) { sim.setTarget(drag.which, p.x + drag.off); return; }
    var h = scene.hitTest(p.x, p.y); scene.hover = h;
    canvas.style.cursor = h && sim.canMove(h) ? 'grab' : '';
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { canvas.addEventListener(n, endDrag); });
  canvas.addEventListener('pointerleave', function () { if (!drag) { scene.hover = null; canvas.style.cursor = ''; } });
  /** Keyboard: Tab to the scene, then \u2190 / \u2192 move the selected object, Tab-free switch with 1 (source) / 2 (listener). */
  canvas.addEventListener('keydown', function (ev) {
    if (ev.key === '1' && sim.canMove('src')) { selected = 'src'; toast('Source selected'); return; }
    if (ev.key === '2' && sim.canMove('lis')) { selected = 'lis'; toast('Listener selected'); return; }
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    var w = sim.canMove(selected) ? selected : (sim.canMove('lis') ? 'lis' : 'src');
    ev.preventDefault(); if (!sim.playing) setPlaying(true);
    scene.touched = true; sim.setTarget(w, sim[w].goal + (ev.key === 'ArrowLeft' ? -120 : 120));
  });
  canvas.addEventListener('keyup', function (ev) { if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { sim.release('src'); sim.release('lis'); } });

  /* ============================================================== MAIN LOOP */
  var last = performance.now(), acc = 0, running = false;
  function frame(ts) {
    var dt = Math.min(0.1, Math.max(0, (ts - last) / 1000)); last = ts;
    sim.update(dt);
    scene.render();
    acc += dt;
    if (acc > 0.1) { acc = 0; liveSync(); updateLive(); syncAudio(false); }
    requestAnimationFrame(frame);
  }
  function startLoop() { if (running) return; running = true; requestAnimationFrame(function (t) { last = t; frame(t); }); }

  /* ================================================================ KEYBOARD */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('presentation')) { setPresentation(false); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input,select,textarea,button,a,[contenteditable]')) return;
    var k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setPlaying(!sim.playing); }
    else if (k === 'r') { sim.softReset(); setPlaying(false); }
    else if (k === 'f') toggleFullscreen();
    else if (k === 'p') setPresentation(!document.body.classList.contains('presentation'));
    else if (k === 's') { Audio.playing ? stopSound() : startSound(); }
    else if (k === 'm') { Audio.setMuted(!Audio.muted); updateAudioUI(); }
    else if (k === 't') setTheme(document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ================================================================= START */
  $('#scale-note').textContent = '1 m = ' + Eng.PX_PER_M + ' px \u00B7 slow-motion \u00D7' + Eng.SLOW;
  refreshScenarioUI();
  updateLive();
  startLoop();
  window.DopplerApp = { sim: sim, scene: scene, setPlaying: setPlaying };   // handle used by the automated tests / console
  playIntro();
})();