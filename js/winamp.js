// js/winamp.js - Winamp player module

import { S, WINAMP_PLAYLIST, WINAMP_PLAYLIST_URL } from "./state.js";
import { clamp } from "./utils.js";
import { vintageSpeaker } from "./sounds.js";

// Internal helpers

let winampClockTimer = null;
const VISUALIZER_BAR_COUNT = 24;
const WINAMP_VISUAL_MODES = ["video", "visualizer", "alchemy"];
const pseudoSpectrum = {
  bands: Array.from({ length: VISUALIZER_BAR_COUNT }, (_, index) => 0.22 + ((index % 5) * 0.045)),
  pulse: 0.18,
  bloom: 0.2,
  drift: 0.24,
  lastStep: -1,
  trackSeed: 0,
};

function fract(value) {
  return value - Math.floor(value);
}

function pseudoNoise(seed) {
  return fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);
}

function getTrackSeed() {
  const track = getCurrentTrack();
  if (!track?.id) return 1;
  return [...track.id].reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

function updatePseudoSpectrum(playbackTime, normalizedVolume) {
  const trackSeed = getTrackSeed();
  if (pseudoSpectrum.trackSeed !== trackSeed) {
    pseudoSpectrum.trackSeed = trackSeed;
    pseudoSpectrum.lastStep = -1;
    pseudoSpectrum.bands = pseudoSpectrum.bands.map((_, index) => 0.2 + pseudoNoise(trackSeed * 0.017 + index * 1.13) * 0.18);
  }

  const step = Math.floor(playbackTime * 6);
  const stepChanged = step !== pseudoSpectrum.lastStep;
  if (stepChanged) {
    pseudoSpectrum.lastStep = step;
    const section = Math.floor(playbackTime / 8);
    const sectionBias = 0.72 + pseudoNoise(trackSeed * 0.001 + section * 0.63) * 0.78;
    const accent = pseudoNoise(trackSeed * 0.019 + step * 0.73);
    pseudoSpectrum.pulse = 0.18 + accent * 0.72 * normalizedVolume * sectionBias;
    pseudoSpectrum.bloom = 0.12 + pseudoNoise(trackSeed * 0.023 + step * 0.41) * 0.64;
    pseudoSpectrum.drift = pseudoNoise(trackSeed * 0.029 + section * 0.37);

    pseudoSpectrum.bands = pseudoSpectrum.bands.map((band, index) => {
      const group = Math.floor(index / 4);
      const phrase = pseudoNoise(trackSeed * 0.007 + step * 0.17 + index * 0.91);
      const groove = pseudoNoise(trackSeed * 0.011 + section * 0.53 + group * 1.27);
      const kick = index < 5 ? pseudoSpectrum.pulse * 0.46 : 0;
      const snare = index >= 8 && index <= 15 ? pseudoSpectrum.pulse * 0.28 * (0.4 + accent) : 0;
      const sparkle = index > 15 ? pseudoSpectrum.bloom * 0.22 : 0;
      const target = clamp(0.08 + phrase * 0.45 + groove * 0.26 + kick + snare + sparkle, 0.06, 1);
      return band * 0.36 + target * 0.64;
    });
  }

  const decay = stepChanged ? 0.82 : 0.94;
  pseudoSpectrum.pulse *= decay;
  pseudoSpectrum.bloom *= 0.96;
  return pseudoSpectrum;
}

function resizeWinampVisualizer(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}

function drawWinampVisualizerFrame() {
  const canvas = S.winampVisualizer;
  if (!canvas) return;
  const size = resizeWinampVisualizer(canvas);
  if (!size) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const { width, height } = size;
  const time = performance.now() * 0.0018;
  const playbackTime = Number(S.winampPlayer?.getCurrentTime?.()) || 0;
  const normalizedVolume = clamp((S.winampMuted ? 0 : S.winampLastVolume) / 100, 0, 1);
  const energy = S.winampPlaying ? 0.3 + normalizedVolume * 0.9 : 0.08;
  const spectrum = updatePseudoSpectrum(playbackTime, normalizedVolume);

  context.clearRect(0, 0, width, height);

  if (S.winampVisualMode === "alchemy") {
    drawAlchemyVisualizerFrame(context, width, height, time, playbackTime, normalizedVolume, energy, spectrum);
    S.winampVisualizerFrame = window.requestAnimationFrame(drawWinampVisualizerFrame);
    return;
  }

  const backgroundGradient = context.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, `hsl(${(time * 45 + playbackTime * 12) % 360} 80% 9%)`);
  backgroundGradient.addColorStop(0.5, `hsl(${(time * 70 + 110) % 360} 85% 18%)`);
  backgroundGradient.addColorStop(1, "#03040a");
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);

  for (let i = 0; i < 18; i += 1) {
    const bandEnergy = spectrum.bands[i % spectrum.bands.length];
    const pulse = 0.26 + bandEnergy * 0.42 + Math.sin(time * (0.8 + bandEnergy) + i * 0.9 + playbackTime * 0.22) * 0.12;
    const glowX = (i / 17) * width;
    const glowY = height * (0.14 + ((i % 5) / 10) + bandEnergy * 0.05);
    const glowRadius = width * (0.07 + pulse * 0.06);
    const glow = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
    glow.addColorStop(0, `hsla(${(time * 90 + i * 18 + bandEnergy * 90) % 360} 100% 65% / ${0.14 + bandEnergy * 0.22 + energy * 0.08})`);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.fillRect(glowX - glowRadius, glowY - glowRadius, glowRadius * 2, glowRadius * 2);
  }

  const barWidth = width / VISUALIZER_BAR_COUNT;
  for (let i = 0; i < VISUALIZER_BAR_COUNT; i += 1) {
    const phase = time * (1.1 + normalizedVolume * 0.8) + i * 0.36 + playbackTime * 0.11;
    const harmonic = Math.sin(phase) + Math.sin(phase * 1.7) * 0.28 + Math.cos(phase * 0.53) * 0.22;
    const bandEnergy = spectrum.bands[i];
    const neighborEnergy = spectrum.bands[(i + 1) % VISUALIZER_BAR_COUNT] * 0.18 + spectrum.bands[(i + VISUALIZER_BAR_COUNT - 1) % VISUALIZER_BAR_COUNT] * 0.18;
    const normalizedHeight = clamp(0.06 + bandEnergy * 0.78 + neighborEnergy + harmonic * 0.06 + spectrum.pulse * 0.12, 0.04, 0.96);
    const barHeight = normalizedHeight * height;
    const x = i * barWidth + barWidth * 0.11;
    const y = height - barHeight;
    const fill = context.createLinearGradient(0, y, 0, height);
    fill.addColorStop(0, `hsla(${(time * 120 + i * 11 + bandEnergy * 80) % 360} 100% 68% / 0.95)`);
    fill.addColorStop(0.45, `hsla(${(time * 120 + i * 11 + 58 + bandEnergy * 45) % 360} 100% 55% / 0.9)`);
    fill.addColorStop(1, "hsla(210 100% 8% / 0.6)");
    context.fillStyle = fill;
    context.fillRect(x, y, barWidth * 0.78, barHeight);

    context.fillStyle = "rgba(255, 255, 255, 0.22)";
    context.fillRect(x, y, barWidth * 0.78, Math.max(2, height * 0.01));
  }

  context.strokeStyle = `rgba(180, 255, 146, ${0.28 + normalizedVolume * 0.25})`;
  context.lineWidth = Math.max(1, width * 0.0024);
  context.beginPath();
  for (let i = 0; i <= width; i += Math.max(4, Math.round(width / 80))) {
    const bandIndex = Math.floor((i / width) * (VISUALIZER_BAR_COUNT - 1));
    const bandEnergy = spectrum.bands[bandIndex];
    const wave = Math.sin((i / width) * Math.PI * 7 + time * (2 + bandEnergy) + playbackTime * 0.16);
    const mod = Math.cos((i / width) * Math.PI * (2.1 + spectrum.drift) - time * (1.1 + bandEnergy));
    const y = height * (0.58 - bandEnergy * 0.22 + wave * (0.025 + bandEnergy * 0.075) + mod * 0.018);
    if (i === 0) context.moveTo(i, y);
    else context.lineTo(i, y);
  }
  context.stroke();

  S.winampVisualizerFrame = window.requestAnimationFrame(drawWinampVisualizerFrame);
}

