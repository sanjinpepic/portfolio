const desktop = document.getElementById("desktop");
const windows = [...document.querySelectorAll(".window")];
const openers = [...document.querySelectorAll(".desktop-icon")];
const closers = [...document.querySelectorAll(".close-btn")];
const menuButtons = [...document.querySelectorAll(".menu-item[data-menu]")];
const menuActions = [...document.querySelectorAll(".menu-dropdown [data-action]")];
const menuDropdowns = [...document.querySelectorAll(".menu-dropdown")];
let portfolioApps = [...(window.PORTFOLIO_APPS || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
const clock = document.getElementById("clock");
const menuBar = document.querySelector(".menu-bar");
const mobileAppNav = document.getElementById("mobile-app-nav");
const mobileAppTitle = document.getElementById("mobile-app-title");
const mobileCloseBtn = document.getElementById("mobile-close-btn");
const BROWSER_HOME_URL = "about:home";
const DESKTOP_STATE_KEY = "portfolio.desktop.state.v1";
const THEME_STATE_KEY = "portfolio.desktop.theme.v1";
const DEFAULT_THEME = "classic";
const LEGACY_DARK_THEME = "midnight";
const THEME_ACTION_MAP = {
  "set-theme-classic": "classic",
  "set-theme-midnight": "midnight",
  "set-theme-sunset": "sunset"
};
const THEME_PROFILES = {
  classic: { clickGain: 1, flutterRange: 4, flutterInterval: 900 },
  midnight: { clickGain: 0.82, flutterRange: 3, flutterInterval: 960 },
  sunset: { clickGain: 1.15, flutterRange: 5, flutterInterval: 860 }
};
let activeThemeName = DEFAULT_THEME;
let activeThemeProfile = THEME_PROFILES[DEFAULT_THEME];
const mobileLayoutQuery = window.matchMedia("(max-width: 900px)");
const WINAMP_PLAYLIST = [
  { id: "K0HSD_i2DvA", title: "Daft Punk - Around The World (Official Music Video Remastered)" },
  { id: "0w-jjbE3Q9o", title: "Loading title…" },
  { id: "NqEGc7g5-J0", title: "Loading title…" },
  { id: "bueFTrwHFEs", title: "Loading title…" },
  { id: "Eo-KmOd3i7s", title: "Loading title…" },
  { id: "9Ht5RZpzPqw", title: "Loading title…" }
];
let projectList = null;
let browserFrame = null;
let browserAddress = null;
let browserTitle = null;
let browserBack = null;
let browserForward = null;
let browserHome = null;
let browserReload = null;
let browserStop = null;
let browserGo = null;
let browserThrobber = null;
let browserStatus = null;
let resumeText = null;
let winampPlayer = null;
let winampToggle = null;
let winampPrev = null;
let winampNext = null;
let winampMuteToggle = null;
let winampVolume = null;
let winampChannelList = null;
let winampChannelFilter = null;
let winampStatus = null;
let timelineWindowContent = null;
let winampActiveIndex = 0;
let winampPlaying = false;
let winampMuted = true;
let winampLastVolume = 35;
let winampFlutterTimer = null;
let winampPlaylistBound = false;
let activeMenuButton = null;
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function inlineMarkdownToHtml(line) {
  const escaped = escapeHtml(line);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function markdownToRetroHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let listOpen = false;
  let paragraph = [];
  function closeParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${inlineMarkdownToHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  }
  function closeList() {
    if (!listOpen) return;
    out.push("</ul>");
    listOpen = false;
  }
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      closeParagraph();
      closeList();
      return;
    }
    if (/^---+$/.test(line)) {
      closeParagraph();
      closeList();
      out.push("<hr>");
      return;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeParagraph();
      closeList();
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inlineMarkdownToHtml(headingMatch[2])}</h${level}>`);
      return;
    }
    const listMatch = line.match(/^-\s+(.*)$/);
    if (listMatch) {
      closeParagraph();
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inlineMarkdownToHtml(listMatch[1])}</li>`);
      return;
    }
    closeList();
    paragraph.push(line);
  });
  closeParagraph();
  closeList();
  return out.join("\n");
}
async function loadResumeTextFile() {
  if (!resumeText) return;
  try {
    const response = await fetch("assets/sanjin.md", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    resumeText.innerHTML = markdownToRetroHtml(markdown);
  } catch (error) {
    resumeText.textContent = [
      "ERROR: Could not load SANJIN.MD",
      "Please make sure assets/sanjin.md exists.",
      "",
      `Details: ${error.message}`
    ].join("\n");
  }
}
function syncDynamicElements() {
  projectList = document.getElementById("project-list");
  browserFrame = document.getElementById("browser-frame");
  browserAddress = document.getElementById("browser-url");
  browserTitle = document.getElementById("browser-title");
  browserBack = document.getElementById("browser-back");
  browserForward = document.getElementById("browser-forward");
  browserHome = document.getElementById("browser-home");
  browserReload = document.getElementById("browser-reload");
  browserStop = document.getElementById("browser-stop");
  browserGo = document.getElementById("browser-go");
  browserThrobber = document.getElementById("browser-throbber");
  browserStatus = document.getElementById("browser-status");
  resumeText = document.getElementById("resume-text");
  winampToggle = document.getElementById("winamp-toggle");
  winampPrev = document.getElementById("winamp-prev");
  winampNext = document.getElementById("winamp-next");
  winampMuteToggle = document.getElementById("winamp-mute-toggle");
  winampVolume = document.getElementById("winamp-volume");
  winampChannelList = document.getElementById("winamp-channel-list");
  winampChannelFilter = document.getElementById("winamp-channel-filter");
  winampStatus = document.getElementById("winamp-status");
  timelineWindowContent = document.getElementById("timeline-window-content");
}
let topZ = 10;
let activeWindowId = null;
let isRestoringDesktopState = false;
function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
function parseNumericStyle(value) {
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    windows: {}
  };
  windows.forEach((win) => {
    state.windows[win.id] = {
      left: parseNumericStyle(win.style.left),
      top: parseNumericStyle(win.style.top),
      zIndex: parseNumericStyle(win.style.zIndex)
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
    const baseLabel = button.dataset.themeLabel || button.textContent.replace(/^✓\s*/, "").trim();
    button.dataset.themeLabel = baseLabel;
    button.textContent = option === activeThemeName ? `✓ ${baseLabel}` : baseLabel;
    button.setAttribute("aria-checked", option === activeThemeName ? "true" : "false");
  });
}
function applyThemeAudioProfile() {
  activeThemeProfile = THEME_PROFILES[activeThemeName] || THEME_PROFILES[DEFAULT_THEME];
  if (typeof RetroSounds?.setProfile === "function") {
    RetroSounds.setProfile({ clickGain: activeThemeProfile.clickGain });
  }
  restartWinampFlutter();
}
function applyTheme(themeName, { persist = true } = {}) {
  activeThemeName = resolveThemeName(themeName);
  document.body.dataset.theme = activeThemeName;
  updateThemeMenuLabels();
  applyThemeAudioProfile();
  if (!persist) return;
  try {
    window.localStorage.setItem(THEME_STATE_KEY, activeThemeName);
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}
function restoreThemePreference() {
  let savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem(THEME_STATE_KEY);
  } catch {
    savedTheme = null;
  }
  applyTheme(savedTheme || DEFAULT_THEME, { persist: false });
}
function saveDesktopState() {
  if (isRestoringDesktopState) return;
  try {
    window.localStorage.setItem(DESKTOP_STATE_KEY, JSON.stringify(collectDesktopState()));
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}
function restoreDesktopState() {
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
  isRestoringDesktopState = true;
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
    topZ = restoredTop;
    const topOpenWindow = windows
      .filter((win) => win.classList.contains("open"))
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .pop();
    activeWindowId = topOpenWindow?.id || null;
    return true;
  } finally {
    isRestoringDesktopState = false;
  }
}
function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function updateMobileNav(openWin) {
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

function bringToFront(win) {
  windows.forEach((w) => w.classList.remove("focused"));
  win.classList.add("focused");
  if (mobileLayoutQuery.matches) {
    activeWindowId = win.id;
    return;
  }
  topZ += 1;
  win.style.zIndex = String(topZ);
  activeWindowId = win.id;
}
function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  // Cancel any in-progress close animation
  win.classList.remove("closing");
  if (mobileLayoutQuery.matches) {
    windows.forEach((windowEl) => {
      if (windowEl.id !== id) windowEl.classList.remove("open");
    });
  }
  if (id === "browser-window" && browserAddress?.value === "about:blank") {
    loadBrowserHomePage();
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
    if (id === "easter-error") RetroSounds.error();
  }
  bringToFront(win);
  if (mobileLayoutQuery.matches) updateMobileNav(win);
  saveDesktopState();
}
function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win || !win.classList.contains("open")) return;
  // Transfer focus immediately
  if (activeWindowId === id) {
    win.classList.remove("focused");
    const topOpenWindow = windows
      .filter((w) => w.classList.contains("open") && w.id !== id)
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .pop();
    activeWindowId = topOpenWindow?.id || null;
    if (topOpenWindow) topOpenWindow.classList.add("focused");
  }
  // On mobile, hide the app nav when closing
  if (mobileLayoutQuery.matches) updateMobileNav(null);
  // Animate close
  RetroSounds.close();
  win.classList.add("closing");
  win.addEventListener("animationend", () => {
    win.classList.remove("open", "closing");
  }, { once: true });
}
// Threat model: treat browser-window navigation as untrusted input.
// Only explicitly allowlisted project URLs (plus local home/about pages) can load,
// so typo-squats, user-pasted phishing links, and open-redirect chains are blocked.
const ALLOWED_URLS = new Set(["about:blank"]);
portfolioApps.forEach((app) => {
  if (app.url) ALLOWED_URLS.add(app.url);
});
function normalizeBrowserUrl(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return null;
  if (trimmedUrl === "about:blank" || trimmedUrl === BROWSER_HOME_URL) return trimmedUrl;

  const hasProtocol = /^https?:\/\//i.test(trimmedUrl) || trimmedUrl.startsWith("about:");
  const looksLikeLocalPath =
    /^\.{0,2}\//.test(trimmedUrl) || trimmedUrl.startsWith("/") || /^[\w-]+\/[\w./-]+$/.test(trimmedUrl);
  const preparedUrl = hasProtocol || looksLikeLocalPath ? trimmedUrl : `https://${trimmedUrl}`;

  let parsed;
  try {
    parsed = new URL(preparedUrl, window.location.href);
  } catch {
    return null;
  }

  if (!/^https?:$/.test(parsed.protocol)) return null;

  parsed.hash = "";
  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }

  return parsed.toString();
}
const ALLOWED_NORMALIZED_URLS = new Set(
  [...ALLOWED_URLS]
    .map((url) => normalizeBrowserUrl(url))
    .filter((url) => Boolean(url) && url !== BROWSER_HOME_URL)
);
function renderProjects() {
  if (!projectList) return;
  const items = portfolioApps.map((app, index) => {
    const orderLabel = String(app.order || index + 1).padStart(2, "0");
    const linkedTitle = app.url
      ? `<button class="project-link" type="button" data-browser-url="${app.url}" data-browser-title="${app.browserTitle || app.title}">${app.title}</button>`
      : app.title;
    const openInNewTabUrl = app.openInNewTabUrl || app.url;
    const externalLink = openInNewTabUrl
      ? ` <a href="${openInNewTabUrl}" target="_blank" rel="noopener">${app.openInNewTabLabel || "Open in new tab"}</a>`
      : "";
    const sourceBadge = app.isGithubSource ? ' <span class="source-badge">GitHub</span>' : "";
    const githubLink = app.githubUrl && !app.isGithubSource
      ? ` <a href="${app.githubUrl}" target="_blank" rel="noopener" class="repo-link">repo</a>`
      : "";
    return `<li class="project-item">
      <h3>${orderLabel} — ${linkedTitle}${sourceBadge}${githubLink}</h3>
      <p>${app.description}${externalLink}</p>
    </li>`;
  });
  projectList.innerHTML = items.join("\n");
}
function buildBrowserHomeMarkup() {
  const items = portfolioApps.map((app, index) => {
    const orderLabel = String(app.order || index + 1).padStart(2, "0");
    const title = escapeHtml(app.title || `Product ${orderLabel}`);
    const description = escapeHtml(app.description || "Retro project preview");
    const safeUrl = app.url ? escapeHtml(app.url) : "";
    const safeGithubUrl = app.githubUrl ? escapeHtml(app.githubUrl) : "";
    const safeOpenInNewTabUrl = app.openInNewTabUrl ? escapeHtml(app.openInNewTabUrl) : "";
    const launchButton = app.url
      ? `<a class="product-link" href="${safeUrl}">Launch</a>`
      : `<span class="product-link disabled" aria-disabled="true">Offline</span>`;
    const openInNewTabLink = safeOpenInNewTabUrl
      ? `<a class="repo-link" href="${safeOpenInNewTabUrl}" target="_blank" rel="noopener">${escapeHtml(app.openInNewTabLabel || "Open in new tab")}</a>`
      : "";
    const repoLink = app.githubUrl
      ? `<a class="repo-link" href="${safeGithubUrl}">Source</a>`
      : "";
    return `<article class="product-card" style="--delay:${index * 90}ms">
      <div class="card-glow" aria-hidden="true"></div>
      <p class="product-index">${orderLabel}</p>
      <h2>${title}</h2>
      <p class="product-copy">${description}</p>
      <div class="product-actions">${launchButton}${openInNewTabLink}${repoLink}</div>
    </article>`;
  });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Retro Products Home</title>
    <style>
      :root {
        --bg-top: #28004d;
        --bg-bottom: #04040f;
        --crt-cyan: #3bf6ff;
        --crt-magenta: #ff58cc;
        --crt-lime: #b7ff33;
        --panel: rgba(10, 10, 25, 0.72);
        --line: rgba(255, 255, 255, 0.06);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "VT323", "Courier New", monospace;
        color: #e9eeff;
        background:
          radial-gradient(circle at 20% 15%, rgba(255, 88, 204, 0.22), transparent 45%),
          radial-gradient(circle at 80% 0%, rgba(59, 246, 255, 0.2), transparent 40%),
          linear-gradient(180deg, var(--bg-top), var(--bg-bottom));
        overflow-x: hidden;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: repeating-linear-gradient(
          180deg,
          transparent 0 2px,
          var(--line) 2px 3px
        );
        opacity: 0.55;
      }

      .page {
        position: relative;
        z-index: 1;
        padding: 1.1rem 1rem 2rem;
      }

      .hero {
        border: 2px solid var(--crt-cyan);
        background: var(--panel);
        box-shadow: 0 0 0 2px rgba(59, 246, 255, 0.25), 0 0 24px rgba(59, 246, 255, 0.35);
        padding: 0.8rem 1rem 0.65rem;
        margin-bottom: 0.9rem;
        animation: pulse-border 2.2s infinite ease-in-out;
      }

      .kicker {
        color: var(--crt-lime);
        letter-spacing: 0.08em;
        margin: 0;
        text-transform: uppercase;
      }

      .hero h1 {
        margin: 0.2rem 0 0.3rem;
        font-size: clamp(1.7rem, 4.5vw, 2.5rem);
        color: var(--crt-cyan);
        text-shadow: 0 0 7px rgba(59, 246, 255, 0.7);
      }

      .hero p {
        margin: 0;
      }

      .marquee {
        margin-top: 0.6rem;
        overflow: hidden;
        border-top: 1px solid rgba(255, 255, 255, 0.35);
        border-bottom: 1px solid rgba(255, 255, 255, 0.35);
        padding: 0.2rem 0;
        white-space: nowrap;
      }

      .marquee span {
        display: inline-block;
        padding-left: 100%;
        color: var(--crt-magenta);
        animation: marquee 15s linear infinite;
      }

      .products {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.8rem;
      }

      .product-card {
        position: relative;
        border: 2px solid #d6dbff;
        background: linear-gradient(180deg, rgba(28, 35, 72, 0.9), rgba(5, 8, 22, 0.92));
        box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.08), 0 5px 0 rgba(0, 0, 0, 0.4);
        padding: 0.75rem;
        overflow: hidden;
        transform: translateY(8px);
        opacity: 0;
        animation: card-in 500ms steps(10, end) forwards;
        animation-delay: var(--delay, 0ms);
      }

      .product-card:hover {
        transform: translateY(-2px) scale(1.015);
        transition: transform 130ms steps(4, end);
      }

      .card-glow {
        position: absolute;
        inset: -35% auto auto -20%;
        width: 65%;
        aspect-ratio: 1;
        background: radial-gradient(circle, rgba(59, 246, 255, 0.25), transparent 70%);
        pointer-events: none;
        animation: drift 3.4s infinite alternate ease-in-out;
      }

      .product-index {
        margin: 0;
        color: var(--crt-lime);
      }

      h2 {
        margin: 0.2rem 0;
        font-size: 1.45rem;
      }

      .product-copy {
        margin: 0 0 0.55rem;
      }

      .product-actions {
        display: flex;
        gap: 0.5rem;
      }

      .product-link,
      .repo-link {
        text-decoration: none;
        color: #0d1020;
        background: #9fffff;
        border: 2px solid #fff;
        padding: 0.18rem 0.55rem;
        box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
      }

      .repo-link {
        background: #ffd3f1;
      }

      .product-link:hover,
      .repo-link:hover {
        filter: brightness(1.08);
      }

      .product-link.disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      @keyframes marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-100%); }
      }

      @keyframes pulse-border {
        0%, 100% { box-shadow: 0 0 0 2px rgba(59, 246, 255, 0.25), 0 0 24px rgba(59, 246, 255, 0.35); }
        50% { box-shadow: 0 0 0 2px rgba(255, 88, 204, 0.35), 0 0 26px rgba(255, 88, 204, 0.4); }
      }

      @keyframes drift {
        from { transform: translate(0, 0); }
        to { transform: translate(20%, 12%); }
      }

      @keyframes card-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <p class="kicker">Portfolio // Retro Product Deck</p>
        <h1>Welcome to the Product Showcase</h1>
        <p>Animated previews, neon palette, and old-school web energy.</p>
        <div class="marquee"><span>Now Loading: Strategy • Analytics • Product Experiments • Interactive Demos •</span></div>
      </section>
      <section class="products" aria-label="Product grid">
        ${items.join("\n        ")}
      </section>
    </main>
  </body>
