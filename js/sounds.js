// js/sounds.js — Retro sound effects and vintage speaker simulation

import { clamp } from "./utils.js";

// ── Vintage speaker simulation ────────────────────────────────
// YouTube audio lives in a cross-origin iframe so we can't route
// it through Web Audio. Instead we generate authentic period-correct
// artefacts (tape hiss, AC hum, capacitor crackle) that play on top —
// exactly how cheap 90s PC speakers behaved independent of the signal.
export const vintageSpeaker = (() => {
  let ctx = null;
  let masterGain = null;
  let crackleClock = null;

  function buildNoise(seconds) {
    const len = Math.ceil(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function loopNoise(buf, gainVal, filterType, filterFreq, filterQ = 1) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    filt.Q.value = filterQ;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start();
    return src;
  }

  function addHum(freq, gainVal) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = gainVal;
    osc.connect(g);
    g.connect(masterGain);
    osc.start();
  }

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);

      const noiseBuf = buildNoise(3);

      // Tape hiss: band-pass centred on ~4 kHz (upper midrange roll-off)
      loopNoise(noiseBuf, 0.04, "bandpass", 4000, 0.7);
      // Speaker cone resonance/boxy colouration: low-mid bump
      loopNoise(noiseBuf, 0.018, "peaking", 320, 2.5);
      // Speaker cabinet rumble: low-pass thump
      loopNoise(noiseBuf, 0.012, "lowpass", 180, 0.8);

      // AC mains hum + harmonics (50 Hz European, plus 100 Hz / 150 Hz)
      addHum(50, 0.01);
      addHum(100, 0.005);
      addHum(150, 0.003);

      // Random capacitor crackle pops
      crackleClock = setInterval(() => {
        if (!ctx || masterGain.gain.value < 0.01) return;
        const t = ctx.currentTime;
        const crackle = ctx.createBufferSource();
        crackle.buffer = buildNoise(0.04);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.35, t + 0.002);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
        crackle.connect(env);
        env.connect(masterGain);
        crackle.start(t);
        crackle.stop(t + 0.04);
      }, 4000 + Math.random() * 8000);
    } catch (_) {
      /* AudioContext blocked — degrade gracefully */
    }
  }

  return {
    /** vol: 0–100, mirrors the Winamp volume slider */
    setVolume(vol) {
      if (vol > 0 && !ctx) init();
      if (!masterGain) return;
      ctx.resume().catch(() => {});
      const level = Math.pow(Math.max(0, vol) / 100, 1.8) * 0.45;
      masterGain.gain.setTargetAtTime(level, ctx.currentTime, 0.12);
    },
    mute() {
      if (!masterGain) return;
      masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    },
    destroy() {
      clearInterval(crackleClock);
      ctx?.close();
    },
  };
})();

// ── Retro Sound Effects (Web Audio API) ───────────────────────
export const RetroSounds = (() => {
  let ctx = null;
  let enabled = localStorage.getItem("portfolio.sounds") === "on";

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(notes) {
    if (!enabled) return;
    try {
      const ac = getCtx();
      ac.resume().catch(() => {});
      notes.forEach(({ freq, start, dur, type = "square", vol = 0.055 }) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        const t = ac.currentTime + start;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g);
        g.connect(ac.destination);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      });
    } catch (_) {}
  }

  return {
    open: () =>
      play([
        { freq: 523, start: 0, dur: 0.07 },
        { freq: 659, start: 0.06, dur: 0.1 },
      ]),
    close: () =>
      play([
        { freq: 330, start: 0, dur: 0.08 },
        { freq: 220, start: 0.06, dur: 0.1 },
      ]),
    click: () => play([{ freq: 440, start: 0, dur: 0.06, vol: 0.035 }]),
    error: () =>
      play([
        { freq: 180, start: 0, dur: 0.18, type: "sawtooth" },
        { freq: 140, start: 0.15, dur: 0.22, type: "sawtooth" },
      ]),
    toggle() {
      enabled = !enabled;
      localStorage.setItem("portfolio.sounds", enabled ? "on" : "off");
      const btn = document.getElementById("sounds-menu-item");
      if (btn) btn.textContent = `Sounds: ${enabled ? "On" : "Off"}`;
      return enabled;
    },
    isEnabled: () => enabled,
    syncLabel() {
      const btn = document.getElementById("sounds-menu-item");
      if (btn) btn.textContent = `Sounds: ${enabled ? "On" : "Off"}`;
    },
  };
})();