function drawAlchemyVisualizerFrame(context, width, height, time, playbackTime, normalizedVolume, energy, spectrum) {
  const background = context.createRadialGradient(
    width * 0.5,
    height * 0.52,
    width * 0.06,
    width * 0.5,
    height * 0.52,
    width * 0.82
  );
  background.addColorStop(0, "rgba(255, 242, 169, 0.16)");
  background.addColorStop(0.28, `hsla(${32 + normalizedVolume * 28} 88% 20% / 0.88)`);
  background.addColorStop(0.62, "hsla(18 84% 9% / 0.96)");
  background.addColorStop(1, "#020202");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const sigilCount = 6;
  for (let ringIndex = 0; ringIndex < sigilCount; ringIndex += 1) {
    const ratio = (ringIndex + 1) / sigilCount;
    const bandEnergy = spectrum.bands[(ringIndex * 3) % spectrum.bands.length];
    const radius = Math.min(width, height) * (0.1 + ratio * 0.12 + bandEnergy * 0.028 + Math.sin(time * (0.9 + bandEnergy) + ringIndex) * 0.004);
    const hue = 24 + ringIndex * 14 + bandEnergy * 26;
    context.beginPath();
    context.arc(width * 0.5, height * 0.52, radius, 0, Math.PI * 2);
    context.strokeStyle = `hsla(${hue} 100% 70% / ${0.12 + ratio * 0.11 + energy * 0.08})`;
    context.lineWidth = Math.max(1, width * (0.0014 + ratio * 0.0008));
    context.stroke();
  }

  const spokeCount = 12;
  context.save();
  context.translate(width * 0.5, height * 0.52);
  context.rotate(time * (0.2 + spectrum.drift * 0.3) + playbackTime * 0.01);
  for (let spoke = 0; spoke < spokeCount; spoke += 1) {
    const angle = (Math.PI * 2 * spoke) / spokeCount;
    const inner = Math.min(width, height) * 0.1;
    const bandEnergy = spectrum.bands[(spoke * 2) % spectrum.bands.length];
    const outer = Math.min(width, height) * (0.22 + bandEnergy * 0.16 + (spoke % 3) * 0.018 + spectrum.pulse * 0.03);
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.strokeStyle = `hsla(${34 + spoke * 6} 100% 72% / ${0.18 + energy * 0.16})`;
    context.lineWidth = Math.max(1, width * 0.0022);
    context.stroke();
  }
  context.restore();

  const orbCount = 18;
  for (let i = 0; i < orbCount; i += 1) {
    const bandEnergy = spectrum.bands[(i + 5) % spectrum.bands.length];
    const orbit = 0.16 + (i % 6) * 0.042 + normalizedVolume * 0.04 + bandEnergy * 0.03;
    const angle = time * (0.32 + (i % 5) * 0.05 + bandEnergy * 0.12) + i * 0.62 + playbackTime * 0.03;
    const x = width * 0.5 + Math.cos(angle) * width * orbit;
    const y = height * 0.52 + Math.sin(angle * 1.18) * height * orbit * 0.78;
    const radius = width * (0.003 + (i % 3) * 0.0018 + bandEnergy * 0.0042);
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * 7);
    glow.addColorStop(0, `hsla(${36 + i * 5} 100% 74% / ${0.32 + energy * 0.18})`);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.fillRect(x - radius * 7, y - radius * 7, radius * 14, radius * 14);
  }

  const flameColumns = 20;
  const columnWidth = width / flameColumns;
  for (let i = 0; i < flameColumns; i += 1) {
    const bandEnergy = spectrum.bands[Math.floor((i / flameColumns) * spectrum.bands.length)];
    const phase = time * (1.3 + bandEnergy) + i * 0.27 + playbackTime * 0.05;
    const flameHeight = height * clamp(0.08 + bandEnergy * 0.62 + Math.sin(phase) * 0.05 + spectrum.pulse * 0.08, 0.08, 0.72);
    const x = i * columnWidth;
    const y = height - flameHeight;
    const flameFill = context.createLinearGradient(0, y, 0, height);
    flameFill.addColorStop(0, "rgba(255, 243, 173, 0.82)");
    flameFill.addColorStop(0.24, "rgba(255, 180, 66, 0.78)");
    flameFill.addColorStop(0.68, "rgba(196, 58, 8, 0.48)");
    flameFill.addColorStop(1, "rgba(38, 4, 2, 0)");
    context.fillStyle = flameFill;
    context.fillRect(x + columnWidth * 0.18, y, columnWidth * 0.64, flameHeight);
  }

  context.beginPath();
  for (let i = 0; i <= width; i += Math.max(4, Math.round(width / 90))) {
    const bandIndex = Math.floor((i / width) * (VISUALIZER_BAR_COUNT - 1));
    const bandEnergy = spectrum.bands[bandIndex];
    const wave = Math.sin((i / width) * Math.PI * (7 + spectrum.drift * 3) + time * (1 + bandEnergy) + playbackTime * 0.06);
    const shimmer = Math.cos((i / width) * Math.PI * 3 - time * 0.55);
    const y = height * (0.58 - bandEnergy * 0.18 + wave * (0.02 + bandEnergy * 0.08) + shimmer * 0.01);
    if (i === 0) context.moveTo(i, y);
    else context.lineTo(i, y);
  }
  context.strokeStyle = `rgba(255, 248, 214, ${0.34 + normalizedVolume * 0.24})`;
  context.lineWidth = Math.max(1, width * 0.003);
  context.stroke();
}

