const desktop = document.getElementById("desktop");
const windows = [...document.querySelectorAll(".window")];
const openers = [...document.querySelectorAll(".desktop-icon")];
const closers = [...document.querySelectorAll(".close-btn")];
const clock = document.getElementById("clock");

let topZ = 10;

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
}

openers.forEach((icon) => {
  icon.addEventListener("dblclick", () => {
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
    dragging = true;
    bringToFront(win);
    const rect = win.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointerup", (event) => {
    dragging = false;
    handle.releasePointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", onMove);
  win.addEventListener("mousedown", () => bringToFront(win));
});

desktop.addEventListener("dblclick", (event) => {
  if (event.target === desktop) {
    windows.forEach((win) => win.classList.remove("open"));
  }
});

setInterval(updateClock, 1000 * 15);
updateClock();

openWindow("about-window");
openWindow("projects-window");
