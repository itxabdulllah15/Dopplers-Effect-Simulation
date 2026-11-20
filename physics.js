/* ==========================================================================
   physics.js — Pure Doppler-effect physics (no DOM access).
   The simulation, the calculator, the on-scene labels and the audio engine
   ALL use these functions, so every number in the app is consistent.

   Sign convention (used everywhere):
     srcDir  = +1  source moves TOWARDS the listener   (-vs in the denominator)
     srcDir  = -1  source moves AWAY from the listener (+vs in the denominator)
     listDir = +1  listener moves TOWARDS the source   (+vL in the numerator)
     listDir = -1  listener moves AWAY from the source (-vL in the numerator)

   General formula :  f' = f × (v + listDir·vL) / (v − srcDir·vs)
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.DopplerPhysics = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MINUS = '−', PRIME = '′', LAMBDA = 'λ', DELTA = 'Δ';

  /** Default values (also used by "Reset All"). */
  var DEFAULTS = { f: 440, v: 343, vs: 30, vL: 30 };

  /** Slider / input limits. vs and vL are always far below v => subsonic. */
  var LIMITS = {
    f:  { min: 100, max: 1000 },
    v:  { min: 200, max: 400 },
    vs: { min: 0,   max: 100 },
    vL: { min: 0,   max: 100 }
  };

  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  /** Trimmed number string: num(0.78950,4) -> "0.7895". Uses a true minus sign. */
  function num(x, d) {
    if (!isFinite(x)) return '–';
    var s = String(parseFloat(Number(x).toFixed(d == null ? 4 : d)));
    return s.replace('-', MINUS);
  }
  /** Fixed decimals with a true minus sign. */
  function fix(x, d) {
    if (!isFinite(x)) return '–';
    return Number(x).toFixed(d).replace('-', MINUS);
  }
  /** Fixed decimals with explicit + / − sign ("+42.2", "−0.068", "0"). */
  function signed(x, d) {
    if (!isFinite(x)) return '–';
    var r = Number(x.toFixed(d));
    if (r === 0) return fix(0, d).replace(/^[-−]/, '');
    return (r > 0 ? '+' : '') + fix(r, d);
  }

  /**
   * Core calculation.
   * p = { f, v, vs, vL, srcDir, listDir }   (vs, vL are speeds >= 0)
   */
  function compute(p) {
    var f = +p.f, v = +p.v, vs = Math.abs(+p.vs || 0), vL = Math.abs(+p.vL || 0);
    var srcDir = p.srcDir || 0, listDir = p.listDir || 0;
    var errors = [];

    if (!(f > 0)) errors.push('Original frequency f must be greater than 0 Hz.');
    if (!(v > 0)) errors.push('Speed of sound v must be greater than 0 m/s.');
    if (isFinite(v) && vs >= v) errors.push('Source velocity must stay below the speed of sound (subsonic only: vs < v).');
    if (isFinite(v) && vL >= v && listDir < 0) errors.push('A listener moving away must be slower than the speed of sound (vL < v).');

    var uS = srcDir * vs;          // source velocity component towards the listener
    var uL = listDir * vL;         // listener velocity component towards the source
    var out = { f: f, v: v, vs: vs, vL: vL, srcDir: srcDir, listDir: listDir, uS: uS, uL: uL,
                valid: errors.length === 0, errors: errors };
    if (!out.valid) return out;

    out.lambda    = v / f;                    // λ  = v/f
    out.lambdaFront  = (v - vs) / f;          // ahead of the source (direction of its motion): compressed
    out.lambdaBehind = (v + vs) / f;          // behind the source: stretched
    out.lambdaObs = (v - uS) / f;             // λ' = (v − uS)/f   (wavelength in the medium, listener side)
    out.fObs      = f * (v + uL) / (v - uS);  // f' = f (v + uL)/(v − uS)
    out.df        = out.fObs - f;             // Δf = f' − f
    out.dLambda   = out.lambdaObs - out.lambda;   // Δλ = λ' − λ
    out.pct       = (out.df / f) * 100;       // % change in frequency
    out.ratio     = out.fObs / f;
    return out;
  }

  /** Symbolic formula for the chosen situation. mode: 'A' | 'B' | 'C'. */
  function formulaText(mode, srcDir, listDir) {
    var hasL = mode !== 'B', hasS = mode !== 'A';
    var ns = listDir >= 0 ? '+' : MINUS;
    var ds = srcDir >= 0 ? MINUS : '+';
    var numr = hasL ? '(v ' + ns + ' vL)' : 'v';
    var denr = hasS ? '(v ' + ds + ' vs)' : 'v';
    return 'f' + PRIME + ' = f × ' + numr + ' / ' + denr;
  }

  /** Same formula with the numbers substituted (used directly on the scene). */
  function formulaNumeric(mode, srcDir, listDir, p, res) {
    var hasL = mode !== 'B', hasS = mode !== 'A';
    var ns = listDir >= 0 ? '+' : MINUS;
    var ds = srcDir >= 0 ? MINUS : '+';
    var numr = hasL ? '(' + num(p.v) + ' ' + ns + ' ' + num(p.vL) + ')' : num(p.v);
    var denr = hasS ? '(' + num(p.v) + ' ' + ds + ' ' + num(p.vs) + ')' : num(p.v);
    return 'f' + PRIME + ' = ' + num(p.f) + ' × ' + numr + ' / ' + denr;
  }

  /** Human readable title + case description. */
  function scenarioLabel(mode, srcDir, listDir) {
    if (mode === 'A') {
      return { title: 'STATIONARY SOURCE – MOVING LISTENER',
               caseText: listDir >= 0 ? 'Listener moving towards the source' : 'Listener moving away from the source' };
    }
    if (mode === 'B') {
      return { title: 'MOVING SOURCE – STATIONARY LISTENER',
               caseText: srcDir >= 0 ? 'Source moving towards the listener' : 'Source moving away from the listener' };
    }
    var rel = (srcDir > 0 && listDir > 0) ? 'Moving towards each other'
            : (srcDir < 0 && listDir < 0) ? 'Moving away from each other'
            : (srcDir > 0 ? 'Moving in the same direction (right →)' : 'Moving in the same direction (left ←)');
    return { title: 'MOVING SOURCE – MOVING LISTENER', caseText: rel };
  }

  /** Title + case text for what is happening RIGHT NOW (objects only move when dragged). */
  function liveLabel(e) {
    var b = scenarioLabel(e.mode, e.srcDir, e.listDir), s = e.vs > 0, l = e.vL > 0;
    if (!s && !l) {
      b.caseText = e.mode === 'A' ? 'Both at rest — drag the listener' : (e.mode === 'B' ? 'Both at rest — drag the source' : 'Both at rest — drag the source and / or the listener');
    } else if (e.mode === 'C' && s && !l) {
      b.caseText = e.srcDir > 0 ? 'Source moving towards the listener (listener at rest)' : 'Source moving away from the listener (listener at rest)';
    } else if (e.mode === 'C' && !s && l) {
      b.caseText = e.listDir > 0 ? 'Listener moving towards the source (source at rest)' : 'Listener moving away from the source (source at rest)';
    }
    return b;
  }

  /**
   * Movement directions + Doppler condition for the values panel.
   * e = effective {mode,f,v,vs,vL,srcDir,listDir}, r = compute(e).  The source is always on the LEFT.
   */
  function describe(e, r) {
    var srcMoves = e.vs > 0, lisMoves = e.vL > 0;
    var src = !srcMoves ? 'Stationary' : (e.srcDir > 0 ? 'Moving right → (towards the listener)' : 'Moving left ← (away from the listener)');
    var lis = !lisMoves ? 'Stationary' : (e.listDir > 0 ? 'Moving left ← (towards the source)' : 'Moving right → (away from the source)');
    var up = r.df > 0.05, down = r.df < -0.05, tail = up ? 'f′ > f — pitch rises.' : (down ? 'f′ < f — pitch falls.' : 'f′ = f — no Doppler shift.');
    var cond;
    if (!srcMoves && !lisMoves) {
      cond = 'Source and listener both stationary: no relative motion, so f′ = f (no Doppler shift).';
    } else if (srcMoves && !lisMoves) {
      cond = e.srcDir > 0
        ? 'Source approaching a stationary listener: wavefronts are compressed ahead of it (λ front < λ) and stretched behind it. ' + tail
        : 'Source moving away from a stationary listener: wavefronts toward the listener (behind the source) are stretched (λ behind > λ). ' + tail;
    } else if (!srcMoves && lisMoves) {
      cond = (e.listDir > 0
        ? 'Listener approaching a stationary source: the wavelength is unchanged, but the listener meets wavefronts more often. '
        : 'Listener moving away from a stationary source: the wavelength is unchanged, but the listener meets wavefronts less often. ') + tail;
    } else if (e.srcDir > 0 && e.listDir > 0) {
      cond = 'Source and listener moving towards each other: wavefronts are compressed AND met more often. ' + tail;
    } else if (e.srcDir < 0 && e.listDir < 0) {
      cond = 'Source and listener moving away from each other: wavefronts are stretched AND met less often. ' + tail;
    } else {
      var dir = e.srcDir > 0 ? 'right →' : 'left ←';
      var faster = e.srcDir > 0 ? (e.vs > e.vL ? 'the source is faster and closing the gap' : (e.vs < e.vL ? 'the listener is faster and increasing the gap' : 'both have the same speed'))
                                : (e.vs > e.vL ? 'the source is faster and increasing the gap' : (e.vs < e.vL ? 'the listener is faster and closing the gap' : 'both have the same speed'));
      cond = 'Source and listener moving in the same direction (' + dir + '): ' + faster + '. ' + tail;
    }
    return { source: src, listener: lis, condition: cond };
  }

  /** Short physics explanation shown under the scene. */
  function explanation(mode, srcDir, listDir, e) {
    if (e && e.vs === 0 && e.vL === 0) {
      return 'Nothing is moving: the source emits an equally spaced, regular sine wave, the listener meets them at the same rate they are emitted, so f′ = f.';
    }
    if (mode === 'A') {
      return listDir >= 0
        ? 'The car is stationary, so its wavefronts stay equally spaced (λ does not change). The listener walks INTO the waves and meets more wavefronts every second, so the observed frequency is higher.'
        : 'The car is stationary, so its wavefronts stay equally spaced (λ does not change). The listener walks AWAY from the waves and meets fewer wavefronts every second, so the observed frequency is lower.';
    }
    if (mode === 'B') {
      return srcDir >= 0
        ? 'The car keeps emitting from new positions, so the wavefronts in FRONT of it are squeezed together (λ′ < λ). The listener receives them more often, so the pitch is higher.'
        : 'The car keeps emitting from new positions further away, so the wavefronts reaching the listener (behind the car) are stretched apart (λ′ > λ). The listener receives them less often, so the pitch is lower.';
    }
    return 'Both objects move. The SOURCE changes the wavelength in the air (ahead of it λ = (v − vs)/f, behind it λ = (v + vs)/f) and the LISTENER changes how quickly the wavefronts are met: f′ = f (v ± vL)/(v ∓ vs).';
  }

  /**
   * Full step-by-step working for the calculator.
   * mode: 'A' | 'B' | 'C'; p = {f,v,vs,vL}. Returns an object with strings, never HTML.
   */
  function explain(mode, srcDir, listDir, p) {
    var vsEff = mode === 'A' ? 0 : p.vs;
    var vLEff = mode === 'B' ? 0 : p.vL;
    var sd = mode === 'A' ? 0 : srcDir, ld = mode === 'B' ? 0 : listDir;
    var res = compute({ f: p.f, v: p.v, vs: vsEff, vL: vLEff, srcDir: sd, listDir: ld });
    var hasL = mode !== 'B', hasS = mode !== 'A';
    var ns = ld >= 0 ? '+' : MINUS, ds = sd >= 0 ? MINUS : '+';

    var given = [['f', 'Original frequency', num(p.f) + ' Hz'], ['v', 'Speed of sound', num(p.v) + ' m/s']];
    if (hasS) given.push(['vs', 'Source velocity', num(vsEff) + ' m/s (' + (sd >= 0 ? 'towards' : 'away from') + ' listener)']);
    if (hasL) given.push(['vL', 'Listener velocity', num(vLEff) + ' m/s (' + (ld >= 0 ? 'towards' : 'away from') + ' source)']);

    var out = { res: res, given: given, formula: formulaText(mode, sd, ld), mode: mode, srcDir: sd, listDir: ld };
    if (!res.valid) { out.errors = res.errors; return out; }

    var nv = hasL ? p.v + ld * vLEff : p.v;
    var dv = hasS ? p.v - sd * vsEff : p.v;
    out.substitution = [
      'f' + PRIME + ' = ' + num(p.f) + ' × ' + (hasL ? '(' + num(p.v) + ' ' + ns + ' ' + num(vLEff) + ')' : num(p.v)) +
        ' / ' + (hasS ? '(' + num(p.v) + ' ' + ds + ' ' + num(vsEff) + ')' : num(p.v)),
      'f' + PRIME + ' = ' + num(p.f) + ' × ' + num(nv) + ' / ' + num(dv),
      'f' + PRIME + ' = ' + num(p.f * nv) + ' / ' + num(dv),
      'f' + PRIME + ' = ' + fix(res.fObs, 1) + ' Hz'
    ];
    out.final = 'f' + PRIME + ' = ' + fix(res.fObs, 1) + ' Hz';

    var lamSteps = [LAMBDA + ' = v / f = ' + num(p.v) + ' / ' + num(p.f) + ' = ' + fix(res.lambda, 3) + ' m'];
    if (hasS) {
      lamSteps.push(LAMBDA + PRIME + ' = (v ' + ds + ' vs) / f = (' + num(p.v) + ' ' + ds + ' ' + num(vsEff) + ') / ' + num(p.f) +
                    ' = ' + fix(res.lambdaObs, 3) + ' m');
    } else {
      lamSteps.push(LAMBDA + PRIME + ' = ' + LAMBDA + ' = ' + fix(res.lambda, 3) +
                    ' m   (the source is stationary, so the wavelength in the air does not change)');
    }
    out.wavelength = lamSteps;
    out.extras = [
      [DELTA + 'f = f' + PRIME + ' ' + MINUS + ' f', fix(res.fObs, 1) + ' ' + MINUS + ' ' + fix(res.f, 1) + ' = ' + signed(res.df, 1) + ' Hz'],
      [DELTA + LAMBDA + ' = ' + LAMBDA + PRIME + ' ' + MINUS + ' ' + LAMBDA, fix(res.lambdaObs, 3) + ' ' + MINUS + ' ' + fix(res.lambda, 3) + ' = ' + signed(res.dLambda, 3) + ' m'],
      ['% change in frequency', signed(res.pct, 2) + ' %']
    ];
    out.note = mode === 'A'
      ? 'Moving listener: the wavelength in the air stays the same. Only the rate at which the listener meets wavefronts changes.'
      : (mode === 'B'
        ? 'Moving source: the wavelength in the air itself changes (compressed in front, stretched behind).'
        : 'Sign convention: listener towards source = +vL, away = ' + MINUS + 'vL;  source towards listener = ' + MINUS + 'vs, away = +vs.');
    return out;
  }

  return {
    DEFAULTS: DEFAULTS, LIMITS: LIMITS, clamp: clamp,
    num: num, fix: fix, signed: signed,
    compute: compute, formulaText: formulaText, formulaNumeric: formulaNumeric,
    scenarioLabel: scenarioLabel, liveLabel: liveLabel, explanation: explanation, describe: describe, explain: explain,
    SYMBOLS: { MINUS: MINUS, PRIME: PRIME, LAMBDA: LAMBDA, DELTA: DELTA }
  };
});
