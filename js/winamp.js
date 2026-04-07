// js/winamp.js - Winamp player module

import { S, WINAMP_PLAYLIST, WINAMP_PLAYLIST_URL } from "./state.js";
import { clamp } from "./utils.js";
import { vintageSpeaker } from "./sounds.js";

// Internal helpers

let winampClockTimer = null;
const VISUALIZER_BAR_COUNT = 24;

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

  context.clearRect(0, 0, width, height);

  const backgroundGradient = context.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, `hsl(${(time * 45 + playbackTime * 12) % 360} 80% 9%)`);
  backgroundGradient.addColorStop(0.5, `hsl(${(time * 70 + 110) % 360} 85% 18%)`);
  backgroundGradient.addColorStop(1, "#03040a");
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);

  for (let i = 0; i < 18; i += 1) {
    const pulse = 0.35 + Math.sin(time * 1.3 + i * 0.9 + playbackTime * 0.6) * 0.18;
    const glowX = (i / 17) * width;
    const glowY = height * (0.18 + ((i % 5) / 10));
    const glowRadius = width * (0.07 + pulse * 0.06);
    const glow = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
    glow.addColorStop(0, `hsla(${(time * 90 + i * 18) % 360} 100% 65% / ${0.22 + energy * 0.18})`);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.fillRect(glowX - glowRadius, glowY - glowRadius, glowRadius * 2, glowRadius * 2);
  }

  const barWidth = width / VISUALIZER_BAR_COUNT;
  for (let i = 0; i < VISUALIZER_BAR_COUNT; i += 1) {
    const phase = time * (1.6 + normalizedVolume) + i * 0.42 + playbackTime * 0.2;
    const harmonic = Math.sin(phase) + Math.sin(phase * 1.9) * 0.45 + Math.cos(phase * 0.65) * 0.25;
    const normalizedHeight = clamp(0.18 + energy * 0.95 * (0.5 + harmonic * 0.25 + (i % 5) * 0.03), 0.08, 0.96);
    const barHeight = normalizedHeight * height;
    const x = i * barWidth + barWidth * 0.11;
    const y = height - barHeight;
    const fill = context.createLinearGradient(0, y, 0, height);
    fill.addColorStop(0, `hsla(${(time * 120 + i * 11) % 360} 100% 68% / 0.95)`);
    fill.addColorStop(0.45, `hsla(${(time * 120 + i * 11 + 58) % 360} 100% 55% / 0.9)`);
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
    const wave = Math.sin((i / width) * Math.PI * 7 + time * 3.2 + playbackTime * 0.4);
    const mod = Math.cos((i / width) * Math.PI * 2.3 - time * 2.1);
    const y = height * (0.54 + wave * 0.09 * energy + mod * 0.03);
    if (i === 0) context.moveTo(i, y);
    else context.lineTo(i, y);
  }
  context.stroke();

  S.winampVisualizerFrame = window.requestAnimationFrame(drawWinampVisualizerFrame);
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
  S.winampVisualMode = mode === "visualizer" ? "visualizer" : "video";
  if (S.winampScreenWrap) {
    S.winampScreenWrap.dataset.visualMode = S.winampVisualMode;
  }
  if (S.winampVisualModeToggle) {
    const showingVisualizer = S.winampVisualMode === "visualizer";
    S.winampVisualModeToggle.textContent = showingVisualizer ? "Video" : "Visualizer";
    S.winampVisualModeToggle.setAttribute("aria-pressed", showingVisualizer ? "true" : "false");
  }
  if (S.winampModeLabel) {
    S.winampModeLabel.textContent = S.winampVisualMode === "visualizer" ? "Visualizer" : "Video";
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
      const nextMode = S.winampVisualMode === "video" ? "visualizer" : "video";
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
