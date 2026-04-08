// js/window-manager.js - Window management, desktop state, themes, drag, clock

import {
  desktop,
  windows,
  openers,
  mobileLayoutQuery,
  menuBar,
  mobileAppNav,
  mobileAppTitle,
  taskbarApps,
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

function fitWindowToContent(win) {
  if (!win || mobileLayoutQuery.matches || win.classList.contains("maximized") || !win.classList.contains("open")) return;

  const content = win.querySelector(".window-content");
  if (!content) return;

  const desktopWidth = desktop.clientWidth;
  const desktopHeight = desktop.clientHeight;
  if (!desktopWidth || !desktopHeight) return;

  const computed = window.getComputedStyle(win);
  const minWidth = parseFloat(computed.minWidth) || 0;
  const minHeight = parseFloat(computed.minHeight) || 0;
  const frameWidth = win.offsetWidth - content.clientWidth;
  const frameHeight = win.offsetHeight - content.clientHeight;
  const contentWidth = Math.ceil(content.scrollWidth);
  const contentHeight = Math.ceil(content.scrollHeight);

  const maxWidth = Math.max(minWidth, desktopWidth - 12);
  const maxHeight = Math.max(minHeight, desktopHeight - 12);
  const targetWidth = clamp(contentWidth + frameWidth + 6, minWidth, maxWidth);
  const targetHeight = clamp(contentHeight + frameHeight + 6, minHeight, maxHeight);

  const currentWidth = parseNumericStyle(win.style.width) || win.offsetWidth;
  const currentHeight = parseNumericStyle(win.style.height) || win.offsetHeight;

  if (targetWidth > currentWidth) win.style.width = `${targetWidth}px`;
  if (targetHeight > currentHeight) win.style.height = `${targetHeight}px`;

  applyClampedWindowPosition(win, win.offsetLeft, win.offsetTop);
}

function getWindowTitle(win) {
  const titleEl = win?.querySelector(".title-bar h2");
  return titleEl ? titleEl.textContent.trim() : win?.id.replace("-window", "") || "Window";
}

function getTaskbarButton(winId) {
  return taskbarApps?.querySelector(`[data-taskbar-window="${winId}"]`) || null;
}

function getWindowIconMarkup(win) {
  const opener = openers.find((icon) => icon.dataset.open === win.id);
  const openerImage = opener?.querySelector(".icon-image");
  if (!openerImage) {
    return `<span class="taskbar-app-fallback" aria-hidden="true">${getWindowTitle(win).slice(0, 1)}</span>`;
  }
  const src = openerImage.getAttribute("src") || "";
  const fallbackSrc = openerImage.dataset.fallbackSrc || "";
  return `<img class="taskbar-app-icon" src="${src}" ${fallbackSrc ? `data-fallback-src="${fallbackSrc}"` : ""} alt="" />`;
}

function bindTaskbarIconFallbackHandlers(scope = taskbarApps) {
  const icons = [...(scope?.querySelectorAll(".taskbar-app-icon") || [])];
  icons.forEach((icon) => {
    icon.addEventListener("error", () => {
      const fallbackSrc = icon.dataset.fallbackSrc;
      if (fallbackSrc && icon.getAttribute("src") !== fallbackSrc) {
        icon.setAttribute("src", fallbackSrc);
        return;
      }
      const fallback = document.createElement("span");
      fallback.className = "taskbar-app-fallback";
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = icon.closest(".taskbar-app")?.getAttribute("aria-label")?.slice(0, 1) || "?";
      icon.replaceWith(fallback);
    }, { once: true });
  });
}

function setTaskbarAnimationOrigin(win) {
  const button = getTaskbarButton(win.id);
  if (!button) return;
  const winRect = win.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const deltaX = (buttonRect.left + buttonRect.width / 2) - (winRect.left + winRect.width / 2);
  const deltaY = (buttonRect.top + buttonRect.height / 2) - (winRect.top + winRect.height / 2);
  win.style.setProperty("--taskbar-origin-x", `${Math.round(deltaX)}px`);
  win.style.setProperty("--taskbar-origin-y", `${Math.round(deltaY)}px`);
}

function animateWindow(win, animationClass, onEnd) {
  win.classList.remove("opening", "closing", "minimizing", "restoring");
  void win.offsetWidth;
  win.classList.add(animationClass);
  win.addEventListener("animationend", () => {
    win.classList.remove(animationClass);
    if (typeof onEnd === "function") onEnd();
  }, { once: true });
}

function updateWindowControlState(win) {
  const maximizeButton = win.querySelector(".maximize-btn");
  if (!maximizeButton) return;
  const isMaximized = win.classList.contains("maximized");
  maximizeButton.textContent = isMaximized ? "❐" : "□";
  maximizeButton.setAttribute("aria-label", isMaximized ? `Restore ${getWindowTitle(win)}` : `Maximize ${getWindowTitle(win)}`);
  maximizeButton.setAttribute("aria-pressed", isMaximized ? "true" : "false");
}

export function syncTaskbar() {
  if (!taskbarApps) return;
  taskbarApps.innerHTML = "";
  windows.forEach((win) => {
    const isOpen = win.classList.contains("open");
    if (!isOpen) {
      updateWindowControlState(win);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "taskbar-app";
    button.dataset.taskbarWindow = win.id;
    button.innerHTML = getWindowIconMarkup(win);
    button.setAttribute("aria-label", getWindowTitle(win));
    button.title = getWindowTitle(win);
    button.setAttribute("aria-pressed", isOpen && !win.classList.contains("minimized") ? "true" : "false");
    if (isOpen) button.classList.add("open");
    if (win.id === S.activeWindowId && isOpen && !win.classList.contains("minimized")) button.classList.add("active");
    if (win.classList.contains("minimized")) button.classList.add("minimized");
    taskbarApps.appendChild(button);
    updateWindowControlState(win);
  });
  bindTaskbarIconFallbackHandlers();
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
      width: parseNumericStyle(win.style.width),
      height: parseNumericStyle(win.style.height),
      minimized: win.classList.contains("minimized"),
      maximized: win.classList.contains("maximized"),
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
      if (Number.isFinite(Number(info.width))) win.style.width = `${Number(info.width)}px`;
      if (Number.isFinite(Number(info.height))) win.style.height = `${Number(info.height)}px`;
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
    validOpenWindows.forEach((win) => {
      const info = windowState[win.id];
      if (!info || typeof info !== "object") return;
      if (info.maximized) maximizeWindow(win.id, { persist: false });
      if (info.minimized) minimizeWindow(win.id, { persist: false, immediate: true });
    });
    const restoredTop = windows.reduce((maxZ, win) => Math.max(maxZ, Number(win.style.zIndex || 0)), 10);
    S.topZ = restoredTop;
    const topOpenWindow = windows
      .filter((win) => win.classList.contains("open") && !win.classList.contains("minimized"))
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .pop();
    S.activeWindowId = topOpenWindow?.id || null;
    syncTaskbar();
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
  win.classList.remove("minimized");
  if (mobileLayoutQuery.matches) {
    S.activeWindowId = win.id;
    syncTaskbar();
    return;
  }
  S.topZ += 1;
  win.style.zIndex = String(S.topZ);
  S.activeWindowId = win.id;
  syncTaskbar();
}

export function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.remove("closing", "minimizing");
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
    syncTaskbar();
    setTaskbarAnimationOrigin(win);
    requestAnimationFrame(() => animateWindow(win, "opening"));
    if (id === "about-window") startTypewriter();
    if (id === "dashboard-window" && typeof window.initializeDashboard === "function") {
      window.initializeDashboard();
    }
    if (id === "news-window" && typeof window.initializeNewsFeed === "function") {
      window.initializeNewsFeed();
    }
    if (id === "easter-error") RetroSounds.error();
  } else if (win.classList.contains("minimized")) {
    restoreWindow(id);
    return;
  }
  bringToFront(win);
  requestAnimationFrame(() => fitWindowToContent(win));
  if (mobileLayoutQuery.matches) updateMobileNav(win);
  syncTaskbar();
  saveDesktopState();
}