function startWinampVisualizer() {
  if (!S.winampVisualizer || S.winampVisualizerFrame) return;
  S.winampVisualizerFrame = window.requestAnimationFrame(drawWinampVisualizerFrame);
}

function stopWinampVisualizer() {
  if (!S.winampVisualizerFrame) return;
  window.cancelAnimationFrame(S.winampVisualizerFrame);
  S.winampVisualizerFrame = null;
}

function setWinampVisualMode(mode) {
  S.winampVisualMode = WINAMP_VISUAL_MODES.includes(mode) ? mode : "video";
  if (S.winampScreenWrap) {
    S.winampScreenWrap.dataset.visualMode = S.winampVisualMode;
  }
  if (S.winampVisualModeToggle) {
    const currentIndex = WINAMP_VISUAL_MODES.indexOf(S.winampVisualMode);
    const nextMode = WINAMP_VISUAL_MODES[(currentIndex + 1) % WINAMP_VISUAL_MODES.length];
    const nextModeLabel = nextMode === "video" ? "Video" : nextMode === "alchemy" ? "Alchemy" : "Visualizer";
    S.winampVisualModeToggle.textContent = nextModeLabel;
    S.winampVisualModeToggle.setAttribute("aria-pressed", S.winampVisualMode === "video" ? "false" : "true");
  }
  if (S.winampModeLabel) {
    S.winampModeLabel.textContent =
      S.winampVisualMode === "alchemy" ? "Alchemy" : S.winampVisualMode === "visualizer" ? "Visualizer" : "Video";
  }
}