</html>`;
}
function isAllowedUrl(url) {
  const normalizedCandidate = normalizeBrowserUrl(url);
  if (!normalizedCandidate) return false;
  if (normalizedCandidate === "about:blank" || normalizedCandidate === BROWSER_HOME_URL) return true;
  if (ALLOWED_NORMALIZED_URLS.has(normalizedCandidate)) return true;

  let candidate;
  try {
    candidate = new URL(normalizedCandidate);
  } catch {
    return false;
  }

  for (const allowed of ALLOWED_NORMALIZED_URLS) {
    let allowedParsed;
    try {
      allowedParsed = new URL(allowed);
    } catch {
      continue;
    }

    if (candidate.origin !== allowedParsed.origin) continue;
    const allowedPathPrefix = allowedParsed.pathname.endsWith("/") ? allowedParsed.pathname : `${allowedParsed.pathname}/`;
    if (candidate.pathname === allowedParsed.pathname || candidate.pathname.startsWith(allowedPathPrefix)) return true;
  }

  return false;
}
function openInRetroBrowser(url, title) {
  const normalizedUrl = normalizeBrowserUrl(url);
  if (!normalizedUrl || !isAllowedUrl(normalizedUrl)) return; // silently ignore; called only from project links
  if (normalizedUrl === BROWSER_HOME_URL) {
    loadBrowserHomePage();
    openWindow("browser-window");
    return;
  }
  if (browserFrame) browserFrame.removeAttribute("srcdoc");
  if (browserFrame) browserFrame.src = normalizedUrl;
  if (browserAddress) browserAddress.value = normalizedUrl;
  if (browserStatus) browserStatus.textContent = `Loading ${normalizedUrl}...`;
  if (browserTitle) browserTitle.textContent = `Netscape Navigator — ${title}`;
  if (browserThrobber) browserThrobber.classList.add("loading");
  openWindow("browser-window");
}
function loadBrowserHomePage() {
  const homeMarkup = buildBrowserHomeMarkup();
  if (browserFrame) browserFrame.srcdoc = homeMarkup;
  if (browserAddress) browserAddress.value = BROWSER_HOME_URL;
  if (browserStatus) browserStatus.textContent = "Document: Done";
  if (browserTitle) browserTitle.textContent = "Netscape Navigator — Projects Home";
  if (browserThrobber) browserThrobber.classList.remove("loading");
}
function navigateBrowserTo(url) {
  const normalizedUrl = normalizeBrowserUrl(url);
  if (!normalizedUrl) return;

  if (normalizedUrl === BROWSER_HOME_URL) {
    loadBrowserHomePage();
    return;
  }

  if (browserFrame) browserFrame.removeAttribute("srcdoc");
  if (browserAddress) browserAddress.value = normalizedUrl;
  if (browserFrame) browserFrame.src = normalizedUrl;
  if (browserStatus) browserStatus.textContent = `Loading ${normalizedUrl}...`;
  if (browserTitle) browserTitle.textContent = "Netscape Navigator";
  if (browserThrobber) browserThrobber.classList.add("loading");
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
  if (winampStatus && WINAMP_PLAYLIST[winampActiveIndex]) {
    winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[winampActiveIndex].title}`;
  }
}

