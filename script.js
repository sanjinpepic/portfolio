const desktop = document.getElementById("desktop");
const windows = [...document.querySelectorAll(".window")];
const openers = [...document.querySelectorAll(".desktop-icon")];
const closers = [...document.querySelectorAll(".close-btn")];
const menuButtons = [...document.querySelectorAll(".menu-item[data-menu]")];
const menuActions = [...document.querySelectorAll(".menu-dropdown [data-action]")];
const menuDropdowns = [...document.querySelectorAll(".menu-dropdown")];
let portfolioApps = [...(window.PORTFOLIO_APPS || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
const clock = document.getElementById("clock");
const BROWSER_HOME_URL = "about:home";
const DESKTOP_STATE_KEY = "portfolio.desktop.state.v1";
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
let winampStatus = null;
let winampActiveIndex = 0;
let winampPlaying = false;
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
  winampStatus = document.getElementById("winamp-status");
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
    windows: {},
    darkDesktop: document.body.classList.contains("dark-desktop")
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
  isRestoringDesktopState = true;
  try {
    document.body.classList.toggle("dark-desktop", Boolean(parsed.darkDesktop));
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
    requestAnimationFrame(() => {
      win.classList.add("opening");
      win.addEventListener("animationend", () => win.classList.remove("opening"), { once: true });
    });
    if (id === "about-window") startTypewriter();
  }
  bringToFront(win);
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
  // Animate close
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
    const externalLink = app.url
      ? ` <a href="${app.url}" target="_blank" rel="noopener">${app.openInNewTabLabel || "Open in new tab"}</a>`
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
    const launchButton = app.url
      ? `<a class="product-link" href="${safeUrl}">Launch</a>`
      : `<span class="product-link disabled" aria-disabled="true">Offline</span>`;
    const repoLink = app.githubUrl
      ? `<a class="repo-link" href="${safeGithubUrl}">Source</a>`
      : "";
    return `<article class="product-card" style="--delay:${index * 90}ms">
      <div class="card-glow" aria-hidden="true"></div>
      <p class="product-index">${orderLabel}</p>
      <h2>${title}</h2>
      <p class="product-copy">${description}</p>
      <div class="product-actions">${launchButton}${repoLink}</div>
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

  if (!isAllowedUrl(normalizedUrl)) {
    if (browserStatus) {
      browserStatus.textContent = `Blocked: ${normalizedUrl} is not in the allowed project list.`;
    }
    return;
  }
  if (browserFrame) browserFrame.removeAttribute("srcdoc");
  if (browserAddress) browserAddress.value = normalizedUrl;
  if (browserFrame) browserFrame.removeAttribute("srcdoc");
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
    const muted = winampPlayer?.isMuted?.() ?? true;
    winampMuteToggle.textContent = muted ? "🔇 Muted" : "🔊 Sound On";
  }
  if (winampChannelList) {
    [...winampChannelList.querySelectorAll(".winamp-channel-btn")].forEach((button, index) => {
      button.setAttribute("aria-selected", index === winampActiveIndex ? "true" : "false");
      button.classList.toggle("active", index === winampActiveIndex);
    });
  }
}
function selectWinampChannel(index, { autoPlay = true } = {}) {
  if (!winampPlayer || !WINAMP_PLAYLIST[index]) return;
  winampActiveIndex = index;
  winampPlayer.loadVideoById(WINAMP_PLAYLIST[index].id);
  if (autoPlay) winampPlayer.playVideo();
  if (winampStatus) winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[index].title}`;
  updateWinampUi();
}
function setupWinampPlaylistUi() {
  if (!winampChannelList) return;
  winampChannelList.innerHTML = WINAMP_PLAYLIST.map((track, index) =>
    `<button type="button" class="retro-btn winamp-channel-btn" data-winamp-index="${index}" role="option">CH ${String(index + 1).padStart(2, "0")} · ${track.title}</button>`
  ).join("\n");

  if (!winampPlaylistBound) {
    winampChannelList.addEventListener("click", (event) => {
      const channelButton = event.target.closest(".winamp-channel-btn");
      if (!channelButton) return;
      selectWinampChannel(Number(channelButton.dataset.winampIndex));
    });
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
        if (winampStatus) winampStatus.textContent = `Now tuned to: ${WINAMP_PLAYLIST[0].title}`;
        updateWinampUi();
        event.target.playVideo();
      },
      onStateChange: (event) => {
        winampPlaying = event.data === window.YT.PlayerState.PLAYING;
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
      if (winampPlayer.isMuted()) {
        winampPlayer.unMute();
      } else {
        winampPlayer.mute();
      }
      updateWinampUi();
    });
  }
  if (winampVolume) {
    winampVolume.addEventListener("input", () => {
      if (!winampPlayer) return;
      const volume = Number(winampVolume.value);
      winampPlayer.setVolume(volume);
      if (volume > 0) winampPlayer.unMute();
      if (volume === 0) winampPlayer.mute();
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
  windows.forEach((win) => win.classList.remove("open"));
  activeWindowId = null;
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
function bindDynamicContentEvents() {
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
      const frameWindow = browserFrame?.contentWindow;
      frameWindow?.history.back();
    });
  }
  if (browserForward) {
    browserForward.addEventListener("click", () => {
      const frameWindow = browserFrame?.contentWindow;
      frameWindow?.history.forward();
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
    bringToFront(win);
    const rect = win.getBoundingClientRect();
    const desktopRect = desktop.getBoundingClientRect();
    offsetX = event.clientX - (rect.left - desktopRect.left);
    offsetY = event.clientY - (rect.top - desktopRect.top);
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointerup", (event) => {
    dragging = false;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    saveDesktopState();
  });
  handle.addEventListener("pointercancel", (event) => {
    dragging = false;
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
  if (action === "open-about") openWindow("about-window");
  if (action === "open-projects") openWindow("projects-window");
  if (action === "open-browser") openWindow("browser-window");
  if (action === "open-resume") openWindow("resume-window");
  if (action === "open-contact") openWindow("contact-window");
  if (action === "open-winamp") openWindow("winamp-window");
  if (action === "close-focused") closeFocusedWindow();
  if (action === "close-all") closeAllWindows();
  if (action === "open-all") openAllWindows();
  if (action === "cascade") cascadeWindows();
  if (action === "toggle-theme") {
    document.body.classList.toggle("dark-desktop");
    saveDesktopState();
  }
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
  if (event.key.toLowerCase() === "x") {
    closeFocusedWindow();
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
  if (!mobileLayoutQuery.matches) return;
  const firstOpen = windows.find((win) => win.classList.contains("open"));
  windows.forEach((win) => {
    if (firstOpen && win.id !== firstOpen.id) win.classList.remove("open");
  });
  if (!firstOpen) openWindow("about-window");
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

  function finish() {
    if (done) return;
    done = true;
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

async function initDesktop() {
  runBootSequence();
  syncDynamicElements();
  bindIconFallbackHandlers();
  bindDynamicContentEvents();
  bindWinampControls();
  renderProjects();
  await loadResumeTextFile();
  openWindow("about-window");
  // Easter egg: fake error dialog after 45s
  setTimeout(() => {
    const errWin = document.getElementById("easter-error");
    if (errWin && !errWin.classList.contains("open")) openWindow("easter-error");
  }, 45000);
}
initDesktop();