function formatWinampTime(secondsValue) {
  const totalSeconds = Math.max(0, Math.floor(Number(secondsValue) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateWinampClock() {
  const timeNode = document.getElementById("winamp-led-time");
  if (!timeNode) return;
  const currentTime = Number(S.winampPlayer?.getCurrentTime?.());
  if (!Number.isFinite(currentTime)) {
    timeNode.textContent = "--:--";
    return;
  }
  timeNode.textContent = formatWinampTime(currentTime);
}

function stopWinampClock() {
  if (winampClockTimer) {
    window.clearInterval(winampClockTimer);
    winampClockTimer = null;
  }
}

function startWinampClock() {
  updateWinampClock();
  if (winampClockTimer) return;
  winampClockTimer = window.setInterval(updateWinampClock, 500);
}

function getCurrentTrack() {
  return WINAMP_PLAYLIST[S.winampActiveIndex] || WINAMP_PLAYLIST[0] || null;
}

function updateWinampNowPlaying() {
  const currentTrack = getCurrentTrack();
  const trackNumberNode = document.getElementById("winamp-led-track");
  const trackTitleNode = document.getElementById("winamp-track-title");
  if (trackNumberNode) {
    trackNumberNode.textContent = String(S.winampActiveIndex + 1).padStart(2, "0");
  }
  if (trackTitleNode) {
    trackTitleNode.textContent = currentTrack?.title || "Loading lineup...";
  }
}

async function fetchYouTubeTitle(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!response.ok) return null;
    const payload = await response.json();
    return typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : null;
  } catch {
    return null;
  }
}

function extractYouTubeVideoId(rawInput = "") {
  const candidate = rawInput.trim();
  if (!candidate) return null;
  const idPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (idPattern.test(candidate)) return candidate;
  try {
    const parsedUrl = new URL(candidate);
    const host = parsedUrl.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const watchId = parsedUrl.searchParams.get("v");
      if (watchId && idPattern.test(watchId)) return watchId;
      const shortsId = parsedUrl.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsId) return shortsId[1];
    }
    if (host === "youtu.be") {
      const shortId = parsedUrl.pathname.split("/").filter(Boolean)[0];
      if (shortId && idPattern.test(shortId)) return shortId;
    }
  } catch {
    return null;
  }
  return null;
}

