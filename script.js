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
}
function closeMenus() {
  menuDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
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
  });
  handle.addEventListener("pointercancel", (event) => {
    dragging = false;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
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
    const targetId = button.dataset.menu;
    const targetMenu = document.getElementById(targetId);
    const alreadyOpen = targetMenu?.classList.contains("open");
    closeMenus();
    if (targetMenu && !alreadyOpen) targetMenu.classList.add("open");
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
  if (action === "toggle-theme") document.body.classList.toggle("dark-desktop");
  closeMenus();
}
menuActions.forEach((actionButton) => {
  actionButton.addEventListener("click", () => {
    runMenuAction(actionButton.dataset.action);
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
  if (event.key === "Escape") closeMenus();
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
  openWindow("about-window");
}
initDesktop();