function updateWinampUi() {
  if (winampToggle) winampToggle.textContent = winampPlaying ? "⏸ Pause" : "▶ Play";
  if (winampMuteToggle) {
    winampMuteToggle.textContent = winampMuted ? "🔇 Muted" : "🔊 Sound On";
  }
  if (winampChannelList) {
    [...winampChannelList.querySelectorAll(".winamp-channel-btn")].forEach((button) => {
      const channelIndex = Number(button.dataset.winampIndex);
      button.setAttribute("aria-selected", channelIndex === winampActiveIndex ? "true" : "false");
      button.classList.toggle("active", channelIndex === winampActiveIndex);
    });
  }
}
function syncWinampAudioState() {
  if (!winampPlayer) return;
  const currentVolume = Number(winampPlayer.getVolume?.());
  if (Number.isFinite(currentVolume)) {
    if (winampVolume) winampVolume.value = String(currentVolume);
    if (currentVolume > 0) winampLastVolume = currentVolume;
  }
  const playerMuted = winampPlayer.isMuted?.() ?? winampMuted;
  winampMuted = Boolean(playerMuted) || (Number.isFinite(currentVolume) && currentVolume === 0);
}
function restartWinampFlutter() {
  if (winampFlutterTimer) {
    window.clearInterval(winampFlutterTimer);
    winampFlutterTimer = null;
  }
  if (!winampPlayer || winampMuted || !winampPlaying || winampLastVolume <= 0) return;
  const flutterRange = Math.max(1, Number(activeThemeProfile?.flutterRange) || 4);
  const flutterInterval = Math.max(250, Number(activeThemeProfile?.flutterInterval) || 900);
  winampFlutterTimer = window.setInterval(() => {
    if (!winampPlayer || winampMuted || !winampPlaying) return;
    const flutterAmount = Math.round((Math.random() - 0.5) * flutterRange);
    const adjustedVolume = clamp(winampLastVolume + flutterAmount, 1, 100);
    winampPlayer.setVolume(adjustedVolume);
  }, flutterInterval);
}
function selectWinampChannel(index, { autoPlay = true } = {}) {
  if (!winampPlayer || !WINAMP_PLAYLIST[index]) return;
  winampActiveIndex = index;
  winampPlayer.loadVideoById(WINAMP_PLAYLIST[index].id);
  if (autoPlay) winampPlayer.playVideo();
  if (winampStatus) winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[index].title}`;
  updateWinampUi();
}
function getWinampGroupLabel(trackTitle = "") {
  const artistName = trackTitle.split(" - ")[0]?.trim();
  if (!artistName) return "Misc";
  const firstChar = artistName.charAt(0).toUpperCase();
  return /[A-Z]/.test(firstChar) ? firstChar : "#";
}
function setupWinampPlaylistUi() {
  if (!winampChannelList) return;
  const filterValue = winampChannelFilter?.value.trim().toLowerCase() || "";
  const filteredPlaylist = WINAMP_PLAYLIST
    .map((track, index) => ({ ...track, index }))
    .filter(({ title }) => !filterValue || title.toLowerCase().includes(filterValue));

  if (!filteredPlaylist.length) {
    winampChannelList.innerHTML = '<p class="winamp-channel-empty">No channels match your filter.</p>';
  } else {
    let previousGroup = "";
    winampChannelList.innerHTML = filteredPlaylist.map(({ title, index }) => {
      const groupLabel = getWinampGroupLabel(title);
      const groupHeader = groupLabel !== previousGroup ? `<p class="winamp-channel-group">${groupLabel}</p>` : "";
      previousGroup = groupLabel;
      return `${groupHeader}<button type="button" class="retro-btn winamp-channel-btn" data-winamp-index="${index}" role="option">CH ${String(index + 1).padStart(2, "0")} · ${title}</button>`;
    }).join("\n");
  }

  if (!winampPlaylistBound) {
    winampChannelList.addEventListener("click", (event) => {
      const channelButton = event.target.closest(".winamp-channel-btn");
      if (!channelButton) return;
      selectWinampChannel(Number(channelButton.dataset.winampIndex));
    });
    if (winampChannelFilter) {
      winampChannelFilter.addEventListener("input", setupWinampPlaylistUi);
    }
    winampPlaylistBound = true;
  }
  updateWinampUi();
}
function initWinampPlayer() {
  if (winampPlayer || !window.YT || !window.YT.Player || !document.getElementById("winamp-youtube-player")) return;
  winampPlayer = new window.YT.Player("winamp-youtube-player", {
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
        if (winampVolume) winampVolume.value = "0";
        winampMuted = true;
        if (winampStatus) winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[0].title}`;
        updateWinampUi();
        restartWinampFlutter();
        event.target.playVideo();
      },
      onStateChange: (event) => {
        winampPlaying = event.data === window.YT.PlayerState.PLAYING;
        syncWinampAudioState();
        restartWinampFlutter();
        if (winampPlaying && !winampMuted) {
          vintageSpeaker.setVolume(winampLastVolume);
        } else {
          vintageSpeaker.mute();
        }
        if (event.data === window.YT.PlayerState.ENDED) {
          const next = (winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
          selectWinampChannel(next);
          return;
        }
        updateWinampUi();
      },
      onError: () => {
        if (winampStatus) {
          winampStatus.textContent = "This channel is unavailable in embed mode. Skipping to next.";
        }
        const next = (winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
        setTimeout(() => selectWinampChannel(next), 800);
      }
    }
  });
}
function bindWinampControls() {
  setupWinampPlaylistUi();
  hydrateWinampPlaylistTitles();
  if (winampPrev) {
    winampPrev.addEventListener("click", () => {
      const previous = (winampActiveIndex - 1 + WINAMP_PLAYLIST.length) % WINAMP_PLAYLIST.length;
      selectWinampChannel(previous);
    });
  }
  if (winampNext) {
    winampNext.addEventListener("click", () => {
      const next = (winampActiveIndex + 1) % WINAMP_PLAYLIST.length;
      selectWinampChannel(next);
    });
  }
  if (winampToggle) {
    winampToggle.addEventListener("click", () => {
      if (!winampPlayer) return;
      if (winampPlaying) {
        winampPlayer.pauseVideo();
      } else {
        winampPlayer.playVideo();
      }
    });
  }
  if (winampMuteToggle) {
    winampMuteToggle.addEventListener("click", () => {
      if (!winampPlayer) return;
      syncWinampAudioState();
      if (winampMuted) {
        const restoreVolume = Math.max(1, winampLastVolume);
        winampPlayer.setVolume(restoreVolume);
        if (winampVolume) winampVolume.value = String(restoreVolume);
        winampPlayer.unMute();
        winampMuted = false;
        vintageSpeaker.setVolume(restoreVolume);
        restartWinampFlutter();
      } else {
        winampPlayer.mute();
        winampMuted = true;
        vintageSpeaker.mute();
        restartWinampFlutter();
      }
      updateWinampUi();
    });
  }
  if (winampVolume) {
    winampVolume.addEventListener("input", () => {
      if (!winampPlayer) return;
      const volume = Number(winampVolume.value);
      winampPlayer.setVolume(volume);
      vintageSpeaker.setVolume(volume);
      if (volume > 0) {
        winampLastVolume = volume;
        winampPlayer.unMute();
        winampMuted = false;
      } else {
        winampPlayer.mute();
        winampMuted = true;
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

function bindIconFallbackHandlers() {
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
function closeFocusedWindow() {
  if (activeWindowId) closeWindow(activeWindowId);
}
function closeAllWindows() {
  windows.forEach((win) => { if (win.classList.contains("open")) closeWindow(win.id); });
  activeWindowId = null;
  windows.forEach((w) => w.classList.remove("focused"));
  saveDesktopState();
}
function openAllWindows() {
  if (mobileLayoutQuery.matches) {
    openWindow("about-window");
    return;
  }
  windows.forEach((win) => openWindow(win.id));
}
function cascadeWindows() {
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
function getMenuItems(menu) {
  return [...menu.querySelectorAll('[role="menuitem"]')];
}
function focusWindow(win) {
  if (!win?.classList.contains("open")) return;
  const focusTarget =
    win.querySelector(".title-bar .close-btn") ||
    win.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  focusTarget?.focus();
}
function focusTopMenuButton(index) {
  const normalized = (index + menuButtons.length) % menuButtons.length;
  menuButtons[normalized]?.focus();
}
function openMenu(button, { focusFirstItem = false } = {}) {
  if (!button) return;
  const targetMenu = document.getElementById(button.dataset.menu);
  if (!targetMenu) return;
  menuDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
  menuButtons.forEach((menuButton) => menuButton.setAttribute("aria-expanded", "false"));
  targetMenu.classList.add("open");
  button.setAttribute("aria-expanded", "true");
  activeMenuButton = button;
  if (focusFirstItem) getMenuItems(targetMenu)[0]?.focus();
}
function closeMenus({ returnFocus = false } = {}) {
  menuDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
  menuButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
  if (returnFocus && activeMenuButton) {
    activeMenuButton.focus();
  }
  activeMenuButton = null;
}
function moveMenuItemFocus(currentButton, direction) {
  const menu = currentButton.closest(".menu-dropdown");
  if (!menu) return;
  const items = getMenuItems(menu);
  const currentIndex = items.indexOf(currentButton);
  if (currentIndex < 0) return;
  const nextIndex = (currentIndex + direction + items.length) % items.length;
  items[nextIndex]?.focus();
}
function switchMenuFromDropdown(currentButton, direction) {
  const currentMenu = currentButton.closest(".menu-dropdown");
  if (!currentMenu) return;
  const currentTopButton = menuButtons.find((button) => button.dataset.menu === currentMenu.id);
  const topIndex = menuButtons.indexOf(currentTopButton);
  if (topIndex < 0) return;
  const nextTopIndex = (topIndex + direction + menuButtons.length) % menuButtons.length;
  const nextTopButton = menuButtons[nextTopIndex];
  openMenu(nextTopButton, { focusFirstItem: true });
}
openers.forEach((icon) => {
  icon.addEventListener("click", () => {
    openWindow(icon.dataset.open);
  });
  icon.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      openWindow(icon.dataset.open);
    }
  });
});
closers.forEach((btn) => {
  btn.addEventListener("click", () => closeWindow(btn.dataset.close));
});
if (mobileCloseBtn) {
  mobileCloseBtn.addEventListener("click", () => {
    if (activeWindowId) closeWindow(activeWindowId);
  });
}
function bindDynamicContentEvents() {
  if (timelineWindowContent && !timelineWindowContent.dataset.bound) {
    timelineWindowContent.addEventListener("click", (event) => {
      const clickedNode = event.target.closest("[data-timeline-node]");
      if (!clickedNode || !timelineWindowContent.contains(clickedNode)) return;
      setActiveTimelineNode(clickedNode.dataset.timelineNode);
    });
    timelineWindowContent.dataset.bound = "true";
  }
  if (projectList) {
    projectList.addEventListener("click", (event) => {
      const projectLink = event.target.closest(".project-link[data-browser-url]");
      if (!projectLink) return;
      openInRetroBrowser(projectLink.dataset.browserUrl, projectLink.dataset.browserTitle || "Project");
    });
  }
  if (browserHome) {
    browserHome.addEventListener("click", () => loadBrowserHomePage());
  }
  if (browserBack) {
    browserBack.addEventListener("click", () => {
      try {
        const frameWindow = browserFrame?.contentWindow;
        frameWindow?.history.back();
      } catch {
        if (browserStatus) browserStatus.textContent = "Back unavailable for cross-origin embedded pages.";
      }
    });
  }
  if (browserForward) {
    browserForward.addEventListener("click", () => {
      try {
        const frameWindow = browserFrame?.contentWindow;
        frameWindow?.history.forward();
      } catch {
        if (browserStatus) browserStatus.textContent = "Forward unavailable for cross-origin embedded pages.";
      }
    });
  }
  if (browserReload) {
    browserReload.addEventListener("click", () => {
      if (browserFrame) {
        browserFrame.src = browserFrame.src;
        if (browserThrobber) browserThrobber.classList.add("loading");
        if (browserStatus) browserStatus.textContent = "Reloading...";
      }
    });
  }
  if (browserStop) {
    browserStop.addEventListener("click", () => {
      if (browserThrobber) browserThrobber.classList.remove("loading");
      if (browserStatus) browserStatus.textContent = "Transfer interrupted.";
    });
  }

  if (browserGo) {
    browserGo.addEventListener("click", () => {
      if (!browserAddress) return;
      navigateBrowserTo(browserAddress.value);
    });
  }

  if (browserAddress) {
    browserAddress.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      navigateBrowserTo(browserAddress.value);
    });
  }

  if (browserFrame) {
    browserFrame.addEventListener("load", () => {
      if (browserStatus) browserStatus.textContent = "Document: Done";
      if (browserThrobber) browserThrobber.classList.remove("loading");
    });
  }
}
function setActiveTimelineNode(nodeId) {
  if (!timelineWindowContent || !nodeId) return;
  const timelineNodes = [...timelineWindowContent.querySelectorAll("[data-timeline-node]")];
  const timelineCards = [...timelineWindowContent.querySelectorAll("[data-timeline-card]")];
  timelineNodes.forEach((node) => {
    const isActive = node.dataset.timelineNode === nodeId;
    node.classList.toggle("active", isActive);
    node.setAttribute("aria-selected", String(isActive));
  });
  timelineCards.forEach((card) => {
    const isActive = card.dataset.timelineCard === nodeId;
    card.classList.toggle("active", isActive);
    card.hidden = !isActive;
  });
}
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
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    saveDesktopState();
  });
  handle.addEventListener("pointercancel", (event) => {
    dragging = false;
    win.classList.remove("dragging");
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    saveDesktopState();
  });
  handle.addEventListener("pointermove", onMove);
  win.addEventListener("mousedown", () => {
    if (mobileLayoutQuery.matches) return;
    bringToFront(win);
  });
});
desktop.addEventListener("dblclick", (event) => {
  if (event.target === desktop) {
    closeAllWindows();
  }
});
menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetMenu = document.getElementById(button.dataset.menu);
    const alreadyOpen = targetMenu?.classList.contains("open");
    if (alreadyOpen) {
      closeMenus({ returnFocus: true });
      return;
    }
    openMenu(button, { focusFirstItem: false });
  });
  button.addEventListener("keydown", (event) => {
    const index = menuButtons.indexOf(button);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      closeMenus();
      focusTopMenuButton(index + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      closeMenus();
      focusTopMenuButton(index - 1);
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu(button, { focusFirstItem: true });
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenus({ returnFocus: true });
    }
  });
});
function runMenuAction(action) {
  RetroSounds.click();
  if (action === "open-about") openWindow("about-window");
  if (action === "open-projects") openWindow("projects-window");
  if (action === "open-browser") openWindow("browser-window");
  if (action === "open-resume") openWindow("resume-window");
  if (action === "open-timeline") openWindow("timeline-window");
  if (action === "open-contact") openWindow("contact-window");
  if (action === "open-dashboard") openWindow("dashboard-window");
  if (action === "open-winamp") openWindow("winamp-window");
  if (action === "open-terminal") openWindow("terminal-window");
  if (action === "close-focused") closeFocusedWindow();
  if (action === "close-all") closeAllWindows();
  if (action === "open-all") openAllWindows();
  if (action === "cascade") cascadeWindows();
  if (THEME_ACTION_MAP[action]) applyTheme(THEME_ACTION_MAP[action]);
  if (action === "toggle-sounds") RetroSounds.toggle();
  if (action === "new-sticky") createStickyNote();
  closeMenus();
}
menuActions.forEach((actionButton) => {
  actionButton.addEventListener("click", () => {
    runMenuAction(actionButton.dataset.action);
  });
  actionButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveMenuItemFocus(actionButton, 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveMenuItemFocus(actionButton, -1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      const menu = actionButton.closest(".menu-dropdown");
      getMenuItems(menu)[0]?.focus();
    }
    if (event.key === "End") {
      event.preventDefault();
      const menu = actionButton.closest(".menu-dropdown");
      const items = getMenuItems(menu);
      items[items.length - 1]?.focus();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      switchMenuFromDropdown(actionButton, 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      switchMenuFromDropdown(actionButton, -1);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      runMenuAction(actionButton.dataset.action);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenus({ returnFocus: true });
    }
    if (event.key === "Tab") {
      closeMenus();
    }
  });
});
desktop?.addEventListener("click", (event) => {
  const actionTrigger = event.target.closest("[data-action]");
  if (!actionTrigger || menuActions.includes(actionTrigger)) return;
  runMenuAction(actionTrigger.dataset.action);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-group")) closeMenus();
});
document.addEventListener("keydown", (event) => {
  // BSOD: Ctrl+Alt+B — skip when typing in inputs
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "b") {
    const tag = document.activeElement?.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") triggerBsod();
  }
  if (event.key.toLowerCase() === "x") {
    const tag = document.activeElement?.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") closeFocusedWindow();
  }
  if (event.key === "Escape") {
    if (activeMenuButton) {
      closeMenus({ returnFocus: true });
      return;
    }
    closeMenus();
  }
});