function parsePlaylistText(playlistText = "") {
  return playlistText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [videoValue, customTitle] = line.split("|").map((part) => part.trim());
      const id = extractYouTubeVideoId(videoValue);
      if (!id) return null;
      return {
        id,
        title: customTitle || "Loading title...",
      };
    })
    .filter(Boolean);
}

async function loadWinampPlaylistFromFile() {
  try {
    const response = await fetch(WINAMP_PLAYLIST_URL, { cache: "no-store" });
    if (!response.ok) return false;
    const playlistText = await response.text();
    const parsedPlaylist = parsePlaylistText(playlistText);
    if (!parsedPlaylist.length) return false;
    WINAMP_PLAYLIST.splice(0, WINAMP_PLAYLIST.length, ...parsedPlaylist);
    S.winampActiveIndex = Math.min(S.winampActiveIndex, WINAMP_PLAYLIST.length - 1);
    return true;
  } catch {
    return false;
  }
}

async function hydrateWinampPlaylistTitles() {
  const updates = await Promise.all(
    WINAMP_PLAYLIST.map(async (track, index) => {
      const fetchedTitle = await fetchYouTubeTitle(track.id);
      return { index, fetchedTitle };
    })
  );

  let hasChanges = false;
  updates.forEach(({ index, fetchedTitle }) => {
    if (!fetchedTitle || fetchedTitle === WINAMP_PLAYLIST[index].title) return;
    WINAMP_PLAYLIST[index].title = fetchedTitle;
    hasChanges = true;
  });

  if (!hasChanges) return;
  setupWinampPlaylistUi();
  updateWinampNowPlaying();
}

function updateWinampUi() {
  if (S.winampToggle) S.winampToggle.textContent = S.winampPlaying ? "Pause" : "Play";
  if (S.winampMuteToggle) {
    S.winampMuteToggle.textContent = S.winampMuted ? "Muted" : "Sound On";
  }
  setWinampVisualMode(S.winampVisualMode);
  if (S.winampChannelList) {
    [...S.winampChannelList.querySelectorAll(".winamp-channel-btn")].forEach((button) => {
      const channelIndex = Number(button.dataset.winampIndex);
      button.setAttribute("aria-selected", channelIndex === S.winampActiveIndex ? "true" : "false");
      button.classList.toggle("active", channelIndex === S.winampActiveIndex);
    });
  }
}

export function stopWinampPlayback({ terminate = true } = {}) {
  if (S.winampFlutterTimer) {
    window.clearInterval(S.winampFlutterTimer);
    S.winampFlutterTimer = null;
  }
  stopWinampClock();
  if (S.winampPlayer) {
    if (terminate && typeof S.winampPlayer.stopVideo === "function") {
      S.winampPlayer.stopVideo();
    } else if (typeof S.winampPlayer.pauseVideo === "function") {
      S.winampPlayer.pauseVideo();
    }
  }
  S.winampPlaying = false;
  stopWinampVisualizer();
  vintageSpeaker.mute();
  updateWinampUi();
}

