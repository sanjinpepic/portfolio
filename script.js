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
async function loadWindowPartials() {
  const containers = [...document.querySelectorAll("[data-window-src]")];
  await Promise.all(
    containers.map(async (container) => {
      const source = container.dataset.windowSrc;
      if (!source) return;
      try {
        const response = await fetch(source, { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        container.innerHTML = await response.text();
      } catch (error) {
        container.innerHTML = `<p>Could not load ${source}: ${error.message}</p>`;
      }
    })
  );
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
  if (mobileLayoutQuery.matches) {
    windows.forEach((windowEl) => {
      if (windowEl.id !== id) windowEl.classList.remove("open");
    });
  }
  if (id === "browser-window" && browserAddress?.value === "about:blank") {
    loadBrowserHomePage();
  }
  win.classList.add("open");
  bringToFront(win);
  saveDesktopState();
}
function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.remove("open");
  if (activeWindowId === id) {
    const topOpenWindow = windows
      .filter((windowEl) => windowEl.classList.contains("open"))
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0))
      .pop();
    activeWindowId = topOpenWindow?.id || null;
  }
  saveDesktopState();
}
// Only URLs explicitly listed in the app files (or the home URL) may load
// in the iframe. All other navigation attempts are blocked.
const ALLOWED_URLS = new Set(["about:blank"]);
portfolioApps.forEach((app) => {
  if (app.url) ALLOWED_URLS.add(app.url);
});
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
    const body = app.url ? `<a href="${app.url}">${orderLabel} — ${app.title}</a>` : `${orderLabel} — ${app.title}`;
    return `<li>${body}</li>`;
  });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Projects Home</title>
    <link rel="stylesheet" href="styles.css" />
    <style>
      body { background: #f4f4f4; color: #111; margin: 0; padding: 1rem 1.25rem; font-size: 1.35rem; }
      h1 { margin: 0 0 0.6rem; font-size: 1.8rem; }
      p { margin: 0 0 0.7rem; }
      ul { margin: 0; padding-left: 1.1rem; }
      li { margin-bottom: 0.55rem; }
      a { color: #133f9a; }
    </style>
  </head>
  <body>
    <h1>Projects Home</h1>
    <p>Select a project to view:</p>
    <ul>
      ${items.join("\n      ")}
    </ul>
  </body>
</html>`;
}
function isAllowedUrl(url) {
  if (url === "about:blank" || url === BROWSER_HOME_URL) return true;
  if (ALLOWED_URLS.has(url)) return true;

  let candidate;
  try {
    candidate = new URL(url);
  } catch {
    return false;
  }

  for (const allowed of ALLOWED_URLS) {
    if (allowed === "about:blank" || allowed === BROWSER_HOME_URL) continue;

    let allowedParsed;
    try {
      allowedParsed = new URL(allowed);
    } catch {
      continue;
    }

    if (candidate.origin !== allowedParsed.origin) continue;
    if (candidate.pathname.startsWith(allowedParsed.pathname)) return true;
  }

  return false;
}
function openInRetroBrowser(url, title) {
  if (!isAllowedUrl(url)) return; // silently ignore; called only from project links
  if (url === BROWSER_HOME_URL) {
    loadBrowserHomePage();
    openWindow("browser-window");
    return;
  }
  if (browserFrame) browserFrame.removeAttribute("srcdoc");
  if (browserFrame) browserFrame.src = url;
  if (browserAddress) browserAddress.value = url;
  if (browserStatus) browserStatus.textContent = `Loading ${url}...`;
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
  if (!url) return;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return;
  const hasProtocol = /^https?:\/\//i.test(trimmedUrl) || trimmedUrl.startsWith("about:");
  const looksLikeLocalPath =
    /^\.{0,2}\//.test(trimmedUrl) || trimmedUrl.startsWith("/") || /^[\w-]+\/[\w./-]+$/.test(trimmedUrl);
  const normalizedUrl = hasProtocol || looksLikeLocalPath ? trimmedUrl : `https://${trimmedUrl}`;

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
  newRepos.forEach((r) => { if (r.url) ALLOWED_URLS.add(r.url); });
  renderProjects();
};
async function initDesktop() {
  await loadWindowPartials();
  syncDynamicElements();
  bindDynamicContentEvents();
  renderProjects();
  await loadResumeTextFile();
  if (!restoreDesktopState()) openWindow("about-window");
}
initDesktop();