mobileLayoutQuery.addEventListener("change", () => {
  if (!mobileLayoutQuery.matches) {
    updateMobileNav(null);
    return;
  }
  const firstOpen = windows.find((win) => win.classList.contains("open"));
  windows.forEach((win) => {
    if (firstOpen && win.id !== firstOpen.id) win.classList.remove("open");
  });
  if (!firstOpen) openWindow("about-window");
  else updateMobileNav(firstOpen);
});

setInterval(updateClock, 1000 * 15);
updateClock();
window.addGithubRepos = function (repos) {
  const existingIds = new Set(portfolioApps.map((a) => a.id));
  const newRepos = repos.filter((r) => !existingIds.has(r.id));
  if (newRepos.length === 0) return;
  portfolioApps = [...portfolioApps, ...newRepos].sort((a, b) => (a.order || 0) - (b.order || 0));
  newRepos.forEach((r) => {
    if (!r.url) return;
    ALLOWED_URLS.add(r.url);
    const normalizedUrl = normalizeBrowserUrl(r.url);
    if (normalizedUrl && normalizedUrl !== BROWSER_HOME_URL) ALLOWED_NORMALIZED_URLS.add(normalizedUrl);
  });
  renderProjects();
};
// ── Boot sequence ──────────────────────────────────────────────
function runBootSequence() {
  const overlay = document.getElementById("boot-overlay");
  if (!overlay) return;
  const linesEl = document.getElementById("boot-lines");
  const barContainer = document.getElementById("boot-bar-container");
  const barFill = document.getElementById("boot-bar-fill");
  let done = false;

  function playChime() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [[261.63, 0], [392.00, 0.11], [523.25, 0.22]].forEach(([freq, start]) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        const t = ac.currentTime + start;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.055, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(g);
        g.connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (_) {}
  }

  function finish() {
    if (done) return;
    done = true;
    playChime();
    overlay.classList.add("fade-out");
    overlay.addEventListener("transitionend", () => overlay.classList.add("hidden"), { once: true });
  }

  overlay.addEventListener("click", finish, { once: true });
  document.addEventListener("keydown", finish, { once: true });

  const lines = [
    { text: "PORTFOLIO BIOS v1.0 (1993)", highlight: true, delay: 0 },
    { text: "Copyright (C) Sanjin Systems Inc.", delay: 120 },
    { text: "", delay: 220 },
    { text: "CPU: Sanjin-1000 @ 500 MHz ............ OK", delay: 380 },
    { text: "Memory test: 640 KB ................... OK", delay: 560 },
    { text: "Extended memory: 524288 KB ............ OK", delay: 720 },
    { text: "Detecting drives ...................... 1 found", delay: 900 },
    { text: "Initializing display adapter .......... OK", delay: 1060 },
    { text: "Loading experience module ............. OK", delay: 1200 },
    { text: "", delay: 1340 },
    { text: "System check complete. No errors detected.", delay: 1420 },
  ];

  lines.forEach(({ text, highlight, delay }) => {
    setTimeout(() => {
      if (done) return;
      const p = document.createElement("p");
      p.className = "boot-line" + (highlight ? " highlight" : "");
      p.textContent = text;
      linesEl.appendChild(p);
    }, delay);
  });

  setTimeout(() => {
    if (done) return;
    barContainer.style.display = "";
    requestAnimationFrame(() => requestAnimationFrame(() => { barFill.style.width = "100%"; }));
  }, 1600);

  setTimeout(finish, 2900);
}