function syncWinampAudioState() {
  if (!S.winampPlayer) return;
  const currentVolume = Number(S.winampPlayer.getVolume?.());
  if (Number.isFinite(currentVolume)) {
    if (S.winampVolume) S.winampVolume.value = String(currentVolume);
    if (currentVolume > 0) S.winampLastVolume = currentVolume;
  }
  const playerMuted = S.winampPlayer.isMuted?.() ?? S.winampMuted;
  S.winampMuted = Boolean(playerMuted) || (Number.isFinite(currentVolume) && currentVolume === 0);
}

export function restartWinampFlutter() {
  startWinampVisualizer();
  if (S.winampFlutterTimer) {
    window.clearInterval(S.winampFlutterTimer);
    S.winampFlutterTimer = null;
  }
  vintageSpeaker.syncPlaybackState({
    playing: S.winampPlaying,
    muted: S.winampMuted,
    volume: S.winampLastVolume,
    profile: S.activeThemeProfile,
  });
}

function selectWinampChannel(index, { autoPlay = true } = {}) {
  if (!S.winampPlayer || !WINAMP_PLAYLIST[index]) return;
  S.winampActiveIndex = index;
  stopWinampClock();
  S.winampPlayer.loadVideoById(WINAMP_PLAYLIST[index].id);
  if (autoPlay) S.winampPlayer.playVideo();
  updateWinampNowPlaying();
  updateWinampClock();
  updateWinampUi();
}

function shuffleWinampChannel() {
  if (!S.winampPlayer || WINAMP_PLAYLIST.length <= 1) return;
  let nextIndex = S.winampActiveIndex;
  while (nextIndex === S.winampActiveIndex) {
    nextIndex = Math.floor(Math.random() * WINAMP_PLAYLIST.length);
  }
  selectWinampChannel(nextIndex);
}

function getWinampGroupLabel(trackTitle = "") {
  const artistName = trackTitle.split(" - ")[0]?.trim();
  if (!artistName) return "Misc";
  const firstChar = artistName.charAt(0).toUpperCase();
  return /[A-Z]/.test(firstChar) ? firstChar : "#";
}

function setupWinampPlaylistUi() {
  if (!S.winampChannelList) return;
  const filterValue = S.winampChannelFilter?.value.trim().toLowerCase() || "";
  const filteredPlaylist = WINAMP_PLAYLIST
    .map((track, index) => ({ ...track, index }))
    .filter(({ title }) => !filterValue || title.toLowerCase().includes(filterValue));

  if (!filteredPlaylist.length) {
    S.winampChannelList.innerHTML = '<p class="winamp-channel-empty">No channels match your filter.</p>';
  } else {
    let previousGroup = "";
    S.winampChannelList.innerHTML = filteredPlaylist.map(({ title, index }) => {
      const groupLabel = getWinampGroupLabel(title);
      const groupHeader = groupLabel !== previousGroup ? `<p class="winamp-channel-group">${groupLabel}</p>` : "";
      previousGroup = groupLabel;
      return `${groupHeader}<button type="button" class="retro-btn winamp-channel-btn" data-winamp-index="${index}" role="option">CH ${String(index + 1).padStart(2, "0")} - ${title}</button>`;
    }).join("\n");
  }

  if (!S.winampPlaylistBound) {
    S.winampChannelList.addEventListener("click", (event) => {
      const channelButton = event.target.closest(".winamp-channel-btn");
      if (!channelButton) return;
      selectWinampChannel(Number(channelButton.dataset.winampIndex));
    });
    if (S.winampChannelFilter) {
      S.winampChannelFilter.addEventListener("input", setupWinampPlaylistUi);
    }
    S.winampPlaylistBound = true;
  }
  updateWinampUi();
}

