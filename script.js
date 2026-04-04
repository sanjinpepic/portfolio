const desktop = document.getElementById("desktop");
const windows = [...document.querySelectorAll(".window")];
const openers = [...document.querySelectorAll(".desktop-icon")];
const closers = [...document.querySelectorAll(".close-btn")];
const menuButtons = [...document.querySelectorAll(".menu-item[data-menu]")];
const menuActions = [...document.querySelectorAll(".menu-dropdown [data-action]")];
const menuDropdowns = [...document.querySelectorAll(".menu-dropdown")];
const portfolioApps = [...(window.PORTFOLIO_APPS || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
const clock = document.getElementById("clock");
const BROWSER_HOME_URL = "about:home";
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
  topZ += 1;
  win.style.zIndex = String(topZ);
  activeWindowId = win.id;
}

function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
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

    return `<li><h3>${orderLabel} — ${linkedTitle}</h3><p>${app.description}${externalLink}</p></li>`;
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
  if (ALLOWED_URLS.has(url)) return true;
  // Allow same-origin prefix match (e.g. sub-pages of a whitelisted origin)
  for (const allowed of ALLOWED_URLS) {
    if (allowed !== "about:blank" && url.startsWith(allowed)) return true;
  }
  return false;
}

function openInRetroBrowser(url, title) {
  if (!isAllowedUrl(url)) return; // silently ignore; called only from project links
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
  if (browserAddress) browserAddress.value = normalizedUrl;
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
  windows.forEach((win) => openWindow(win.id));
}

function cascadeWindows() {
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
  win.addEventListener("mousedown", () => bringToFront(win));
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

menuActions.forEach((actionButton) => {
  actionButton.addEventListener("click", () => {
    const action = actionButton.dataset.action;
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
  });
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

setInterval(updateClock, 1000 * 15);
updateClock();

async function initDesktop() {
  await loadWindowPartials();
  syncDynamicElements();
  bindDynamicContentEvents();
  renderProjects();
  await loadResumeTextFile();
  openWindow("about-window");
}

initDesktop();
