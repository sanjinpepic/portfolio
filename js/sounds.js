// js/sounds.js - Retro sound effects and vintage speaker simulation

import { clamp } from "./utils.js";

// Vintage speaker simulation
// YouTube audio lives in a cross-origin iframe, so we cannot route or EQ
// the actual track. Instead we layer subtle speaker artifacts on top.
export const vintageSpeaker = (() => {
  let ctx = null;
  let masterGain = null;
  let hissGain = null;
  let boxGain = null;
  let rumbleGain = null;
  let humGain = null;
  let tuningGain = null;
  let tuningFilter = null;
  let crackleClock = null;
  let textureMotionClock = null;

  function buildNoise(seconds) {
    const len = Math.ceil(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function createFilteredNoise(buf, filterType, filterFreq, filterQ = 1) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    src.connect(filter);
    src.start();
    return filter;
  }

  function createHum(freq, gainValue) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    osc.start();
    return gain;
  }

  function clearTextureMotion() {
    clearInterval(textureMotionClock);
    textureMotionClock = null;
  }

  function scheduleCrackle() {
    clearTimeout(crackleClock);
    crackleClock = setTimeout(() => {
      if (!ctx || !masterGain || masterGain.gain.value < 0.01) {
        scheduleCrackle();
        return;
      }

      const t = ctx.currentTime;
      const crackle = ctx.createBufferSource();
      crackle.buffer = buildNoise(0.04);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2600 + Math.random() * 2200;
      filter.Q.value = 1.4;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.12, t + 0.002);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.032);

      crackle.connect(filter);
      filter.connect(env);
      env.connect(masterGain);
      crackle.start(t);
      crackle.stop(t + 0.04);

      scheduleCrackle();
    }, 2600 + Math.random() * 5400);
  }

  function syncTextureMotion(profile = {}) {
    clearTextureMotion();
    if (!ctx || !tuningFilter || !tuningGain || !masterGain || masterGain.gain.value < 0.01) return;

    const driftInterval = Math.max(420, Number(profile.flutterInterval) || 900);
    const driftAmount = clamp((Number(profile.flutterRange) || 4) / 5, 0.4, 1.3);

    textureMotionClock = setInterval(() => {
      const t = ctx.currentTime;
      const nextFrequency = 950 + Math.random() * 1400 * driftAmount;
      const nextQ = 0.8 + Math.random() * 1.2;
      const nextGain = 0.0015 + Math.random() * 0.005 * driftAmount;

      tuningFilter.frequency.setTargetAtTime(nextFrequency, t, 0.35);
      tuningFilter.Q.setTargetAtTime(nextQ, t, 0.4);
      tuningGain.gain.setTargetAtTime(nextGain, t, 0.4);
    }, driftInterval);
  }

  function applyPlaybackState({ volume = 0, muted = true, playing = false, profile = {} } = {}) {
    const normalizedVolume = clamp(Number(volume) / 100, 0, 1);
    const active = playing && !muted && normalizedVolume > 0;

    if ((active || normalizedVolume > 0) && !ctx) init();
    if (!ctx || !masterGain) return;

    ctx.resume().catch(() => {});

    const body = 0.01 + normalizedVolume * 0.03;
    const air = 0.012 + normalizedVolume * 0.018;
    const hum = 0.0025 + normalizedVolume * 0.0035;
    const rumble = 0.003 + normalizedVolume * 0.005;
    const texture = 0.001 + normalizedVolume * 0.0025;
    const themeSpread = clamp((Number(profile.flutterRange) || 4) / 5, 0.45, 1.25);

    masterGain.gain.setTargetAtTime(active ? 0.14 + normalizedVolume * 0.12 : 0, ctx.currentTime, 0.16);
    hissGain.gain.setTargetAtTime(active ? air : 0, ctx.currentTime, 0.2);
    boxGain.gain.setTargetAtTime(active ? body : 0, ctx.currentTime, 0.24);
    rumbleGain.gain.setTargetAtTime(active ? rumble : 0, ctx.currentTime, 0.24);
    humGain.gain.setTargetAtTime(active ? hum : 0, ctx.currentTime, 0.3);
    tuningGain.gain.setTargetAtTime(active ? texture * themeSpread : 0, ctx.currentTime, 0.28);

    if (!active) {
      clearTextureMotion();
      return;
    }

    tuningFilter.frequency.setTargetAtTime(1250 + normalizedVolume * 900, ctx.currentTime, 0.32);
    tuningFilter.Q.setTargetAtTime(1.2, ctx.currentTime, 0.32);
    syncTextureMotion(profile);
  }

  function init() {
    if (ctx) return;

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);

      hissGain = ctx.createGain();
      boxGain = ctx.createGain();
      rumbleGain = ctx.createGain();
      humGain = ctx.createGain();
      tuningGain = ctx.createGain();

      hissGain.gain.value = 0;
      boxGain.gain.value = 0;
      rumbleGain.gain.value = 0;
      humGain.gain.value = 0;
      tuningGain.gain.value = 0;

      tuningFilter = ctx.createBiquadFilter();
      tuningFilter.type = "bandpass";
      tuningFilter.frequency.value = 1250;
      tuningFilter.Q.value = 1.2;

      const noiseBuf = buildNoise(3);
      createFilteredNoise(noiseBuf, "bandpass", 4300, 0.85).connect(hissGain);
      createFilteredNoise(noiseBuf, "peaking", 340, 2.8).connect(boxGain);
      createFilteredNoise(noiseBuf, "lowpass", 165, 0.9).connect(rumbleGain);

      const tuningSource = ctx.createBufferSource();
      tuningSource.buffer = noiseBuf;
      tuningSource.loop = true;
      tuningSource.connect(tuningFilter);
      tuningFilter.connect(tuningGain);
      tuningSource.start();

      createHum(50, 1).connect(humGain);
      createHum(100, 1).connect(humGain);
      createHum(150, 0.7).connect(humGain);

      hissGain.connect(masterGain);
      boxGain.connect(masterGain);
      rumbleGain.connect(masterGain);
      humGain.connect(masterGain);
      tuningGain.connect(masterGain);

      scheduleCrackle();
    } catch (_) {
      // AudioContext can be blocked until user interaction.
    }
  }

  return {
    setVolume(vol) {
      applyPlaybackState({ volume: vol, muted: vol <= 0, playing: vol > 0 });
    },
    syncPlaybackState(state = {}) {
      applyPlaybackState(state);
    },
    mute() {
      applyPlaybackState({ volume: 0, muted: true, playing: false });
    },
    destroy() {
      clearTimeout(crackleClock);
      clearTextureMotion();
      ctx?.close();
    },
  };
})();

// Retro Sound Effects (Web Audio API)
export const RetroSounds = (() => {
  let ctx = null;
  let enabled = localStorage.getItem("portfolio.sounds") === "on";
  let clickGain = 1;

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
    click: () => play([{ freq: 440, start: 0, dur: 0.06, vol: 0.035 * clickGain }]),
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
    setProfile(profile = {}) {
      const nextGain = Number(profile.clickGain);
      clickGain = Number.isFinite(nextGain) ? clamp(nextGain, 0.65, 1.3) : 1;
    },
  };
})();