// ── Typewriter effect ──────────────────────────────────────────
let typewriterDone = false;
function startTypewriter() {
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
      // Remove cursor after a pause
      setTimeout(() => cursor.remove(), 1800);
      return;
    }
    target.insertBefore(document.createTextNode(fullText[i]), cursor);
    i++;
    setTimeout(type, 28 + Math.random() * 22);
  }
  // Small delay so window animation finishes first
  setTimeout(type, 200);
}

// ── Vintage speaker simulation ─────────────────────────────────
// YouTube audio lives in a cross-origin iframe so we can't route
// it through Web Audio. Instead we generate authentic period-correct
// artefacts (tape hiss, AC hum, capacitor crackle) that play on top —
// exactly how cheap 90s PC speakers behaved independent of the signal.
const vintageSpeaker = (() => {
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
      addHum(50,  0.010);
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
    } catch (_) { /* AudioContext blocked — degrade gracefully */ }
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
const RetroSounds = (() => {
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
    open:  () => play([{ freq: 523, start: 0, dur: 0.07 }, { freq: 659, start: 0.06, dur: 0.1 }]),
    close: () => play([{ freq: 330, start: 0, dur: 0.08 }, { freq: 220, start: 0.06, dur: 0.1 }]),
    click: () => play([{ freq: 440, start: 0, dur: 0.06, vol: 0.035 * clickGain }]),
    error: () => play([{ freq: 180, start: 0, dur: 0.18, type: "sawtooth" }, { freq: 140, start: 0.15, dur: 0.22, type: "sawtooth" }]),
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
    }
  };
})();

