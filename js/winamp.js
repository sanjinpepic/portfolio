// js/winamp.js — Winamp player module

import { S, WINAMP_PLAYLIST } from "./state.js";
import { clamp } from "./utils.js";
import { vintageSpeaker } from "./sounds.js";

// ── Internal helpers ──────────────────────────────────────────

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
  if (S.winampStatus && WINAMP_PLAYLIST[S.winampActiveIndex]) {
    S.winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[S.winampActiveIndex].title}`;
  }
}

function updateWinampUi() {
  if (S.winampToggle) S.winampToggle.textContent = S.winampPlaying ? "⏸ Pause" : "▶ Play";
  if (S.winampMuteToggle) {
    S.winampMuteToggle.textContent = S.winampMuted ? "🔇 Muted" : "🔊 Sound On";
  }
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
  if (S.winampPlayer) {
    if (terminate && typeof S.winampPlayer.stopVideo === "function") {
      S.winampPlayer.stopVideo();
    } else if (typeof S.winampPlayer.pauseVideo === "function") {
      S.winampPlayer.pauseVideo();
    }
  }
  S.winampPlaying = false;
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
  if (S.winampFlutterTimer) {
    window.clearInterval(S.winampFlutterTimer);
    S.winampFlutterTimer = null;
  }
  if (!S.winampPlayer || S.winampMuted || !S.winampPlaying || S.winampLastVolume <= 0) return;
  const flutterRange = Math.max(1, Number(S.activeThemeProfile?.flutterRange) || 4);
  const flutterInterval = Math.max(250, Number(S.activeThemeProfile?.flutterInterval) || 900);
  S.winampFlutterTimer = window.setInterval(() => {
    if (!S.winampPlayer || S.winampMuted || !S.winampPlaying) return;
    const flutterAmount = Math.round((Math.random() - 0.5) * flutterRange);
    const adjustedVolume = clamp(S.winampLastVolume + flutterAmount, 1, 100);
    S.winampPlayer.setVolume(adjustedVolume);
  }, flutterInterval);
}

function selectWinampChannel(index, { autoPlay = true } = {}) {
  if (!S.winampPlayer || !WINAMP_PLAYLIST[index]) return;
  S.winampActiveIndex = index;
  S.winampPlayer.loadVideoById(WINAMP_PLAYLIST[index].id);
  if (autoPlay) S.winampPlayer.playVideo();
  if (S.winampStatus) S.winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[index].title}`;
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
      return `${groupHeader}<button type="button" class="retro-btn winamp-channel-btn" data-winamp-index="${index}" role="option">CH ${String(index + 1).padStart(2, "0")} · ${title}</button>`;
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
        if (S.winampStatus) S.winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[0].title}`;
        updateWinampUi();
        restartWinampFlutter();
        event.target.playVideo();
      },
      onStateChange: (event) => {
        S.winampPlaying = event.data === window.YT.PlayerState.PLAYING;
        syncWinampAudioState();
        restartWinampFlutter();
        if (S.winampPlaying && !S.winampMuted) {
          vintageSpeaker.setVolume(S.winampLastVolume);
        } else {
          vintageSpeaker.mute();
        }
        if (event.data === window.YT.PlayerState.ENDED) {
          const next = (S.winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
          selectWinampChannel(next);
          return;
        }
        updateWinampUi();
      },
      onError: () => {
        if (S.winampStatus) {
          S.winampStatus.textContent = "This channel is unavailable in embed mode. Skipping to next.";
        }
        const next = (S.winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
        setTimeout(() => selectWinampChannel(next), 800);
      }
    }
  });
}

// ── Exported functions ────────────────────────────────────────

export function bindWinampControls() {
  setupWinampPlaylistUi();
  hydrateWinampPlaylistTitles();
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
        vintageSpeaker.setVolume(restoreVolume);
        restartWinampFlutter();
      } else {
        S.winampPlayer.mute();
        S.winampMuted = true;
        vintageSpeaker.mute();
        restartWinampFlutter();
      }
      updateWinampUi();
    });
  }
  if (S.winampVolume) {
    S.winampVolume.addEventListener("input", () => {
      if (!S.winampPlayer) return;
      const volume = Number(S.winampVolume.value);
      S.winampPlayer.setVolume(volume);
      vintageSpeaker.setVolume(volume);
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
}
