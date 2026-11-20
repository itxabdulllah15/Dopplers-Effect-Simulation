/* ==========================================================================
   engine.js — Simulation state + wavefront engine (no DOM, no drawing).

   CONTROL: nothing moves by itself. The source (car) and the listener (person) move ONLY
   while the user drags them. Each object chases the pointer at a limited speed
   (the "max speed" sliders), so the speed you see is a real, known speed in m/s.
   Let go and the object stops at once -> its velocity is 0 again.

   HOW THE WAVEFRONTS WORK (physically meaningful, not "resized circles"):
   - Every 1/f_visual seconds the source EMITS a wavefront at its CURRENT position.
   - Each wavefront stores its own emission point (x) and a radius r that grows
     at the speed of sound:  r += v × dt.
   - If the source is dragged, successive wavefronts have different centres, so the spacing
     in front of / behind the source changes by itself:
         ahead of the source  :  λ_front  = (v − vs)/f   (compressed)
         behind the source    :  λ_behind = (v + vs)/f   (stretched)
   - The listener NEVER changes the wavefronts; it only meets them more / less often.
   - The renderer draws the sine wave THROUGH these real wavefront positions.

   SCALE: 1 metre = 110 px and time is slowed ×SLOW so the wave can be seen.
          => every velocity in px/s is  (m/s) × K  with K = 110/SLOW.
   ========================================================================== */
