/* ==========================================================================
   scene.js — Canvas renderer for the 2D side-view scene.
   Draw order: background -> sine wave -> dotted guides -> car & person -> name tags ->
               fixed info panel (V, V', f, f', wavelength rulers) -> formula banner -> data panel.
   Logical canvas is 1600 × 800 and is scaled to the real canvas size.
   ========================================================================== */
(function (root) {
  'use strict';
  var Phys = root.DopplerPhysics, Eng = root.DopplerEngine, L = Eng.LAYOUT, S = Phys.SYMBOLS;
  var PRIME = S.PRIME, LAM = S.LAMBDA, DEL = S.DELTA;

  var COL = {
    wave: '#22d3ee', waveBlue: '#2563eb', purple: '#b794ff', yellow: '#fde047', green: '#4ade80',
    red: '#ff6b70', blue: '#66b3ff', white: '#ffffff', muted: '#b6c6e3', teal: '#5eead4', pill: 'rgba(6,16,42,0.88)'
  };
  var FONT = '"Segoe UI Variable Display","Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif';
  function font(px, w) { return (w || 600) + ' ' + px + 'px ' + FONT; }

  /* ---------- small drawing helpers ---------- */
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function arrowHead(c, x, y, dir, size) {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - dir * size, y - size * 0.62); c.lineTo(x - dir * size, y + size * 0.62); c.closePath(); c.fill();
  }
  /** Rich text segments [[text,color],...]; returns total width. */
  function richWidth(c, segs, fnt) { c.font = fnt; var w = 0; segs.forEach(function (s) { w += c.measureText(s[0]).width; }); return w; }
  function richText(c, segs, x, y, fnt, align) {
    var w = richWidth(c, segs, fnt), cx = align === 'center' ? x - w / 2 : (align === 'right' ? x - w : x);
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = fnt;
    segs.forEach(function (s) { c.fillStyle = s[1]; c.fillText(s[0], cx, y); cx += c.measureText(s[0]).width; });
    return w;
  }
  /** Dark rounded label with coloured text (readable on any background). */
  function pill(c, segs, x, y, o) {
    o = o || {}; var fs = o.size || 24, fnt = font(fs, 700), pad = o.pad || 14;
    var w = richWidth(c, segs, fnt) + pad * 2, h = fs + 16, bx = o.align === 'left' ? x : (o.align === 'right' ? x - w : x - w / 2);
    c.save();
    if (o.alpha != null) c.globalAlpha *= o.alpha;
    rr(c, bx, y - h / 2, w, h, h / 2); c.fillStyle = COL.pill; c.fill();
    c.lineWidth = 1.6; c.strokeStyle = o.border || 'rgba(160,190,235,0.45)'; c.stroke();
    richText(c, segs, bx + pad, y + 1, fnt, 'left');
    c.restore();
    return { x: bx, w: w, h: h };
  }

  /* ====================================================================== */
  function Scene(canvas, sim, assets) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.sim = sim; this.assets = assets || {};
    this.bg = null; this.scale = 1; this.dpr = 1;
    this.bobS = 0; this.bobL = 0;             // eased walking / suspension movement (0..1)
    this.hover = null; this.touched = false;  // pointer hover / has the user dragged anything yet
    this.resize();
  }

  Scene.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = Math.max(320, Math.round(r.width * dpr)), h = Math.round(w * L.h / L.w);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.scale = w / L.w; this.dpr = dpr;
    this.bg = null;                           // rebuild cached background
  };

  /* ---------------- background (cached) ---------------- */
  Scene.prototype._img = function (key) {
    var im = this.assets[key];
    return im && im.complete && im.naturalWidth > 0 ? im : null;
  };

  Scene.prototype._buildBackground = function () {
    var cv = document.createElement('canvas'); cv.width = this.cv.width; cv.height = this.cv.height;
    var c = cv.getContext('2d'); c.scale(this.scale, this.scale);
    var userBg = this._img('bg');
    if (userBg) { c.drawImage(userBg, 0, 0, L.w, L.h); this.bg = cv; return; }

    var W = L.w, H = L.h, g;
    // sky
    g = c.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#6cc2f2'); g.addColorStop(0.6, '#a9dcf8'); g.addColorStop(1, '#dff3fd');
    c.fillStyle = g; c.fillRect(0, 0, W, 420);
    g = c.createRadialGradient(1380, 70, 10, 1380, 70, 360); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, 420);
    // clouds
    function cloud(x, y, s) {
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = 'rgba(70,130,190,0.10)'; c.beginPath(); c.ellipse(0, 26, 120, 14, 0, 0, 6.3); c.fill();
      c.fillStyle = '#fff'; c.beginPath();
      c.arc(-70, 10, 32, 0, 6.3); c.arc(-30, -8, 44, 0, 6.3); c.arc(26, -14, 52, 0, 6.3); c.arc(76, 8, 36, 0, 6.3);
      c.rect(-70, 10, 146, 28); c.fill();
      c.restore();
    }
    cloud(190, 260, 0.9); cloud(560, 330, 0.7); cloud(900, 250, 1.0); cloud(1250, 330, 0.75); cloud(1500, 235, 0.65); cloud(60, 340, 0.5);
    // distant hills
    c.fillStyle = '#a5dcb8'; c.beginPath(); c.moveTo(0, 360);
    for (var x = 0; x <= W; x += 40) c.lineTo(x, 330 + Math.sin(x / 210) * 26 + Math.sin(x / 83) * 8);
    c.lineTo(W, 420); c.lineTo(0, 420); c.fill();
    c.fillStyle = '#82cf9d'; c.beginPath(); c.moveTo(0, 380);
    for (x = 0; x <= W; x += 40) c.lineTo(x, 362 + Math.sin(x / 150 + 1.2) * 20 + Math.sin(x / 61) * 6);
    c.lineTo(W, 420); c.lineTo(0, 420); c.fill();
    // trees along the roadside
    function tree(x, y, s) {
      c.fillStyle = '#7a5538'; c.fillRect(x - 5 * s, y - 36 * s, 10 * s, 38 * s);
      c.fillStyle = '#2f9e57'; c.beginPath(); c.arc(x, y - 62 * s, 30 * s, 0, 6.3); c.arc(x - 22 * s, y - 44 * s, 22 * s, 0, 6.3); c.arc(x + 22 * s, y - 44 * s, 22 * s, 0, 6.3); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.beginPath(); c.arc(x - 8 * s, y - 70 * s, 14 * s, 0, 6.3); c.fill();
    }
    [90, 330, 560, 760, 990, 1190, 1420, 1560].forEach(function (tx, i) { tree(tx, 404, 0.8 + (i % 3) * 0.12); });
    // grass strip
    g = c.createLinearGradient(0, 380, 0, 420); g.addColorStop(0, '#5cc673'); g.addColorStop(1, '#3fa65a');
    c.fillStyle = g; c.fillRect(0, 392, W, 30);
    // road
    g = c.createLinearGradient(0, L.roadTop, 0, L.roadBottom); g.addColorStop(0, '#5a6372'); g.addColorStop(1, '#3d4552');
    c.fillStyle = g; c.fillRect(0, L.roadTop, W, L.roadBottom - L.roadTop);
    c.fillStyle = '#e8edf4'; c.fillRect(0, L.roadTop + 10, W, 5); c.fillRect(0, L.roadBottom - 15, W, 5);
    c.fillStyle = '#f5f7fa';
    for (x = -20; x < W; x += 120) c.fillRect(x, 462, 66, 6);                 // dashed lane marking (kept away from the wave axis)
    c.fillStyle = 'rgba(255,255,255,0.05)'; for (x = 0; x < W; x += 7) c.fillRect(x, L.roadTop + 20 + (x * 13 % 150), 3, 2);
    // curb + sidewalk
    c.fillStyle = '#aeb8c6'; c.fillRect(0, L.roadBottom, W, 12);
    c.fillStyle = '#e3e8ef'; c.fillRect(0, L.roadBottom, W, 4);
    g = c.createLinearGradient(0, L.roadBottom + 12, 0, L.sidewalkBottom); g.addColorStop(0, '#d9dee6'); g.addColorStop(1, '#c4ccd8');
    c.fillStyle = g; c.fillRect(0, L.roadBottom + 12, W, L.sidewalkBottom - L.roadBottom - 12);
    c.strokeStyle = 'rgba(90,105,130,0.28)'; c.lineWidth = 2;
    for (x = 20; x < W; x += 110) { c.beginPath(); c.moveTo(x, L.roadBottom + 12); c.lineTo(x - 14, L.sidewalkBottom); c.stroke(); }
    // foreground grass (sits behind the data panel)
    g = c.createLinearGradient(0, L.sidewalkBottom, 0, H); g.addColorStop(0, '#4cb866'); g.addColorStop(1, '#2d7d47');
    c.fillStyle = g; c.fillRect(0, L.sidewalkBottom, W, H - L.sidewalkBottom);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, L.sidewalkBottom, W, 5);
    this.bg = cv;
  };

  /* ---------------- sprites ---------------- */
  Scene.prototype._sprite = function (key, cx, bottom, size, flip, alpha, bob, label) {
    var c = this.c, im = this._img(key), w, h;
    c.save(); c.globalAlpha *= alpha; c.translate(cx, bottom + bob);
    if (flip) c.scale(-1, 1);
    if (im) {
      if (key === 'car') { w = L.carWidth; h = w * im.naturalHeight / im.naturalWidth; }
      else { h = L.personHeight; w = h * im.naturalWidth / im.naturalHeight; }
      c.drawImage(im, -w / 2, -h, w, h);
    } else {                                   // "NO IMAGE" placeholder (replace the image in index.html)
      w = key === 'car' ? L.carWidth : 96; h = key === 'car' ? 162 : L.personHeight;
      c.setLineDash([12, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.fillStyle = 'rgba(20,40,80,0.35)';
      rr(c, -w / 2, -h, w, h, 14); c.fill(); c.stroke(); c.setLineDash([]);
      if (flip) c.scale(-1, 1);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = font(key === 'car' ? 34 : 22, 800); c.fillText('NO IMAGE', 0, -h / 2 - 12);
      c.font = font(key === 'car' ? 18 : 13, 500); c.fillStyle = '#cfe3ff'; c.fillText(label, 0, -h / 2 + 18);
    }
    c.restore();
    return { w: w, h: h };
  };

  /* ---------------- the sine wave ---------------- */
  /**
   * The wave is a sine wave DRAWN THROUGH THE REAL WAVEFRONTS: every wavefront that crosses the line
   * of sight is a crest, and between two crests the curve is one exact cosine period. So the crests
   * are pushed together in front of a moving source (λ front) and pulled apart behind it (λ behind).
   * A stationary source gives a perfectly regular wave. A moving listener never changes the shape.
   */
  Scene.prototype._wavePoints = function (side) {
    var sim = this.sim, ws = sim.waves, sx = sim.src.x, T = Eng.SLOW / sim.config.f;
    var pts = [{ x: sx, phi: Math.min(1, sim.emitAcc / T) }], k = 0, last = sx, i, cx;
    for (i = ws.length - 1; i >= 0; i--) {
      cx = ws[i].x + side * ws[i].r;
      if (side * (cx - last) <= 0.01) continue;                 // keep the crests strictly ordered
      pts.push({ x: cx, phi: -k }); k++; last = cx;
      if (side * (cx - sx) > 1700) break;
    }
    return pts;
  };

  /** y of the wave at x for a list of crest points; also returns the phase. */
  Scene.prototype._waveTrace = function (pts, side, xEnd, envFn, fade) {
    var c = this.c, Y = L.waveY, A = L.waveAmp * fade, j = 0, x, y, phi, t, a, b, started = false, step = 2;
    var sx = pts[0].x, n = Math.ceil(Math.abs(xEnd - sx) / step), i;
    c.beginPath();
    for (i = 0; i <= n; i++) {
      x = sx + side * Math.min(i * step, Math.abs(xEnd - sx));
      while (j < pts.length - 2 && side * (x - pts[j + 1].x) > 0) j++;
      a = pts[j]; b = pts[Math.min(j + 1, pts.length - 1)];
      t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x); t = Math.max(0, Math.min(1, t));
      phi = a.phi + (b.phi - a.phi) * t;
      y = Y - A * envFn(Math.abs(x - sx)) * Math.cos(6.2831853 * phi);
      if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
    }
  };

  Scene.prototype._drawWave = function (e, fade) {
    var c = this.c, sim = this.sim, sx = sim.src.x, lx = sim.lis.x, Y = L.waveY;
    var right = this._wavePoints(1);
    var inEnv = function (d) { var t = Math.min(1, d / 60); return t * t * (3 - 2 * t); };
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    // the wave lives ONLY between the source and the listener
    c.setLineDash([4, 10]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,' + (0.55 * fade).toFixed(2) + ')';
    c.beginPath(); c.moveTo(sx, Y); c.lineTo(lx, Y); c.stroke(); c.setLineDash([]);
    this._waveTrace(right, 1, lx, inEnv, fade);
    c.strokeStyle = 'rgba(255,255,255,' + (0.6 * fade).toFixed(2) + ')'; c.lineWidth = 13; c.stroke();
    c.strokeStyle = 'rgba(29,78,216,' + fade.toFixed(2) + ')'; c.lineWidth = 7; c.stroke();
    c.strokeStyle = 'rgba(96,200,255,' + (0.9 * fade).toFixed(2) + ')'; c.lineWidth = 2.2; c.stroke();
    c.restore();
  };

  /* ---------------- static information panel ---------------- */
  /**
   * Everything in this panel sits at FIXED screen positions. Nothing here travels with the waves
   * or with the objects: only the numbers change when the physics changes.
   */
  Scene.prototype._info = function (e, r, fade) {
    var c = this.c, W = L.w, V = e.v, dirTxt, vp, vpTxt, len;
    c.save(); c.globalAlpha *= fade;

    // --- left block: wave speed V, source, original frequency
    pill(c, [['V = ', '#fff'], [Phys.num(V) + ' m/s', COL.red]], 50, 160, { align: 'left', size: 24, border: COL.red });
    c.strokeStyle = COL.red; c.fillStyle = COL.red; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(50, 200); c.lineTo(310, 200); c.stroke(); arrowHead(c, 336, 200, 1, 24);
    pill(c, [['Source  ', '#fff'], [e.vs > 0 ? 'vs = ' + Phys.num(e.vs) + ' m/s ' + (e.srcDir > 0 ? '→' : '←') : 'at rest', COL.red]],
         50, 252, { align: 'left', size: 22, border: COL.red });
    pill(c, [['f = ', '#fff'], [Phys.num(e.f) + ' Hz', '#9be8ff']], 50, 302, { align: 'left', size: 22, border: '#9be8ff' });

    // --- right block: V', listener, observed frequency
    vp = e.vL > 0 ? e.v + (e.listDir > 0 ? 1 : -1) * e.vL : e.v;
    vpTxt = e.vL > 0 ? 'V' + PRIME + ' = V ' + (e.listDir > 0 ? '+' : S.MINUS) + ' vL = ' + Phys.num(vp) + ' m/s' : 'V' + PRIME + ' = V = ' + Phys.num(vp) + ' m/s';
    pill(c, [[vpTxt, '#ffb35c']], W - 50, 160, { align: 'right', size: 24, border: '#ffb35c' });
    len = Math.max(60, 260 * vp / V);
    c.strokeStyle = '#ff9f3d'; c.fillStyle = '#ff9f3d'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(W - 50 - len - 26, 200); c.lineTo(W - 50 - 26, 200); c.stroke(); arrowHead(c, W - 50, 200, 1, 24);
    pill(c, [['Listener  ', '#fff'], [e.vL > 0 ? 'vL = ' + Phys.num(e.vL) + ' m/s ' + (e.listDir > 0 ? '←' : '→') : 'at rest', COL.blue]],
         W - 50, 252, { align: 'right', size: 22, border: COL.blue });
    pill(c, [['f' + PRIME + ' = ', '#fff'], [Phys.fix(r.fObs, 1) + ' Hz', COL.green]], W - 50, 302, { align: 'right', size: 22, border: COL.green });

    // --- centre: two fixed wavelength rulers (length = real wavelength on screen)
    this._ruler(800, 226, r.lambda * Eng.PX_PER_M, LAM + ' = ' + Phys.fix(r.lambda, 3) + ' m', COL.purple);
    this._ruler(800, 288, r.lambdaObs * Eng.PX_PER_M, LAM + PRIME + ' = ' + Phys.fix(r.lambdaObs, 3) + ' m', COL.yellow);
    c.font = font(21, 700); c.fillStyle = '#0b2f66'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = 6; c.fillText('Sound wave', 800, 326); c.shadowBlur = 0;
    c.restore();
  };

  Scene.prototype._ruler = function (cx, y, len, text, col) {
    var c = this.c, a = cx - len / 2, b = cx + len / 2, hs = 9;
    c.save();
    pill(c, [[text, col]], cx, y - 27, { size: 20, border: col });
    c.shadowColor = 'rgba(2,8,28,0.8)'; c.shadowBlur = 4;
    c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(a, y - 9); c.lineTo(a, y + 9); c.moveTo(b, y - 9); c.lineTo(b, y + 9); c.stroke();
    if (len > 34) {
      c.beginPath(); c.moveTo(a + hs * 0.6, y); c.lineTo(b - hs * 0.6, y); c.stroke();
      arrowHead(c, a, y, -1, hs); arrowHead(c, b, y, 1, hs);
    } else {
      c.beginPath(); c.moveTo(a - 18, y); c.lineTo(a, y); c.moveTo(b, y); c.lineTo(b + 18, y); c.stroke();
      arrowHead(c, a, y, 1, hs); arrowHead(c, b, y, -1, hs);
    }
    c.restore();
  };

  /* ---------------- name tags, dotted guides, hit testing ---------------- */
  Scene.prototype.hitTest = function (x, y) {
    var s = this.sim, car = { x0: s.src.x - L.carWidth / 2, x1: s.src.x + L.carWidth / 2, y0: L.carBottom - 175, y1: L.carBottom + 8 };
    var per = { x0: s.lis.x - 62, x1: s.lis.x + 62, y0: L.personFeet - L.personHeight - 10, y1: L.personFeet + 8 };
    if (x >= per.x0 && x <= per.x1 && y >= per.y0 && y <= per.y1) return 'lis';
    if (x >= car.x0 && x <= car.x1 && y >= car.y0 && y <= car.y1) return 'src';
    return null;
  };

  Scene.prototype._ring = function (box, col, alpha) {
    var c = this.c;
    c.save(); c.globalAlpha *= alpha; c.setLineDash([14, 9]); c.lineWidth = 3.5; c.strokeStyle = col;
    c.shadowColor = col; c.shadowBlur = 16; rr(c, box[0], box[1], box[2], box[3], 18); c.stroke(); c.restore();
  };

  Scene.prototype._guides = function (fade) {
    var c = this.c, s = this.sim, Y = L.waveY;
    c.save(); c.globalAlpha *= fade; c.setLineDash([3, 8]); c.lineWidth = 2.5; c.lineCap = 'round';
    c.strokeStyle = 'rgba(10,45,100,0.8)';
    c.beginPath(); c.moveTo(s.src.x, Y + 10); c.lineTo(s.src.x, L.carBottom - 170); c.stroke();
    c.beginPath(); c.moveTo(s.lis.x, Y + 10); c.lineTo(s.lis.x, L.personFeet - L.personHeight - 14); c.stroke();
    c.restore();
  };

  /* ---------------- main render ---------------- */
  Scene.prototype.render = function () {
    var c = this.c, sim = this.sim, e = sim.effective(), r = Phys.compute(e);
    if (!this.bg || this.bg.width !== this.cv.width) this._buildBackground();
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this.bg, 0, 0);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    var fade = sim.alpha;
    var srcMoves = Math.abs(sim.src.sm) / Eng.K >= 0.5, lisMoves = Math.abs(sim.lis.sm) / Eng.K >= 0.5;
    var carFlip = srcMoves && sim.src.sm < 0;                          // the car faces its direction of travel
    var perFlip = !(lisMoves && sim.lis.sm > 0);                        // the person faces the car unless walking away
    this.bobS += ((srcMoves ? 1 : 0) - this.bobS) * 0.15;
    this.bobL += ((lisMoves ? 1 : 0) - this.bobL) * 0.15;
    var bounce = Math.sin(sim.walk * 9);

    this._drawWave(e, fade);
    this._guides(fade);

    var sbox = [sim.src.x - L.carWidth / 2 - 8, L.carBottom - 178, L.carWidth + 16, 192];
    var lbox = [sim.lis.x - 66, L.personFeet - L.personHeight - 16, 132, L.personHeight + 30];
    if (sim.canMove('src') && (this.hover === 'src' || sim.src.grabbed)) this._ring(sbox, '#ff8a8e', fade);
    if (sim.canMove('lis') && (this.hover === 'lis' || sim.lis.grabbed)) this._ring(lbox, '#7cc0ff', fade);

    this._sprite('car', sim.src.x, L.carBottom, 0, carFlip, fade, bounce * 0.8 * this.bobS, 'assets/car/car.svg');
    this._sprite('person', sim.lis.x, L.personFeet, 0, perFlip, fade, -Math.abs(bounce) * 2.5 * this.bobL, 'assets/character/person.svg');

    // emitter dot on the wave at the source, receiver dot (+ green pulses) at the listener
    var Y = L.waveY;
    c.save(); c.globalAlpha *= fade;
    c.fillStyle = '#fff'; c.strokeStyle = COL.red; c.lineWidth = 4;
    c.beginPath(); c.arc(sim.src.x, Y, 9, 0, 6.3); c.fill(); c.stroke();
    c.strokeStyle = COL.green; c.beginPath(); c.arc(sim.lis.x, Y, 9, 0, 6.3); c.fill(); c.stroke();
    c.restore();
    sim.pulses.forEach(function (p) {
      var t = p.age / 0.45;
      c.strokeStyle = 'rgba(74,222,128,' + (0.9 * (1 - t) * fade).toFixed(3) + ')'; c.lineWidth = 5 * (1 - t) + 1;
      c.beginPath(); c.arc(sim.lis.x, Y, 14 + t * 40, 0, 6.2832); c.stroke();
    });

    // name tags + hints (follow the objects, they carry no values)
    this._nameTag(sim.src.x, L.carBottom + 44, 'SOURCE', COL.red, 'src', fade);
    this._nameTag(sim.lis.x, L.personFeet - L.personHeight - 30, 'LISTENER', COL.blue, 'lis', fade);

    if (r.valid) { this._info(e, r, fade); this._banner(e, r); this._hud(e, r); }
    if (!sim.playing) pill(c, [['PAUSED  ·  press Play, or just drag an object', '#ffffff']], L.w / 2, 148, { size: 20, alpha: 0.92 });
  };

  Scene.prototype._nameTag = function (cx, y, name, col, which, fade) {
    var c = this.c, can = this.sim.canMove(which), moving = which === 'src' ? this.sim.src.grabbed : this.sim.lis.grabbed;
    var hint = !can ? 'fixed' : (moving || this.touched ? '' : '◀ drag me ▶');
    var segs = [[name, '#ffffff']]; if (hint) segs.push(['   ' + hint, col]);
    pill(c, segs, cx, y, { size: 20, border: col, alpha: fade });
  };

  Scene.prototype._banner = function (e, r) {
    var c = this.c, lab = Phys.liveLabel(e);
    c.save();
    rr(c, 30, 14, L.w - 60, 100, 22); c.fillStyle = 'rgba(5,14,40,0.82)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(120,180,240,0.45)'; c.stroke();
    richText(c, [[lab.title, COL.teal], ['   •   ', COL.muted], [lab.caseText, '#ffffff']], L.w / 2, 40, font(24, 700), 'center');
    var segs = [[Phys.formulaNumeric(e.mode, e.srcDir, e.listDir, e, r), '#ffffff'], ['  =  ', COL.muted], [Phys.fix(r.fObs, 1) + ' Hz', COL.green]];
    richText(c, segs, L.w / 2, 82, font(38, 700), 'center');
    c.restore();
  };

  Scene.prototype._hud = function (e, r) {
    var c = this.c, y0 = 688, cols = 5, cw = (L.w - 60) / cols;
    c.save();
    rr(c, 30, y0 - 4, L.w - 60, 112, 20); c.fillStyle = 'rgba(5,14,40,0.86)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(120,180,240,0.4)'; c.stroke();
    var items = [
      ['Original Frequency', 'f = ' + Phys.num(e.f) + ' Hz', '#9be8ff'],
      ['Observed Frequency', 'f' + PRIME + ' = ' + Phys.fix(r.fObs, 1) + ' Hz', COL.green],
      ['Speed of Sound', 'v = ' + Phys.num(e.v) + ' m/s', '#e8eefc'],
      ['Source Velocity', 'vs = ' + Phys.num(e.vs) + ' m/s', COL.red],
      ['Listener Velocity', 'vL = ' + Phys.num(e.vL) + ' m/s', COL.blue],
      ['Original Wavelength', LAM + ' = ' + Phys.fix(r.lambda, 3) + ' m', COL.purple],
      ['Observed Wavelength', LAM + PRIME + ' = ' + Phys.fix(r.lambdaObs, 3) + ' m', COL.teal],
      ['Wavelength Difference', DEL + LAM + ' = ' + Phys.signed(r.dLambda, 3) + ' m', COL.yellow],
      ['Frequency Difference', DEL + 'f = ' + Phys.signed(r.df, 1) + ' Hz', '#86efac'],
      ['Pitch Change', Phys.signed(r.pct, 2) + ' %  ' + (r.df > 0.05 ? '▲' : (r.df < -0.05 ? '▼' : '=')), r.df > 0.05 ? COL.green : (r.df < -0.05 ? COL.red : '#e8eefc')]
    ];
    items.forEach(function (it, i) {
      var col = i % cols, row = Math.floor(i / cols), x = 50 + col * cw, y = y0 + 12 + row * 52;
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.font = font(14, 600); c.fillStyle = COL.muted; c.fillText(it[0].toUpperCase(), x, y);
      c.font = font(25, 800); c.fillStyle = it[2]; c.fillText(it[1], x, y + 23);
    });
    c.restore();
  };

  root.DopplerScene = { Scene: Scene };
})(typeof self !== 'undefined' ? self : this);
