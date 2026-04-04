const desktop = document.getElementById("desktop");
const windows = [...document.querySelectorAll(".window")];
const openers = [...document.querySelectorAll(".desktop-icon")];
const closers = [...document.querySelectorAll(".close-btn")];
const menuButtons = [...document.querySelectorAll(".menu-item[data-menu]")];
const menuActions = [...document.querySelectorAll(".menu-dropdown [data-action]")];
const menuDropdowns = [...document.querySelectorAll(".menu-dropdown")];
const projectLinks = [...document.querySelectorAll(".project-link[data-browser-url]")];
const browserFrame = document.getElementById("browser-frame");
const browserAddress = document.getElementById("browser-url");
const browserTitle = document.getElementById("browser-title");
const browserGo = document.getElementById("browser-go");
const browserBack = document.getElementById("browser-back");
const browserForward = document.getElementById("browser-forward");
const browserHome = document.getElementById("browser-home");
const browserReload = document.getElementById("browser-reload");
const browserStop = document.getElementById("browser-stop");
const browserThrobber = document.getElementById("browser-throbber");
const browserStatus = document.getElementById("browser-status");
const clock = document.getElementById("clock");
const resumeText = document.getElementById("resume-text");

function markdownToRetroText(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd();

    if (!line.trim()) {
      out.push("");
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push("=".repeat(40));
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(`> ${line.slice(4).toUpperCase()}`);
      continue;
    }

    if (line.startsWith("## ")) {
      const heading = line.slice(3).toUpperCase();
      out.push(heading);
      out.push("-".repeat(Math.max(heading.length, 8)));
      continue;
    }

    if (line.startsWith("# ")) {
      const heading = line.slice(2).toUpperCase();
      out.push("=".repeat(Math.max(heading.length, 20)));
      out.push(heading);
      out.push("=".repeat(Math.max(heading.length, 20)));
      continue;
    }

    if (/^-\s+/.test(line)) {
      out.push(`* ${line.replace(/^-\s+/, "")}`);
      continue;
    }

    out.push(line.replace(/\*\*/g, "").replace(/`/g, ""));
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function loadResumeTextFile() {
  if (!resumeText) return;

  try {
    const response = await fetch("assets/sanjin.md", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const markdown = await response.text();
    resumeText.textContent = markdownToRetroText(markdown);
  } catch (error) {
    resumeText.textContent = [
      "ERROR: Could not load SANJIN.MD",
      "Please make sure assets/sanjin.md exists.",
      "",
      `Details: ${error.message}`
    ].join("\n");
  }
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

// Only URLs explicitly listed in the project links (or the home URL) may load
// in the iframe. All other navigation attempts are blocked.
const ALLOWED_URLS = new Set(["about:blank", "https://metalcre.vercel.app/"]);
document.querySelectorAll(".project-link[data-browser-url]").forEach((el) => {
  if (el.dataset.browserUrl) ALLOWED_URLS.add(el.dataset.browserUrl);
});

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
  if (browserFrame) browserFrame.src = url;
  if (browserAddress) browserAddress.value = url;
  if (browserStatus) browserStatus.textContent = `Loading ${url}...`;
  if (browserTitle) browserTitle.textContent = `Netscape Navigator — ${title}`;
  if (browserThrobber) browserThrobber.classList.add("loading");
  openWindow("browser-window");
}

function navigateBrowserTo(url) {
  if (!url) return;
  const hasProtocol = /^https?:\/\//i.test(url) || url.startsWith("about:");
  const normalizedUrl = hasProtocol ? url : `https://${url}`;
  if (!isAllowedUrl(normalizedUrl)) {
    if (browserStatus) browserStatus.textContent = "Navigation blocked: only linked projects may be loaded.";
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

projectLinks.forEach((projectLink) => {
  projectLink.addEventListener("click", () => {
    openInRetroBrowser(projectLink.dataset.browserUrl, projectLink.dataset.browserTitle || "Project");
  });
});

if (browserHome) {
  browserHome.addEventListener("click", () => navigateBrowserTo("https://metalcre.vercel.app/"));
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

if (browserFrame) {
  browserFrame.addEventListener("load", () => {
    if (browserStatus) browserStatus.textContent = "Document: Done";
    if (browserThrobber) browserThrobber.classList.remove("loading");
  });
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
loadResumeTextFile();

openWindow("about-window");
openWindow("projects-window");
