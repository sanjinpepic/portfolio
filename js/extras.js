// js/extras.js â€” Boot sequence, screensaver, BSOD, context menu, sticky notes

import { desktop, windows, mobileLayoutQuery, S } from "./state.js";
import { escapeHtml } from "./utils.js";
import { RetroSounds } from "./sounds.js";

// â”€â”€ Boot sequence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function runBootSequence() {
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

// â”€â”€ Screen saver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

export function bindScreensaver() {
  const events = ["mousemove", "keydown", "pointerdown", "scroll"];
  events.forEach((ev) => document.addEventListener(ev, resetScreensaverTimer, { passive: true }));
  resetScreensaverTimer();
}

// â”€â”€ BSOD Easter egg â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let bsodActive = false;

export function triggerBsod() {
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

// â”€â”€ Right-click context menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function bindContextMenu(menuActionHandler) {
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
    menuActionHandler(btn.dataset.ctxAction);
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

// â”€â”€ Sticky notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

export function createStickyNote({ id, x, y, w, h, text, color } = {}) {
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
  el.style.zIndex = String(++S.topZ);

  // Darken header colour slightly
  el.innerHTML = `
    <div class="sticky-note-header" style="background:${noteColor}; filter:brightness(0.85)">
      <span>ðŸ“Œ Note</span>
      <button class="sticky-note-close" aria-label="Delete sticky note">X</button>
    </div>
    <textarea class="sticky-note-body" placeholder="Type here...">${escapeHtml(text || "")}</textarea>
  `;

  // Drag on header
  const header = el.querySelector(".sticky-note-header");
  let dragging = false, offX = 0, offY = 0;

  header.addEventListener("pointerdown", (e) => {
    if (mobileLayoutQuery.matches) return;
    if (e.target.closest(".sticky-note-close")) return;
    dragging = true;
    el.style.zIndex = String(++S.topZ);
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

export function loadStickyNotes() {
  try {
    const data = JSON.parse(localStorage.getItem(STICKIES_KEY) || "[]");
    if (Array.isArray(data)) data.forEach((n) => createStickyNote(n));
  } catch (_) {}
}