// ── Terminal window ────────────────────────────────────────────
const TERMINAL_HELP = `Available commands:
  help          Show this help
  whoami        About Sanjin
  ls            List filesystem
  ls projects   List portfolio projects
  cat about.txt About section
  cat skills.txt Skills list
  cat readme.md Welcome message
  open <id>     Open a window
  close <id>    Close a window
  date          Current date/time
  uname -a      System info
  clear         Clear terminal
  exit          Close terminal`;

const TERMINAL_WINDOWS = {
  about:    "about-window",
  projects: "projects-window",
  browser:  "browser-window",
  resume:   "resume-window",
  timeline: "timeline-window",
  contact:  "contact-window",
  winamp:   "winamp-window",
  terminal: "terminal-window",
  error:    "easter-error",
};

let terminalOutput = null;
let terminalInput = null;
let terminalHistory = [];
let terminalHistoryIdx = -1;

function terminalPrint(text, cls = "t-out") {
  if (!terminalOutput) return;
  const line = document.createElement("span");
  line.className = `t-line ${cls}`;
  line.textContent = text;
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function terminalRunCommand(raw) {
  const input = raw.trim();
  if (!input) return;
  terminalPrint(`C:\\PORTFOLIO> ${input}`, "t-cmd");
  terminalHistory.unshift(input);
  if (terminalHistory.length > 50) terminalHistory.pop();
  terminalHistoryIdx = -1;

  const [cmd, ...args] = input.toLowerCase().split(/\s+/);

  if (cmd === "clear") {
    if (terminalOutput) terminalOutput.innerHTML = "";
    return;
  }
  if (cmd === "exit") {
    closeWindow("terminal-window");
    return;
  }
  if (cmd === "help") {
    terminalPrint(TERMINAL_HELP);
    return;
  }
  if (cmd === "whoami") {
    terminalPrint("Sanjin Pepic");
    terminalPrint("Strategy & Product Leader — Industrial + Sustainability");
    terminalPrint("Stockholm, Sweden · sanjin@pepic.me");
    return;
  }
  if (cmd === "date") {
    terminalPrint(new Date().toString());
    return;
  }
  if (cmd === "uname" && args[0] === "-a") {
    terminalPrint("PortfolioOS 1.0 (Retro Edition) #1 SMP 1993-01-01 i486");
    terminalPrint("CPU: Sanjin-1000 @ 500 MHz   RAM: 640 KB   VRAM: 256 KB");
    return;
  }
  if (cmd === "ls") {
    if (args[0] === "projects") {
      terminalPrint("Projects/");
      portfolioApps.forEach((app, i) => {
        const num = String(app.order || i + 1).padStart(2, "0");
        terminalPrint(`  ${num}  ${app.title}`);
      });
      return;
    }
    terminalPrint("Volume: PORTFOLIO");
    terminalPrint(" Directory of C:\\PORTFOLIO");
    terminalPrint("");
    terminalPrint("  about.txt      resume.txt     skills.txt");
    terminalPrint("  readme.md      projects/      apps/");
    terminalPrint("");
    terminalPrint(`${portfolioApps.length} project(s) — ${windows.length} window(s) available`);
    return;
  }
  if (cmd === "dir") {
    terminalPrint("Use 'ls' or 'ls projects'");
    return;
  }
  if (cmd === "cat") {
    const file = args[0] || "";
    if (file === "about.txt") {
      terminalPrint("Strategy and product leader delivering measurable");
      terminalPrint("commercial growth and operational transformation in");
      terminalPrint("industrial and sustainability-driven businesses.");
      terminalPrint("I align business strategy, product execution, and");
      terminalPrint("analytics adoption to move teams from insights to");
      terminalPrint("shipped outcomes.");
      return;
    }
    if (file === "skills.txt") {
      terminalPrint("Data & Analytics: dbt, SQL, Python, BigQuery, Tableau");
      terminalPrint("Product: Strategy, Roadmapping, A/B Testing, Analytics");
      terminalPrint("Domains: Metallurgy (Erasteel), Energy (Tibber),");
      terminalPrint("         Fintech (Anyfin), Education (SSE)");
      terminalPrint("Tools:   BI platforms, dbt Cloud, GCP, GitHub");
      return;
    }
    if (file === "readme.md") {
      terminalPrint("# Welcome to Sanjin's Portfolio OS");
      terminalPrint("");
      terminalPrint("This is a retro OS-themed portfolio built in");
      terminalPrint("vanilla HTML, CSS, and JavaScript. No frameworks.");
      terminalPrint("Just raw craft and a fondness for the 90s.");
      terminalPrint("");
      terminalPrint("Try: open projects, open resume, ls projects");
      terminalPrint("     sudo hire sanjin");
      return;
    }
    terminalPrint(`cat: ${file}: No such file or directory`, "t-err");
    return;
  }
  if (cmd === "open") {
    const key = args[0] || "";
    const winId = TERMINAL_WINDOWS[key] || (windows.find(w => w.id === key) ? key : null);
    if (winId) {
      openWindow(winId);
      terminalPrint(`Opening ${key}...`);
    } else {
      terminalPrint(`open: unknown window '${key}'. Try: ${Object.keys(TERMINAL_WINDOWS).join(", ")}`, "t-err");
    }
    return;
  }
  if (cmd === "close") {
    const key = args[0] || "";
    const winId = TERMINAL_WINDOWS[key] || (windows.find(w => w.id === key) ? key : null);
    if (winId) {
      closeWindow(winId);
      terminalPrint(`Closed ${key}.`);
    } else {
      terminalPrint(`close: unknown window '${key}'`, "t-err");
    }
    return;
  }
  if (cmd === "sudo") {
    if (args[0] === "hire" && args[1] === "sanjin") {
      terminalPrint("Granting elevated hiring privileges...");
      terminalPrint("Access granted. Excellent taste confirmed.");
      terminalPrint("Please reach out: sanjin@pepic.me");
      return;
    }
    if (args.join(" ") === "rm -rf /") {
      terminalPrint("Permission denied. Nice try.", "t-err");
      return;
    }
    terminalPrint(`sudo: command not found: ${args.join(" ")}`, "t-err");
    return;
  }

  terminalPrint(`'${cmd}' is not recognized. Type 'help' for commands.`, "t-err");
}

function bindTerminal() {
  terminalOutput = document.getElementById("terminal-output");
  terminalInput  = document.getElementById("terminal-input");
  if (!terminalInput) return;

  // Welcome message
  terminalPrint("Portfolio Terminal v1.0 — Type 'help' to get started.", "t-dim");
  terminalPrint("", "t-dim");

  terminalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = terminalInput.value;
      terminalInput.value = "";
      terminalRunCommand(val);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      terminalHistoryIdx = Math.min(terminalHistoryIdx + 1, terminalHistory.length - 1);
      terminalInput.value = terminalHistory[terminalHistoryIdx] || "";
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      terminalHistoryIdx = Math.max(terminalHistoryIdx - 1, -1);
      terminalInput.value = terminalHistoryIdx >= 0 ? terminalHistory[terminalHistoryIdx] : "";
    }
  });

  // Click anywhere in terminal to focus input
  const termContent = document.querySelector(".terminal-content");
  if (termContent) {
    termContent.addEventListener("click", () => terminalInput.focus());
  }
}

