// js/window-manager.js - Window management, desktop state, themes, drag, clock

import {
  desktop,
  windows,
  mobileLayoutQuery,
  menuBar,
  mobileAppNav,
  mobileAppTitle,
  clock,
  DESKTOP_STATE_KEY,
  THEME_STATE_KEY,
  BACKGROUND_MODE_STATE_KEY,
  DEFAULT_THEME,
  DEFAULT_BACKGROUND_MODE,
  LEGACY_DARK_THEME,
  THEME_PROFILES,
  S,
} from "./state.js";
import { clamp, parseNumericStyle, markdownToRetroHtml } from "./utils.js";
import { RetroSounds } from "./sounds.js";
import { loadBrowserHomePage } from "./browser.js";

// Late-bound reference to avoid circular dependency with winamp.js
let _restartWinampFlutter = null;
export function setRestartWinampFlutter(fn) { _restartWinampFlutter = fn; }
let _stopWinampPlayback = null;
export function setStopWinampPlayback(fn) { _stopWinampPlayback = fn; }

function restartDoomSession() {
  const doomFrame = document.getElementById("doom-frame");
  if (!doomFrame) return;
  const sourceUrl = doomFrame.dataset.src || doomFrame.getAttribute("src") || "about:blank";
  if (doomFrame.getAttribute("src") !== sourceUrl) {
    doomFrame.setAttribute("src", sourceUrl);
  }
}

function stopDoomSession() {
  const doomFrame = document.getElementById("doom-frame");
  if (!doomFrame) return;
  if (!doomFrame.dataset.src) {
    doomFrame.dataset.src = doomFrame.getAttribute("src") || "about:blank";
  }
  if (doomFrame.getAttribute("src") !== "about:blank") {
    doomFrame.setAttribute("src", "about:blank");
  }
}

function applyClampedWindowPosition(win, left, top) {
  if (!Number.isFinite(left) || !Number.isFinite(top)) return;
  const maxX = Math.max(0, desktop.clientWidth - win.offsetWidth);
  const maxY = Math.max(0, desktop.clientHeight - win.offsetHeight);
  win.style.left = `${clamp(left, 0, maxX)}px`;
  win.style.top = `${clamp(top, 0, maxY)}px`;
}

function collectDesktopState() {
  const state = {
    openWindowIds: windows.filter((win) => win.classList.contains("open")).map((win) => win.id),
    windows: {},
  };
  windows.forEach((win) => {
    state.windows[win.id] = {
      left: parseNumericStyle(win.style.left),
      top: parseNumericStyle(win.style.top),
      zIndex: parseNumericStyle(win.style.zIndex),
    };
  });
  return state;
}

function resolveThemeName(rawThemeName) {
  if (typeof rawThemeName !== "string") return DEFAULT_THEME;
  const normalizedName = rawThemeName.trim().toLowerCase();
  return Object.hasOwn(THEME_PROFILES, normalizedName) ? normalizedName : DEFAULT_THEME;
}

function updateThemeMenuLabels() {
  const themeOptionButtons = [...document.querySelectorAll("[data-theme-option]")];
  themeOptionButtons.forEach((button) => {
    const option = button.dataset.themeOption;
    const baseLabel = button.dataset.themeLabel
      || button.textContent.replace(/^\[[ x]\]\s*/, "").replace(/^[^\w]+\s*/, "").trim();
    button.dataset.themeLabel = baseLabel;
    button.textContent = option === S.activeThemeName ? `[x] ${baseLabel}` : baseLabel;
    button.setAttribute("aria-checked", option === S.activeThemeName ? "true" : "false");
  });
}

function applyThemeAudioProfile() {
  S.activeThemeProfile = THEME_PROFILES[S.activeThemeName] || THEME_PROFILES[DEFAULT_THEME];
  if (typeof RetroSounds?.setProfile === "function") {
    RetroSounds.setProfile({ clickGain: S.activeThemeProfile.clickGain });
  }
  if (_restartWinampFlutter) _restartWinampFlutter();
}

