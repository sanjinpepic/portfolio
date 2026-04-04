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
const browserStatus = document.getElementById("browser-status");
const clock = document.getElementById("clock");

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

function openInRetroBrowser(url, title) {
  if (browserFrame) browserFrame.src = url;
  if (browserAddress) browserAddress.value = url;
  if (browserStatus) browserStatus.textContent = `Loading ${url}...`;
  if (browserTitle) browserTitle.textContent = `Retro Browser — ${title}`;
  openWindow("browser-window");
}

function navigateBrowserTo(url) {
  if (!url) return;
  const hasProtocol = /^https?:\/\//i.test(url) || url.startsWith("about:");
  const normalizedUrl = hasProtocol ? url : `https://${url}`;
  if (browserAddress) browserAddress.value = normalizedUrl;
  if (browserFrame) browserFrame.src = normalizedUrl;
  if (browserStatus) browserStatus.textContent = `Loading ${normalizedUrl}...`;
  if (browserTitle) browserTitle.textContent = "Retro Browser";
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

if (browserGo) {
  browserGo.addEventListener("click", () => navigateBrowserTo(browserAddress?.value || ""));
}

if (browserAddress) {
  browserAddress.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      navigateBrowserTo(browserAddress.value);
    }
  });
}

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

if (browserFrame) {
  browserFrame.addEventListener("load", () => {
    if (browserStatus) browserStatus.textContent = "Document: Done";
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
    const maxX = window.innerWidth - win.offsetWidth;
    const maxY = window.innerHeight - win.offsetHeight;
    win.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    win.style.top = `${Math.max(33, Math.min(y, maxY))}px`;
  }

  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".close-btn")) return;
    dragging = true;
    bringToFront(win);
    const rect = win.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
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

openWindow("about-window");
openWindow("projects-window");
