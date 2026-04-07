// js/state.js — Shared state, DOM references, and constants

// ── DOM elements (queried once at module load) ────────────────
export const desktop = document.getElementById("desktop");
export const windows = [...document.querySelectorAll(".window")];
export const openers = [...document.querySelectorAll(".desktop-icon")];
export const closers = [...document.querySelectorAll(".close-btn")];
export const menuButtons = [...document.querySelectorAll(".menu-item[data-menu]")];
export const menuActions = [...document.querySelectorAll(".menu-dropdown [data-action]")];
export const menuDropdowns = [...document.querySelectorAll(".menu-dropdown")];
export const clock = document.getElementById("clock");
export const menuBar = document.querySelector(".menu-bar");
export const mobileAppNav = document.getElementById("mobile-app-nav");
export const mobileAppTitle = document.getElementById("mobile-app-title");
export const mobileCloseBtn = document.getElementById("mobile-close-btn");

// ── Constants ─────────────────────────────────────────────────
export const BROWSER_HOME_URL = "about:home";
export const DESKTOP_STATE_KEY = "portfolio.desktop.state.v1";
export const THEME_STATE_KEY = "portfolio.desktop.theme.v1";
export const DEFAULT_THEME = "classic";
export const LEGACY_DARK_THEME = "midnight";
export const THEME_ACTION_MAP = {
  "set-theme-classic": "classic",
  "set-theme-midnight": "midnight",
  "set-theme-sunset": "sunset",
};
export const THEME_PROFILES = {
  classic: { clickGain: 1, flutterRange: 4, flutterInterval: 900 },
  midnight: { clickGain: 0.82, flutterRange: 3, flutterInterval: 960 },
  sunset: { clickGain: 1.15, flutterRange: 5, flutterInterval: 860 },
};
export const mobileLayoutQuery = window.matchMedia("(max-width: 900px)");
export const WINAMP_PLAYLIST_URL = "./assets/winamp-playlist.txt";
export const WINAMP_PLAYLIST = [
  { id: "K0HSD_i2DvA", title: "Daft Punk - Around The World (Official Music Video Remastered)" },
  { id: "0w-jjbE3Q9o", title: "Loading title…" },
  { id: "NqEGc7g5-J0", title: "Loading title…" },
  { id: "bueFTrwHFEs", title: "Loading title…" },
  { id: "Eo-KmOd3i7s", title: "Loading title…" },
  { id: "9Ht5RZpzPqw", title: "Loading title…" },
];

// ── Mutable shared state ──────────────────────────────────────
// Wrapped in an object so ES module imports get live updates.
export const S = {
  portfolioApps: [...(window.PORTFOLIO_APPS || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  ),
  topZ: 10,
  activeWindowId: null,
  isRestoringDesktopState: false,
  activeMenuButton: null,
  // Theme state
  activeThemeName: "classic",
  activeThemeProfile: { clickGain: 1, flutterRange: 4, flutterInterval: 900 },
  // Browser elements (populated by syncDynamicElements)
  projectList: null,
  browserFrame: null,
  browserAddress: null,
  browserTitle: null,
  browserBack: null,
  browserForward: null,
  browserHome: null,
  browserReload: null,
  browserStop: null,
  browserGo: null,
  browserThrobber: null,
  browserStatus: null,
  resumeText: null,
  // Winamp elements (populated by syncDynamicElements)
  winampPlayer: null,
  winampToggle: null,
  winampPrev: null,
  winampNext: null,
  winampMuteToggle: null,
  winampVolume: null,
  winampChannelList: null,
  winampChannelFilter: null,
  // Timeline
  timelineWindowContent: null,
  // Case studies
  caseStudyContent: null,
  caseStudyActiveId: "erasteel",
  // Winamp playback state
  winampActiveIndex: 0,
  winampPlaying: false,
  winampMuted: true,
  winampLastVolume: 35,
  winampFlutterTimer: null,
  winampPlaylistBound: false,
};

// ── Populate element refs from the DOM ────────────────────────
export function syncDynamicElements() {
  S.projectList = document.getElementById("project-list");
  S.browserFrame = document.getElementById("browser-frame");
  S.browserAddress = document.getElementById("browser-url");
  S.browserTitle = document.getElementById("browser-title");
  S.browserBack = document.getElementById("browser-back");
  S.browserForward = document.getElementById("browser-forward");
  S.browserHome = document.getElementById("browser-home");
  S.browserReload = document.getElementById("browser-reload");
  S.browserStop = document.getElementById("browser-stop");
  S.browserGo = document.getElementById("browser-go");
  S.browserThrobber = document.getElementById("browser-throbber");
  S.browserStatus = document.getElementById("browser-status");
  S.resumeText = document.getElementById("resume-text");
  S.winampToggle = document.getElementById("winamp-toggle");
  S.winampPrev = document.getElementById("winamp-prev");
  S.winampNext = document.getElementById("winamp-next");
  S.winampMuteToggle = document.getElementById("winamp-mute-toggle");
  S.winampVolume = document.getElementById("winamp-volume");
  S.winampChannelList = document.getElementById("winamp-channel-list");
  S.winampChannelFilter = document.getElementById("winamp-channel-filter");
  S.timelineWindowContent = document.getElementById("timeline-window-content");
  S.caseStudyContent = document.getElementById("case-study-content");
}