function initWinampPlayer() {
  if (S.winampPlayer || !window.YT || !window.YT.Player || !document.getElementById("winamp-youtube-player")) return;
  S.winampPlayer = new window.YT.Player("winamp-youtube-player", {
    width: "100%",
    height: "100%",
    videoId: WINAMP_PLAYLIST[0].id,
    host: "https://www.youtube-nocookie.com",
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: (event) => {
        event.target.setPlaybackQuality("small");
        event.target.mute();
        event.target.setVolume(0);
        if (S.winampVolume) S.winampVolume.value = "0";
        S.winampMuted = true;
        updateWinampNowPlaying();
        updateWinampUi();
        restartWinampFlutter();
        event.target.playVideo();
      },
      onStateChange: (event) => {
        S.winampPlaying = event.data === window.YT.PlayerState.PLAYING;
        syncWinampAudioState();
        restartWinampFlutter();
        if (S.winampPlaying) {
          startWinampClock();
        } else {
          stopWinampClock();
          updateWinampClock();
        }
        if (event.data === window.YT.PlayerState.ENDED) {
          const next = (S.winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
          selectWinampChannel(next);
          return;
        }
        updateWinampUi();
      },
      onError: () => {
        stopWinampClock();
        const next = (S.winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
        setTimeout(() => selectWinampChannel(next), 800);
      }
    }
  });
}

// Exported functions

export async function bindWinampControls() {
  const loadedCustomPlaylist = await loadWinampPlaylistFromFile();
  setupWinampPlaylistUi();
  hydrateWinampPlaylistTitles();
  if (!loadedCustomPlaylist) {
    updateWinampNowPlaying();
  }
  startWinampVisualizer();
  if (S.winampPrev) {
    S.winampPrev.addEventListener("click", () => {
      const previous = (S.winampActiveIndex - 1 + WINAMP_PLAYLIST.length) % WINAMP_PLAYLIST.length;
      selectWinampChannel(previous);
    });
  }
  if (S.winampNext) {
    S.winampNext.addEventListener("click", () => {
      const next = (S.winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
      selectWinampChannel(next);
    });
  }
  if (S.winampShuffle) {
    S.winampShuffle.addEventListener("click", () => {
      shuffleWinampChannel();
    });
  }
  if (S.winampToggle) {
    S.winampToggle.addEventListener("click", () => {
      if (!S.winampPlayer) return;
      if (S.winampPlaying) {
        S.winampPlayer.pauseVideo();
      } else {
        S.winampPlayer.playVideo();
      }
    });
  }
  if (S.winampMuteToggle) {
    S.winampMuteToggle.addEventListener("click", () => {
      if (!S.winampPlayer) return;
      syncWinampAudioState();
      if (S.winampMuted) {
        const restoreVolume = Math.max(1, S.winampLastVolume);
        S.winampPlayer.setVolume(restoreVolume);
        if (S.winampVolume) S.winampVolume.value = String(restoreVolume);
        S.winampPlayer.unMute();
        S.winampMuted = false;
        restartWinampFlutter();
      } else {
        S.winampPlayer.mute();
        S.winampMuted = true;
        restartWinampFlutter();
      }
      updateWinampUi();
    });
  }
  if (S.winampVisualModeToggle) {
    S.winampVisualModeToggle.addEventListener("click", () => {
      const currentIndex = WINAMP_VISUAL_MODES.indexOf(S.winampVisualMode);
      const nextMode = WINAMP_VISUAL_MODES[(currentIndex + 1) % WINAMP_VISUAL_MODES.length];
      setWinampVisualMode(nextMode);
    });
  }
  if (S.winampVolume) {
    S.winampVolume.addEventListener("input", () => {
      if (!S.winampPlayer) return;
      const volume = Number(S.winampVolume.value);
      S.winampPlayer.setVolume(volume);
      if (volume > 0) {
        S.winampLastVolume = volume;
        S.winampPlayer.unMute();
        S.winampMuted = false;
      } else {
        S.winampPlayer.mute();
        S.winampMuted = true;
      }
      restartWinampFlutter();
      updateWinampUi();
    });
  }
  if (window.YT && window.YT.Player) {
    initWinampPlayer();
  } else {
    window.onYouTubeIframeAPIReady = initWinampPlayer;
  }
  updateWinampUi();
}
