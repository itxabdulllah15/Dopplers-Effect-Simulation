/* ==========================================================================
   audio.js — Web Audio sound system.
   Chain:  OscillatorNode -> env GainNode -> attenuation GainNode -> master GainNode -> speakers
   - frequency  (pitch)    : oscillator.frequency  (the Doppler observed frequency)
   - amplitude  (loudness) : master (volume/mute) and attenuation (optional distance effect)
   Pitch and loudness are completely independent. Only ONE oscillator ever exists.
   The AudioContext is created only after a user click (browser autoplay rule).
   ========================================================================== */
(function (root) {
  'use strict';
  var ctx = null, osc = null, env = null, att = null, master = null;
  var st = { playing: false, muted: false, volume: 0.5, freq: 440, atten: 1 };

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); att = ctx.createGain(); env = ctx.createGain();
      env.gain.value = 0; att.gain.value = st.atten;
      env.connect(att); att.connect(master); master.connect(ctx.destination);
      applyVolume(true);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function applyVolume(instant) {
    if (!master) return;
    var g = st.muted ? 0 : st.volume * 0.35;           // 0.35 keeps the pure tone comfortable
    if (instant) master.gain.value = g; else master.gain.setTargetAtTime(g, ctx.currentTime, 0.03);
  }

  var api = {
    get supported() { return !!(root.AudioContext || root.webkitAudioContext); },
    get playing() { return st.playing; },
    get muted() { return st.muted; },

    /** Start the tone (must be called from a click/keypress). */
    play: function (freq) {
      if (!ensure()) return false;
      if (freq) st.freq = freq;
      if (!osc) {                                       // never create a second oscillator
        osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = st.freq;
        osc.connect(env);
        osc.start();
      }
      env.gain.cancelScheduledValues(ctx.currentTime);
      env.gain.setTargetAtTime(1, ctx.currentTime, 0.03);
      st.playing = true;
      return true;
    },

    /** Stop the tone and destroy the oscillator. */
    pause: function () {
      st.playing = false;
      if (!ctx || !osc) return;
      var o = osc; osc = null;
      env.gain.cancelScheduledValues(ctx.currentTime);
      env.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      try { o.stop(ctx.currentTime + 0.12); } catch (e) { /* already stopped */ }
      o.onended = function () { try { o.disconnect(); } catch (e) { /* ignore */ } };
    },

    /** Smoothly glide to a new pitch (Hz). */
    setFrequency: function (f) {
      if (!(f > 0)) return;
      st.freq = f;
      if (ctx && osc) osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.04);
    },
    setVolume: function (v01) { st.volume = Math.max(0, Math.min(1, v01)); applyVolume(false); },
    setMuted: function (m) { st.muted = !!m; applyVolume(false); },
    /** Optional distance loudness (0..1). Does not touch the frequency. */
    setAttenuation: function (a) {
      st.atten = Math.max(0, Math.min(1, a));
      if (att) att.gain.setTargetAtTime(st.atten, ctx.currentTime, 0.08);
    }
  };
  root.DopplerAudio = api;
})(typeof self !== 'undefined' ? self : this);
