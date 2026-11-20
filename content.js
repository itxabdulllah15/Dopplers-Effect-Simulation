/* ==========================================================================
   content.js — All educational text: variables, formula sheet, comparison
   table, applications and quiz. Edit this file to change the wording.
   ========================================================================== */
(function (root) {
  'use strict';

  /** CSS fraction helper: frac('v + vL','v') */
  function frac(n, d) { return '<span class="frac"><span>' + n + '</span><span>' + d + '</span></span>'; }

  /* ---------- tiny illustrations (inline SVG, 120×56) ---------- */
  var sine = 'M4 28 q10 -22 20 0 t20 0 t20 0 t20 0 t20 0';
  function svg(inner) { return '<svg viewBox="0 0 128 60" aria-hidden="true">' + inner + '</svg>'; }
  var ILL = {
    freq: svg('<path d="' + sine + '" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round"/><g fill="#fff"><circle cx="14" cy="17" r="3"/><circle cx="34" cy="17" r="3"/><circle cx="54" cy="17" r="3"/><circle cx="74" cy="17" r="3"/><circle cx="94" cy="17" r="3"/></g><text x="64" y="55" text-anchor="middle" font-size="9" fill="#9db2d3">waves per second</text>'),
    fobs: svg('<path d="M4 28 q7 -22 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round"/><text x="64" y="55" text-anchor="middle" font-size="9" fill="#9db2d3">what you actually hear</text>'),
    speed: svg('<line x1="14" y1="30" x2="104" y2="30" stroke="#e8eefc" stroke-width="4" stroke-linecap="round"/><path d="M104 30 l-12 -8 v16z" fill="#e8eefc"/><text x="64" y="52" text-anchor="middle" font-size="9" fill="#9db2d3">sound travels through air</text>'),
    vs: svg('<rect x="22" y="26" width="46" height="16" rx="6" fill="#ef4444"/><rect x="34" y="17" width="22" height="12" rx="4" fill="#fca5a5"/><circle cx="34" cy="44" r="6" fill="#1f2937"/><circle cx="58" cy="44" r="6" fill="#1f2937"/><line x1="76" y1="30" x2="112" y2="30" stroke="#ff6b70" stroke-width="4" stroke-linecap="round"/><path d="M114 30 l-11 -7 v14z" fill="#ff6b70"/>'),
    vl: svg('<circle cx="40" cy="14" r="8" fill="#f2c6a6"/><rect x="32" y="22" width="16" height="22" rx="6" fill="#2aa6be"/><rect x="33" y="44" width="5" height="12" fill="#22304d"/><rect x="42" y="44" width="5" height="12" fill="#22304d"/><line x1="62" y1="30" x2="106" y2="30" stroke="#66b3ff" stroke-width="4" stroke-linecap="round"/><path d="M108 30 l-11 -7 v14z" fill="#66b3ff"/>'),
    lam: svg('<path d="' + sine + '" fill="none" stroke="#b794ff" stroke-width="3" stroke-linecap="round"/><line x1="14" y1="48" x2="54" y2="48" stroke="#b794ff" stroke-width="2"/><path d="M14 48 l7 -4 v8z M54 48 l-7 -4 v8z" fill="#b794ff"/><text x="34" y="58" text-anchor="middle" font-size="9" fill="#b794ff">λ</text>'),
    lamobs: svg('<path d="M4 28 q7 -22 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke="#5eead4" stroke-width="3" stroke-linecap="round"/><line x1="11" y1="48" x2="39" y2="48" stroke="#5eead4" stroke-width="2"/><path d="M11 48 l7 -4 v8z M39 48 l-7 -4 v8z" fill="#5eead4"/><text x="25" y="58" text-anchor="middle" font-size="9" fill="#5eead4">λ′</text>'),
    dlam: svg('<line x1="20" y1="22" x2="84" y2="22" stroke="#b794ff" stroke-width="3"/><line x1="20" y1="38" x2="68" y2="38" stroke="#5eead4" stroke-width="3"/><rect x="68" y="33" width="16" height="10" fill="#fde047" opacity=".85"/><text x="92" y="42" font-size="11" fill="#fde047">Δλ</text>'),
    df: svg('<rect x="22" y="30" width="14" height="22" rx="3" fill="#22d3ee"/><rect x="48" y="18" width="14" height="34" rx="3" fill="#4ade80"/><path d="M82 40 l10 -16 l10 16z" fill="#86efac"/><text x="92" y="54" text-anchor="middle" font-size="10" fill="#86efac">Δf</text>')
  };

  var VARIABLES = [
    { sym: 'f', name: 'Frequency', unit: 'Hz (hertz = 1/s)', col: '#9be8ff', ill: ILL.freq,
      text: 'How many waves the source produces every second. A higher frequency sounds like a higher pitch.' },
    { sym: 'f′', name: 'Observed frequency', unit: 'Hz', col: '#4ade80', ill: ILL.fobs,
      text: 'The frequency the listener actually receives. It differs from f when the source or the listener is moving.' },
    { sym: 'v', name: 'Speed of sound', unit: 'm/s', col: '#e8eefc', ill: ILL.speed,
      text: 'How fast sound travels through the air. It is about 343 m/s at 20 °C and does not depend on how the source moves.' },
    { sym: 'vs', name: 'Source velocity', unit: 'm/s', col: '#ff6b70', ill: ILL.vs,
      text: 'The speed of the object making the sound (the car), measured relative to the air.' },
    { sym: 'vL', name: 'Listener velocity', unit: 'm/s', col: '#66b3ff', ill: ILL.vl,
      text: 'The speed of the person listening, measured relative to the air.' },
    { sym: 'λ', name: 'Wavelength', unit: 'm (metre)', col: '#b794ff', ill: ILL.lam,
      text: 'The distance between two neighbouring wavefronts. For a still source, λ = v / f.' },
    { sym: 'λ′', name: 'Observed wavelength', unit: 'm', col: '#5eead4', ill: ILL.lamobs,
      text: 'The wavelength in the air on the listener’s side of a moving source: λ′ = (v ∓ vs) / f. It is shorter in front of the car and longer behind it.' },
    { sym: 'Δλ', name: 'Change in wavelength', unit: 'm', col: '#fde047', ill: ILL.dlam,
      text: 'Δλ = λ′ − λ. Negative means the waves are squeezed together; positive means they are stretched apart.' },
    { sym: 'Δf', name: 'Change in frequency', unit: 'Hz', col: '#86efac', ill: ILL.df,
      text: 'Δf = f′ − f. Positive means the pitch sounds higher; negative means it sounds lower.' }
  ];

  /* ---------- formula sheet ---------- */
  var FORMULAS = [
    { group: 'Stationary source – moving listener', items: [
      { label: 'Listener approaching', html: 'f′ = f × ' + frac('v + v<sub>L</sub>', 'v'), copy: "f' = f(v + vL)/v", note: 'Listener meets wavefronts more often.' },
      { label: 'Listener moving away', html: 'f′ = f × ' + frac('v − v<sub>L</sub>', 'v'), copy: "f' = f(v - vL)/v", note: 'Listener meets wavefronts less often.' }
    ]},
    { group: 'Moving source – stationary listener', items: [
      { label: 'Source approaching', html: 'f′ = f × ' + frac('v', 'v − v<sub>s</sub>'), copy: "f' = fv/(v - vs)", note: 'Wavefronts are compressed in front of the source.' },
      { label: 'Source moving away', html: 'f′ = f × ' + frac('v', 'v + v<sub>s</sub>'), copy: "f' = fv/(v + vs)", note: 'Wavefronts are stretched behind the source.' }
    ]},
    { group: 'Both moving (advanced)', items: [
      { label: 'General form', html: 'f′ = f × ' + frac('v ± v<sub>L</sub>', 'v ∓ v<sub>s</sub>'), copy: "f' = f(v ± vL)/(v ∓ vs)", note: 'Listener towards source: +vL, away: −vL.  Source towards listener: −vs, away: +vs.' }
    ]},
    { group: 'Wavelength', items: [
      { label: 'Original wavelength', html: 'λ = ' + frac('v', 'f'), copy: 'λ = v/f', note: 'Metres (m).' },
      { label: 'Source approaching', html: 'λ′ = ' + frac('v − v<sub>s</sub>', 'f'), copy: "λ' = (v - vs)/f", note: 'Shorter wavelength in front of the source.' },
      { label: 'Source moving away', html: 'λ′ = ' + frac('v + v<sub>s</sub>', 'f'), copy: "λ' = (v + vs)/f", note: 'Longer wavelength behind the source.' }
    ]},
    { group: 'Differences', items: [
      { label: 'Frequency difference', html: 'Δf = f′ − f', copy: "Δf = f' - f", note: 'Hertz (Hz).' },
      { label: 'Wavelength difference', html: 'Δλ = λ′ − λ', copy: "Δλ = λ' - λ", note: 'Metres (m).' }
    ]}
  ];

  var SYMBOL_UNITS = [
    ['f, f′, Δf', 'hertz (Hz)'], ['v, vs, vL', 'metres per second (m/s)'], ['λ, λ′, Δλ', 'metres (m)']
  ];

  /* ---------- comparison table ---------- */
  var COMPARE = [
    { sit: 'Listener approaches a stationary source', moving: 'Listener', still: 'Source', f: 'f′ = f(v + vL)/v', up: true,
      fb: 'Increases (f′ > f)', wb: 'Unchanged — wavefronts stay equally spaced' },
    { sit: 'Listener moves away from a stationary source', moving: 'Listener', still: 'Source', f: 'f′ = f(v − vL)/v', up: false,
      fb: 'Decreases (f′ < f)', wb: 'Unchanged — wavefronts stay equally spaced' },
    { sit: 'Source approaches a stationary listener', moving: 'Source', still: 'Listener', f: 'f′ = fv/(v − vs)', up: true,
      fb: 'Increases (f′ > f)', wb: 'Shorter (λ′ = (v − vs)/f) — compressed' },
    { sit: 'Source moves away from a stationary listener', moving: 'Source', still: 'Listener', f: 'f′ = fv/(v + vs)', up: false,
      fb: 'Decreases (f′ < f)', wb: 'Longer (λ′ = (v + vs)/f) — stretched' }
  ];

  /* ---------- real-life applications ---------- */
  function icon(inner) { return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
  var APPS = [
    { title: 'Ambulance sirens', icon: icon('<rect x="8" y="26" width="40" height="18" rx="5" stroke="#ff6b70" stroke-width="3"/><path d="M48 32h8l4 6v6H48" stroke="#ff6b70" stroke-width="3"/><circle cx="20" cy="46" r="4" fill="#0b1b3a" stroke="#e8eefc" stroke-width="3"/><circle cx="46" cy="46" r="4" fill="#0b1b3a" stroke="#e8eefc" stroke-width="3"/><path d="M24 20l4 4m8-6v6m8-2l-4 4" stroke="#22d3ee" stroke-width="3"/>'),
      text: 'As an ambulance comes towards you the siren sounds higher. The moment it passes, the pitch drops. The siren itself never changes — only the wavefronts reaching you do.' },
    { title: 'Passing cars and horns', icon: icon('<path d="M8 40h48M14 40l6-12h24l6 12" stroke="#e8eefc" stroke-width="3"/><circle cx="20" cy="44" r="5" stroke="#e8eefc" stroke-width="3"/><circle cx="44" cy="44" r="5" stroke="#e8eefc" stroke-width="3"/><path d="M50 22c4 2 6 5 6 8M54 16c6 3 9 8 9 14" stroke="#22d3ee" stroke-width="3"/>'),
      text: 'A car horn drops in pitch as the car drives past. The sudden “neeeeoww” is the change from f′ = fv/(v − vs) to f′ = fv/(v + vs).' },
    { title: 'Doppler radar', icon: icon('<circle cx="32" cy="34" r="6" stroke="#4ade80" stroke-width="3"/><path d="M16 34a16 16 0 0 1 16-16M10 34a22 22 0 0 1 22-22M48 34a16 16 0 0 1-16 16M54 34a22 22 0 0 1-22 22" stroke="#22d3ee" stroke-width="3"/>'),
      text: 'Radar sends out radio waves and measures the frequency shift of the echo. Police speed guns use it to measure vehicle speed, and weather radar uses it to see how fast rain and wind are moving.' },
    { title: 'Medical Doppler ultrasound', icon: icon('<path d="M10 40c8-18 14 18 22 0s14 18 22 0" stroke="#ff6b70" stroke-width="3"/><circle cx="32" cy="16" r="6" stroke="#22d3ee" stroke-width="3"/><path d="M32 22v10" stroke="#22d3ee" stroke-width="3"/>'),
      text: 'Ultrasound waves bounce off moving red blood cells. The frequency shift of the echo shows how fast blood flows, helping doctors find blockages and check a baby’s heartbeat.' },
    { title: 'Astronomy', icon: icon('<circle cx="32" cy="32" r="8" stroke="#fde047" stroke-width="3"/><ellipse cx="32" cy="32" rx="26" ry="9" stroke="#b794ff" stroke-width="3" transform="rotate(-25 32 32)"/><circle cx="52" cy="22" r="2.5" fill="#e8eefc"/>'),
      text: 'Astronomers measure the Doppler shift of starlight to find planets orbiting other stars (the star wobbles slightly towards and away from us) and to measure how fast stars and galaxies move.' },
    { title: 'Redshift and blueshift', icon: icon('<rect x="6" y="24" width="52" height="16" rx="4" stroke="#e8eefc" stroke-width="2"/><path d="M8 32h14" stroke="#66b3ff" stroke-width="6"/><path d="M42 32h14" stroke="#ff6b70" stroke-width="6"/>'),
      text: 'Light also shows a Doppler effect. A source moving away has its light shifted towards red (redshift); one moving towards us is shifted towards blue (blueshift). For light we must use the relativistic formula f′ = f√((1 − β)/(1 + β)) for a receding source, where β = v/c — not the sound equations.' }
  ];

  /* ---------- quiz ---------- */
  var QUIZ = [
    { q: 'What is the Doppler Effect?', a: ['A change in the speed of sound in a different medium', 'The apparent change in frequency due to relative motion between source and observer', 'The reflection of sound from a wall', 'A change in the loudness caused by distance only'], c: 1,
      why: 'The Doppler Effect is the APPARENT change in frequency caused by relative motion between the source and the observer.' },
    { q: 'A car sounding its horn drives TOWARDS you. What happens to the observed frequency?', a: ['It decreases', 'It stays the same', 'It increases', 'It becomes zero'], c: 2,
      why: 'Wavefronts are compressed in front of the car, so you receive more of them per second: f′ > f.' },
    { q: 'What happens to the wavelength in front of a source moving towards the listener?', a: ['It becomes shorter', 'It becomes longer', 'It stays exactly the same', 'It becomes infinite'], c: 0,
      why: 'λ′ = (v − vs)/f, which is smaller than λ = v/f.' },
    { q: 'Which formula is correct for a listener moving TOWARDS a stationary source?', a: ['f′ = f(v − vL)/v', 'f′ = f(v + vL)/v', 'f′ = fv/(v − vs)', 'f′ = fv/(v + vs)'], c: 1,
      why: 'The listener meets the wavefronts faster, so v + vL goes on top: f′ = f(v + vL)/v.' },
    { q: 'The source is stationary and the listener walks away from it. What happens to the wavelength in the air?', a: ['It gets longer', 'It gets shorter', 'It does not change', 'It doubles'], c: 2,
      why: 'A stationary source emits equally spaced wavefronts. Only the rate at which the listener meets them changes.' },
    { q: 'The speed of sound in air mainly depends on:', a: ['The speed of the source', 'The speed of the listener', 'The loudness of the sound', 'The medium (e.g. air temperature)'], c: 3,
      why: 'Sound speed is a property of the medium. Moving the source does not make the sound itself travel faster.' },
    { q: 'f = 440 Hz, v = 343 m/s, and a source approaches at vs = 30 m/s. What is f′?', a: ['404.6 Hz', '478.5 Hz', '482.2 Hz', '401.5 Hz'], c: 2,
      why: 'f′ = 440 × 343 / (343 − 30) = 440 × 343 / 313 ≈ 482.2 Hz.' },
    { q: 'Which quantity controls the PITCH of a sound?', a: ['Amplitude', 'Frequency', 'Distance', 'Temperature only'], c: 1,
      why: 'Frequency controls pitch. Amplitude controls loudness — they are different things.' },
    { q: 'You hear an ambulance siren drop in pitch as it passes you. Why?', a: ['The siren is switched off', 'The ambulance goes from approaching to moving away', 'The speed of sound changes', 'The siren becomes quieter only'], c: 1,
      why: 'Approaching: f′ = fv/(v − vs) (higher). Receding: f′ = fv/(v + vs) (lower).' },
    { q: 'Astronomers find that the light from a galaxy is redshifted. What does that tell them?', a: ['The galaxy is moving away from us', 'The galaxy is moving towards us', 'The galaxy is not moving', 'The galaxy is made of sound waves'], c: 0,
      why: 'Redshift means the light’s frequency is lowered because the source is moving away from the observer.' }
  ];

  root.DopplerContent = { frac: frac, VARIABLES: VARIABLES, FORMULAS: FORMULAS, SYMBOL_UNITS: SYMBOL_UNITS, COMPARE: COMPARE, APPS: APPS, QUIZ: QUIZ };
})(typeof self !== 'undefined' ? self : this);