export function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win || !win.classList.contains("open")) return;
  setTaskbarAnimationOrigin(win);
  if (id === "winamp-window" && _stopWinampPlayback) {
    _stopWinampPlayback({ terminate: true });
  }
  if (id === "doom-window") {
    stopDoomSession();
  }
  if (S.activeWindowId === id) {
    win.classList.remove("focused");
    const topOpenWindow = windows
      .filter((w) => w.classList.contains("open") && !w.classList.contains("minimized") && w.id !== id)
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .pop();
    S.activeWindowId = topOpenWindow?.id || null;
    if (topOpenWindow) topOpenWindow.classList.add("focused");
  }
  if (mobileLayoutQuery.matches) updateMobileNav(null);
  RetroSounds.close();
  animateWindow(win, "closing", () => {
    win.classList.remove("open", "closing", "minimized", "maximized", "focused");
    syncTaskbar();
    saveDesktopState();
  });
  syncTaskbar();
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
  syncTaskbar();
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
      restoreWindow(win.id, { persist: false, immediate: true });
      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
      bringToFront(win);
      x += 34;
      y += 28;
    });
  saveDesktopState();
}

export function minimizeWindow(id, { persist = true, immediate = false } = {}) {
  const win = document.getElementById(id);
  if (!win || !win.classList.contains("open") || win.classList.contains("minimized")) return;
  setTaskbarAnimationOrigin(win);
  const finalize = () => {
    win.classList.add("minimized");
    win.classList.remove("focused");
    if (S.activeWindowId === id) {
      const topOpenWindow = windows
        .filter((w) => w.classList.contains("open") && !w.classList.contains("minimized") && w.id !== id)
        .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
        .pop();
      S.activeWindowId = topOpenWindow?.id || null;
      if (topOpenWindow) topOpenWindow.classList.add("focused");
    }
    if (mobileLayoutQuery.matches) updateMobileNav(null);
    syncTaskbar();
    if (persist) saveDesktopState();
  };
  if (immediate) {
    finalize();
    return;
  }
  animateWindow(win, "minimizing", finalize);
}