// ── Right-click context menu ───────────────────────────────────
function bindContextMenu() {
  const menu = document.getElementById("context-menu");
  if (!menu) return;

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".window") || event.target.closest(".menu-bar")) return;
    event.preventDefault();
    const x = Math.min(event.clientX, window.innerWidth  - menu.offsetWidth  - 8);
    const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${x}px`;
    menu.style.top  = `${y}px`;
    menu.removeAttribute("aria-hidden");
    menu.classList.add("open");
    const first = menu.querySelector("button");
    if (first) first.focus();
  });

  menu.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-ctx-action]");
    if (!btn) return;
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    runMenuAction(btn.dataset.ctxAction);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#context-menu")) {
      menu.classList.remove("open");
      menu.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.classList.remove("open");
      menu.setAttribute("aria-hidden", "true");
    }
  });
}

// ── Sticky notes ───────────────────────────────────────────────
const STICKIES_KEY = "portfolio.stickies.v1";
const STICKY_COLORS = ["#ffffa5", "#c5e8ff", "#ffd6e7"];
let stickyColorIndex = 0;

function saveStickyNotes() {
  const notes = [...document.querySelectorAll(".sticky-note")].map((n) => ({
    id: n.dataset.stickyId,
    x: parseInt(n.style.left) || 100,
    y: parseInt(n.style.top)  || 100,
    w: n.offsetWidth,
    h: n.offsetHeight,
    text: n.querySelector("textarea").value,
    color: n.dataset.stickyColor || STICKY_COLORS[0],
  }));
  try { localStorage.setItem(STICKIES_KEY, JSON.stringify(notes)); } catch (_) {}
}

function createStickyNote({ id, x, y, w, h, text, color } = {}) {
  const noteId = id || `sticky-${Date.now()}`;
  const noteColor = color || STICKY_COLORS[stickyColorIndex % STICKY_COLORS.length];
  stickyColorIndex++;

  const el = document.createElement("div");
  el.className = "sticky-note";
  el.dataset.stickyId = noteId;
  el.dataset.stickyColor = noteColor;
  el.style.left  = `${x || Math.round(window.innerWidth  / 2 - 90)}px`;
  el.style.top   = `${y || Math.round(window.innerHeight / 2 - 70)}px`;
  el.style.width  = `${w || 180}px`;
  el.style.height = `${h || 140}px`;
  el.style.background = noteColor;
  el.style.zIndex = String(++topZ);

  // Darken header colour slightly
  el.innerHTML = `
    <div class="sticky-note-header" style="background:${noteColor}; filter:brightness(0.85)">
      <span>📌 Note</span>
      <button class="sticky-note-close" aria-label="Delete sticky note">×</button>
    </div>
    <textarea class="sticky-note-body" placeholder="Type here…">${escapeHtml(text || "")}</textarea>
  `;

  // Drag on header
  const header = el.querySelector(".sticky-note-header");
  let dragging = false, offX = 0, offY = 0;

  header.addEventListener("pointerdown", (e) => {
    if (mobileLayoutQuery.matches) return;
    if (e.target.closest(".sticky-note-close")) return;
    dragging = true;
    el.style.zIndex = String(++topZ);
    const rect = el.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    header.setPointerCapture(e.pointerId);
  });
  header.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const desktopRect = desktop.getBoundingClientRect();
    const nx = e.clientX - offX - desktopRect.left;
    const ny = e.clientY - offY - desktopRect.top;
    el.style.left = `${Math.max(0, nx)}px`;
    el.style.top  = `${Math.max(0, ny)}px`;
  });
  header.addEventListener("pointerup", (e) => {
    dragging = false;
    if (header.hasPointerCapture(e.pointerId)) header.releasePointerCapture(e.pointerId);
    saveStickyNotes();
  });
  header.addEventListener("pointercancel", (e) => {
    dragging = false;
    if (header.hasPointerCapture(e.pointerId)) header.releasePointerCapture(e.pointerId);
  });

  // Delete
  el.querySelector(".sticky-note-close").addEventListener("click", () => {
    el.remove();
    saveStickyNotes();
  });

  // Save on text change
  const ta = el.querySelector("textarea");
  ta.addEventListener("input", saveStickyNotes);

  // Save on resize
  new ResizeObserver(saveStickyNotes).observe(el);

  desktop.appendChild(el);
}

function loadStickyNotes() {
  try {
    const data = JSON.parse(localStorage.getItem(STICKIES_KEY) || "[]");
    if (Array.isArray(data)) data.forEach((n) => createStickyNote(n));
  } catch (_) {}
}

// ── Screen saver ───────────────────────────────────────────────
let screensaverTimer = null;
const SCREENSAVER_DELAY = 90 * 1000; // 90 seconds

function showScreensaver() {
  const ss = document.getElementById("screensaver");
  if (!ss) return;
  ss.removeAttribute("aria-hidden");
  ss.classList.add("active");
}

function hideScreensaver() {
  const ss = document.getElementById("screensaver");
  if (!ss || !ss.classList.contains("active")) return;
  ss.classList.remove("active");
  ss.setAttribute("aria-hidden", "true");
}

function resetScreensaverTimer() {
  clearTimeout(screensaverTimer);
  if (document.getElementById("screensaver")?.classList.contains("active")) {
    hideScreensaver();
    return;
  }
  screensaverTimer = setTimeout(showScreensaver, SCREENSAVER_DELAY);
}

function bindScreensaver() {
  const events = ["mousemove", "keydown", "pointerdown", "scroll"];
  events.forEach((ev) => document.addEventListener(ev, resetScreensaverTimer, { passive: true }));
  resetScreensaverTimer();
}

// ── BSOD Easter egg ────────────────────────────────────────────
let bsodActive = false;

function triggerBsod() {
  if (bsodActive) return;
  const overlay = document.getElementById("bsod-overlay");
  if (!overlay) return;
  bsodActive = true;
  RetroSounds.error();
  overlay.removeAttribute("aria-hidden");
  overlay.classList.add("visible");

  function dismiss() {
    overlay.classList.add("fade-out");
    overlay.addEventListener("transitionend", () => {
      overlay.classList.remove("visible", "fade-out");
      overlay.setAttribute("aria-hidden", "true");
      bsodActive = false;
    }, { once: true });
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (bsodActive) dismiss();
  }

  document.addEventListener("keydown", onKey);
  setTimeout(dismiss, 6000);
}

async function initDesktop() {
  runBootSequence();
  restoreThemePreference();
  syncDynamicElements();
  bindIconFallbackHandlers();
  bindDynamicContentEvents();
  bindWinampControls();
  bindTerminal();
  bindContextMenu();
  bindScreensaver();
  loadStickyNotes();
  RetroSounds.syncLabel();
  renderProjects();
  await loadResumeTextFile();
  if (!restoreDesktopState()) openWindow("about-window");
}
initDesktop();