function updateBackgroundModeMenuLabels() {
  const backgroundOptionButtons = [...document.querySelectorAll("[data-bg-mode-option]")];
  backgroundOptionButtons.forEach((button) => {
    const option = button.dataset.bgModeOption;
    const baseLabel = button.dataset.modeLabel
      || button.textContent.replace(/^\[[ x]\]\s*/, "").replace(/^[^\w]+\s*/, "").trim();
    button.dataset.modeLabel = baseLabel;
    button.textContent = option === S.activeBackgroundMode ? `[x] ${baseLabel}` : baseLabel;
    button.setAttribute("aria-checked", option === S.activeBackgroundMode ? "true" : "false");
  });
}

export function applyTheme(themeName, { persist = true } = {}) {
  S.activeThemeName = resolveThemeName(themeName);
  document.body.dataset.theme = S.activeThemeName;
  updateThemeMenuLabels();
  applyThemeAudioProfile();
  if (!persist) return;
  try {
    window.localStorage.setItem(THEME_STATE_KEY, S.activeThemeName);
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

export function restoreThemePreference() {
  let savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem(THEME_STATE_KEY);
  } catch {
    savedTheme = null;
  }
  applyTheme(savedTheme || DEFAULT_THEME, { persist: false });
}

function resolveBackgroundMode(rawMode) {
  if (typeof rawMode !== "string") return DEFAULT_BACKGROUND_MODE;
  const normalizedMode = rawMode.trim().toLowerCase();
  return ["fill", "center", "tile"].includes(normalizedMode) ? normalizedMode : DEFAULT_BACKGROUND_MODE;
}

export function applyBackgroundMode(modeName, { persist = true } = {}) {
  S.activeBackgroundMode = resolveBackgroundMode(modeName);
  document.body.dataset.bgMode = S.activeBackgroundMode;
  updateBackgroundModeMenuLabels();
  if (!persist) return;
  try {
    window.localStorage.setItem(BACKGROUND_MODE_STATE_KEY, S.activeBackgroundMode);
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

export function restoreBackgroundModePreference() {
  let savedMode = null;
  try {
    savedMode = window.localStorage.getItem(BACKGROUND_MODE_STATE_KEY);
  } catch {
    savedMode = null;
  }
  applyBackgroundMode(savedMode || DEFAULT_BACKGROUND_MODE, { persist: false });
}

export function saveDesktopState() {
  if (S.isRestoringDesktopState) return;
  try {
    window.localStorage.setItem(DESKTOP_STATE_KEY, JSON.stringify(collectDesktopState()));
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

export function restoreDesktopState() {
  let parsed;
  try {
    parsed = JSON.parse(window.localStorage.getItem(DESKTOP_STATE_KEY) || "null");
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const windowState = parsed.windows && typeof parsed.windows === "object" ? parsed.windows : {};
  const openIds = Array.isArray(parsed.openWindowIds) ? parsed.openWindowIds : [];
  const hasThemePreference = (() => {
    try {
      return Boolean(window.localStorage.getItem(THEME_STATE_KEY));
    } catch {
      return false;
    }
  })();
  S.isRestoringDesktopState = true;
  try {
    if (!hasThemePreference && parsed.darkDesktop === true) {
      applyTheme(LEGACY_DARK_THEME);
    }
    windows.forEach((win) => {
      const info = windowState[win.id];
      if (!info || typeof info !== "object") return;
      applyClampedWindowPosition(win, Number(info.left), Number(info.top));
      if (Number.isFinite(Number(info.zIndex))) {
        win.style.zIndex = String(Number(info.zIndex));
      }
    });
    windows.forEach((win) => win.classList.remove("open"));
    const validOpenWindows = openIds
      .map((id) => document.getElementById(id))
      .filter((win) => win && windows.includes(win));
    if (validOpenWindows.length === 0) return false;
    const sortedByZ = [...validOpenWindows].sort(
      (a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0)
    );
    sortedByZ.forEach((win) => openWindow(win.id));
    const restoredTop = windows.reduce((maxZ, win) => Math.max(maxZ, Number(win.style.zIndex || 0)), 10);
    S.topZ = restoredTop;
    const topOpenWindow = windows
      .filter((win) => win.classList.contains("open"))
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .pop();
    S.activeWindowId = topOpenWindow?.id || null;
    return true;
  } finally {
    S.isRestoringDesktopState = false;
  }
}

export function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function updateMobileNav(openWin) {
  if (!mobileLayoutQuery.matches) return;
  if (openWin) {
    const titleEl = openWin.querySelector(".title-bar h2");
    const title = titleEl ? titleEl.textContent.trim() : openWin.id.replace("-window", "");
    mobileAppTitle.textContent = title;
    mobileAppNav.classList.add("active");
    mobileAppNav.setAttribute("aria-hidden", "false");
    menuBar.classList.add("app-open");
  } else {
    mobileAppNav.classList.remove("active");
    mobileAppNav.setAttribute("aria-hidden", "true");
    menuBar.classList.remove("app-open");
  }
}

export function bringToFront(win) {
  windows.forEach((w) => w.classList.remove("focused"));
  win.classList.add("focused");
  if (mobileLayoutQuery.matches) {
    S.activeWindowId = win.id;
    return;
  }
  S.topZ += 1;
  win.style.zIndex = String(S.topZ);
  S.activeWindowId = win.id;
}

export function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.remove("closing");
  if (mobileLayoutQuery.matches) {
    windows.forEach((windowEl) => {
      if (windowEl.id !== id) windowEl.classList.remove("open");
    });
  }
  if (id === "browser-window" && S.browserAddress?.value === "about:blank") {
    loadBrowserHomePage();
  }
  if (id === "doom-window") {
    restartDoomSession();
  }
  const wasOpen = win.classList.contains("open");
  win.classList.add("open");
  if (!wasOpen) {
    RetroSounds.open();
    requestAnimationFrame(() => {
      win.classList.add("opening");
      win.addEventListener("animationend", () => win.classList.remove("opening"), { once: true });
    });
    if (id === "about-window") startTypewriter();
    if (id === "dashboard-window" && typeof window.initializeDashboard === "function") {
      window.initializeDashboard();
    }
    if (id === "news-window" && typeof window.initializeNewsFeed === "function") {
      window.initializeNewsFeed();
    }
    if (id === "easter-error") RetroSounds.error();
  }
  bringToFront(win);
  if (mobileLayoutQuery.matches) updateMobileNav(win);
  saveDesktopState();
}

export function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win || !win.classList.contains("open")) return;
  if (id === "winamp-window" && _stopWinampPlayback) {
    _stopWinampPlayback({ terminate: true });
  }
  if (id === "doom-window") {
    stopDoomSession();
  }
  if (S.activeWindowId === id) {
    win.classList.remove("focused");
    const topOpenWindow = windows
      .filter((w) => w.classList.contains("open") && w.id !== id)
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .pop();
    S.activeWindowId = topOpenWindow?.id || null;
    if (topOpenWindow) topOpenWindow.classList.add("focused");
  }
  if (mobileLayoutQuery.matches) updateMobileNav(null);
  RetroSounds.close();
  win.classList.add("closing");
  win.addEventListener("animationend", () => {
    win.classList.remove("open", "closing");
  }, { once: true });
}

export function closeFocusedWindow() {
  if (S.activeWindowId) closeWindow(S.activeWindowId);
}

export function closeAllWindows() {
  windows.forEach((win) => {
    if (win.classList.contains("open")) closeWindow(win.id);
  });
  S.activeWindowId = null;
  windows.forEach((w) => w.classList.remove("focused"));
  saveDesktopState();
}

export function openAllWindows() {
  if (mobileLayoutQuery.matches) {
    openWindow("about-window");
    return;
  }
  windows.forEach((win) => openWindow(win.id));
}

export function cascadeWindows() {
  if (mobileLayoutQuery.matches) return;
  let x = 210;
  let y = 75;
  windows
    .filter((win) => win.classList.contains("open"))
    .forEach((win) => {
      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
      bringToFront(win);
      x += 34;
      y += 28;
    });
  saveDesktopState();
}

let typewriterDone = false;

export function startTypewriter() {
  if (typewriterDone) return;
  const target = document.getElementById("about-typewriter-text");
  if (!target) return;
  typewriterDone = true;

  const fullText = target.textContent.trim();
  target.textContent = "";

  const cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";
  cursor.setAttribute("aria-hidden", "true");
  target.appendChild(cursor);

  let i = 0;
  function type() {
    if (i >= fullText.length) {
      setTimeout(() => cursor.remove(), 1800);
      return;
    }
    target.insertBefore(document.createTextNode(fullText[i]), cursor);
    i += 1;
    setTimeout(type, 28 + Math.random() * 22);
  }
  setTimeout(type, 200);
}

export async function loadCaseStudy(id) {
  if (!S.caseStudyContent) return;
  S.caseStudyActiveId = id;
  S.caseStudyContent.textContent = "Loading...";
  try {
    const response = await fetch(`assets/case-study-${id}.md`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    S.caseStudyContent.innerHTML = markdownToRetroHtml(markdown);
  } catch (error) {
    S.caseStudyContent.textContent = [
      "ERROR: Could not load case study.",
      `Details: ${error.message}`,
    ].join("\n");
  }
}

export async function loadResumeTextFile() {
  if (!S.resumeText) return;
  try {
    const response = await fetch("assets/sanjin.md", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    S.resumeText.innerHTML = markdownToRetroHtml(markdown);
  } catch (error) {
    S.resumeText.textContent = [
      "ERROR: Could not load SANJIN.MD",
      "Please make sure assets/sanjin.md exists.",
      "",
      `Details: ${error.message}`,
    ].join("\n");
  }
}

export function bindIconFallbackHandlers() {
  const icons = [...document.querySelectorAll(".icon-image")];
  icons.forEach((icon) => {
    icon.addEventListener("error", () => {
      const fallbackSrc = icon.dataset.fallbackSrc;
      if (!fallbackSrc || icon.src.endsWith(fallbackSrc)) {
        icon.style.visibility = "hidden";
        return;
      }
      icon.src = fallbackSrc;
    });
  });
}

export function initDragHandlers() {
  windows.forEach((win) => {
    const handle = win.querySelector(".drag-handle");
    if (!handle) return;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function onMove(event) {
      if (!dragging) return;
      const x = event.clientX - offsetX;
      const y = event.clientY - offsetY;
      const maxX = desktop.offsetWidth - win.offsetWidth;
      const maxY = desktop.offsetHeight - win.offsetHeight;
      win.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      win.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    }

    handle.addEventListener("pointerdown", (event) => {
      if (mobileLayoutQuery.matches) return;
      if (event.target.closest(".close-btn")) return;
      dragging = true;
      win.classList.add("dragging");
      bringToFront(win);
      const rect = win.getBoundingClientRect();
      const desktopRect = desktop.getBoundingClientRect();
      offsetX = event.clientX - (rect.left - desktopRect.left);
      offsetY = event.clientY - (rect.top - desktopRect.top);
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointerup", (event) => {
      dragging = false;
      win.classList.remove("dragging");
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      saveDesktopState();
    });

    handle.addEventListener("pointercancel", (event) => {
      dragging = false;
      win.classList.remove("dragging");
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      saveDesktopState();
    });

    handle.addEventListener("pointermove", onMove);
    win.addEventListener("mousedown", () => {
      if (mobileLayoutQuery.matches) return;
      bringToFront(win);
    });
  });
}