(function (root) {
  'use strict';
  var Phys = root.DopplerPhysics;

  var PX_PER_M = 110, SLOW = 130, K = PX_PER_M / SLOW;

  /** Shared layout (logical canvas is 1600 × 800). */
  var LAYOUT = {
    w: 1600, h: 800,
    roadTop: 410, roadBottom: 610, sidewalkBottom: 682,
    axisY: 505,                 // ear height (green pulse / hit marker is drawn on the wave line)
    waveY: 372,                 // centre line of the sine wave (sky, above car and person)
    waveAmp: 30,
    carBottom: 640, carWidth: 500,
    sourceTagY: 629,            // fixed height of the "SOURCE" tag under the car (does NOT follow carBottom)
    personFeet: 600, personHeight: 200,
    minX: 260, maxX: 1500, minGap: 330, maxGap: 1240,
    srcStart: 400, lisStart: 1300
  };

  var SUBSTEP = 1 / 240;       // fixed physics step (s)
  var MAX_R = 1500;            // wavefronts are removed beyond this radius (px)
  var FADE_OUT = 0.35, FADE_IN = 0.45;
  var SMOOTH = 0.06;           // seconds: smoothing of the displayed speed
  var MIN_SHOWN = 0.4;         // below this (m/s) an object counts as stationary

  function Obj(x) { return { x: x, goal: x, sm: 0, dir: 1, grabbed: false }; }

  function Simulation() {
    this.config = { mode: 'A', f: 440, v: 343, vs: 80, vL: 80 };   // vs / vL = MAX speeds reachable by dragging
    this.speed = 1;
    this.playing = true;
    this.src = Obj(LAYOUT.srcStart);
    this.lis = Obj(LAYOUT.lisStart);
    this.walk = 0;             // phase for walking / bounce animation
    this.phase = 'run';        // 'run' | 'out' | 'in'
    this.alpha = 1;            // visibility during mode changes / reset
    this.pending = null;
    this.reset();
  }

  Simulation.prototype.canMove = function (which) {
    var m = this.config.mode;
    return which === 'src' ? m !== 'A' : m !== 'B';
  };
  Simulation.prototype.maxSpeed = function (which) { return which === 'src' ? this.config.vs : this.config.vL; };

  /** Current physical parameters, taken from the REAL movement of the two objects. */
  Simulation.prototype.effective = function () {
    var c = this.config, s = Math.abs(this.src.sm) / K, l = Math.abs(this.lis.sm) / K;
    var vs = (c.mode === 'A' || s < MIN_SHOWN) ? 0 : Math.round(s);
    var vL = (c.mode === 'B' || l < MIN_SHOWN) ? 0 : Math.round(l);
    if (vs === 0 && s >= MIN_SHOWN && c.mode !== 'A') vs = 1;     // never display 0 while it visibly moves
    if (vL === 0 && l >= MIN_SHOWN && c.mode !== 'B') vL = 1;
    return { mode: c.mode, f: c.f, v: c.v, vs: vs, vL: vL, srcDir: this.src.dir, listDir: this.lis.dir };
  };

  /** Change mode -> smooth transition to a fresh start. */
  Simulation.prototype.setScenario = function (s) {
    if (s.mode !== undefined && s.mode !== this.config.mode) { this.config.mode = s.mode; this.softReset(true); }
  };

  /** Change numeric parameters live (no reset: waves keep their history). */
  Simulation.prototype.setParams = function (p) {
    var c = this.config, L = Phys.LIMITS;
    ['f', 'v', 'vs', 'vL'].forEach(function (k) {
      if (p[k] !== undefined) c[k] = Phys.clamp(+p[k], L[k].min, L[k].max);
    });
  };

  /* ------------------------------------------------------------------ pointer control */
  Simulation.prototype._clampX = function (which, x) {
    var L = LAYOUT;
    if (which === 'src') return Math.max(L.minX, Math.min(this.lis.x - L.minGap, x));
    return Math.max(this.src.x + L.minGap, Math.min(L.maxX, x));
  };
  /** The user is dragging: the object chases x. */
  Simulation.prototype.setTarget = function (which, x) {
    if (!this.canMove(which)) return;
    var o = this[which]; o.goal = this._clampX(which, x);
  };
  Simulation.prototype.grab = function (which) { if (this.canMove(which)) this[which].grabbed = true; };
  /** Let go: the object stops where it is (velocity -> 0). */
  Simulation.prototype.release = function (which) { var o = this[which]; o.grabbed = false; o.goal = o.x; };

  /** Immediate rebuild of the simulated state (used internally, while invisible). */
  Simulation.prototype.reset = function () {
    var L = LAYOUT;
    this.src.x = this.src.goal = L.srcStart; this.lis.x = this.lis.goal = L.lisStart;
    this.src.sm = this.lis.sm = 0; this.src.dir = 1; this.lis.dir = 1; this.src.grabbed = this.lis.grabbed = false;
    this.waves = []; this.pulses = []; this.hitTimes = []; this.hitCount = 0;
    this.nextId = 1; this.time = 0;
    var T = SLOW / this.config.f, pre = (MAX_R + 60) / (this.config.v * K);
    this.emitAcc = T;                                      // emit immediately
    for (var t = 0; t < pre; t += SUBSTEP) this._step(SUBSTEP, false);
    this.time = 0; this.hitTimes = []; this.hitCount = 0; this.pulses = [];
  };

  /** Fade out, rebuild while invisible, fade in. */
  Simulation.prototype.softReset = function () {
    this.pending = function () { this.reset(); };
    this.phase = 'out';
  };

  /** Move one object towards its goal at a limited speed. Returns the displacement (px). */
  Simulation.prototype._chase = function (which, dt, live) {
    var o = this[which], cap = this.maxSpeed(which) * K, d = 0;
    if (live && this.canMove(which)) {
      var want = o.goal - o.x, lim = cap * dt;
      d = Math.max(-lim, Math.min(lim, want));
      if (Math.abs(want) < 1e-6) d = 0;
    }
    o.x += d;
    var rate = d / dt;
    o.sm += (rate - o.sm) * (1 - Math.exp(-dt / SMOOTH));
    if (Math.abs(o.sm) / K >= 0.5) {
      o.dir = which === 'src' ? (o.sm > 0 ? 1 : -1) : (o.sm < 0 ? 1 : -1);
    }
    return d;
  };

  /** One fixed physics step. */
  Simulation.prototype._step = function (dt, live) {
    var Vpx = this.config.v * K, T = SLOW / this.config.f, i, w;
    for (i = 0; i < this.waves.length; i++) this.waves[i].r += Vpx * dt;   // wavefronts expand at the speed of sound
    var ds = this._chase('src', dt, live);
    this._chase('lis', dt, live);
    // keep the gap legal if one object was dragged against the other
    if (this.lis.x - this.src.x < LAYOUT.minGap) {
      if (this.src.grabbed || this.src.goal !== this.src.x) this.src.x = this.lis.x - LAYOUT.minGap;
      else this.lis.x = this.src.x + LAYOUT.minGap;
    }
    this.time += dt;

    this.emitAcc += dt;
    while (this.emitAcc >= T) {                                           // emit from the CURRENT source position
      this.emitAcc -= T;
      this.waves.push({ id: this.nextId++, x: this.src.x - (ds / dt) * this.emitAcc, r: Vpx * this.emitAcc, hit: false });
    }

    for (i = 0; i < this.waves.length; i++) {                              // has the wavefront reached the listener?
      w = this.waves[i];
      if (!w.hit && this.lis.x - (w.x + w.r) <= 0) {
        w.hit = true;
        if (live) { this.hitCount++; this.hitTimes.push(this.time); this.pulses.push({ age: 0 }); }
      }
    }
    if (this.waves.length && this.waves[0].r > MAX_R) {
      this.waves = this.waves.filter(function (q) { return q.r <= MAX_R; });
    }
    if (this.hitTimes.length > 40) this.hitTimes.splice(0, this.hitTimes.length - 40);
  };

  /** Advance by real frame time (seconds). */
  Simulation.prototype.update = function (dtReal) {
    if (this.phase === 'out') {
      this.alpha = Math.max(0, this.alpha - dtReal / FADE_OUT);
      if (this.alpha <= 0) { var fn = this.pending; this.pending = null; if (fn) fn.call(this); this.phase = 'in'; }
    } else if (this.phase === 'in') {
      this.alpha = Math.min(1, this.alpha + dtReal / FADE_IN);
      if (this.alpha >= 1) this.phase = 'run';
    }
    for (var i = this.pulses.length - 1; i >= 0; i--) {
      this.pulses[i].age += dtReal;
      if (this.pulses[i].age > 0.45) this.pulses.splice(i, 1);
    }
    if (this.phase === 'out') return;
    if (!this.playing) {                                    // paused: everything is frozen, nothing moves
      this.src.sm = this.lis.sm = 0; this.src.goal = this.src.x; this.lis.goal = this.lis.x;
      return;
    }
    var dt = Math.min(dtReal, 0.1) * this.speed;
    if (!(dt > 1e-6)) return;
    this.walk += dtReal;
    var n = Math.max(1, Math.ceil(dt / SUBSTEP)), h = dt / n;
    for (var k = 0; k < n; k++) this._step(h, true);
  };

  /** Observed frequency measured from actual wavefront arrival times (Hz), or null. */
  Simulation.prototype.measuredFreq = function () {
    var h = this.hitTimes, n = Math.min(h.length, 10);
    if (n < 4 || this.time - h[h.length - 1] > 1.5 * SLOW / 55) return null;
    var span = h[h.length - 1] - h[h.length - n];
    return span > 0 ? (n - 1) / span * SLOW : null;
  };

  root.DopplerEngine = { Simulation: Simulation, LAYOUT: LAYOUT, PX_PER_M: PX_PER_M, SLOW: SLOW, K: K };
})(typeof self !== 'undefined' ? self : this);