export function restoreWindow(id, { persist = true, immediate = false } = {}) {
  const win = document.getElementById(id);
  if (!win || !win.classList.contains("open")) return;
  setTaskbarAnimationOrigin(win);
  win.classList.remove("minimized");
  bringToFront(win);
  requestAnimationFrame(() => fitWindowToContent(win));
  if (mobileLayoutQuery.matches) updateMobileNav(win);
  if (immediate) {
    syncTaskbar();
    if (persist) saveDesktopState();
    return;
  }
  animateWindow(win, "restoring", () => {
    syncTaskbar();
    if (persist) saveDesktopState();
  });
}

export function maximizeWindow(id, { persist = true, restore = false } = {}) {
  const win = document.getElementById(id);
  if (!win || !win.classList.contains("open")) return;
  if (restore) {
    win.classList.remove("maximized");
    if (win.dataset.restoreLeft) win.style.left = win.dataset.restoreLeft;
    if (win.dataset.restoreTop) win.style.top = win.dataset.restoreTop;
    if (win.dataset.restoreWidth) win.style.width = win.dataset.restoreWidth;
    if (win.dataset.restoreHeight) win.style.height = win.dataset.restoreHeight;
  } else {
    win.dataset.restoreLeft = win.style.left || `${win.offsetLeft}px`;
    win.dataset.restoreTop = win.style.top || `${win.offsetTop}px`;
    win.dataset.restoreWidth = win.style.width || `${win.offsetWidth}px`;
    win.dataset.restoreHeight = win.style.height || `${win.offsetHeight}px`;
    win.classList.add("maximized");
    win.classList.remove("minimized");
    win.style.left = "0px";
    win.style.top = "0px";
  }
  bringToFront(win);
  updateWindowControlState(win);
  syncTaskbar();
  if (persist) saveDesktopState();
}

export function toggleMaximizeWindow(id, { persist = true } = {}) {
  const win = document.getElementById(id);
  if (!win || !win.classList.contains("open")) return;
  maximizeWindow(id, { persist, restore: win.classList.contains("maximized") });
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
      if (event.target.closest(".window-btn") || event.target.closest(".close-btn")) return;
      if (win.classList.contains("maximized")) return;
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
