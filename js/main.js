// js/main.js — Entry point: menu system, event binding, and desktop init

import {
  desktop, windows, openers, closers, menuButtons, menuActions,
  menuDropdowns, mobileCloseBtn, mobileLayoutQuery, S,
  syncDynamicElements, BROWSER_HOME_URL, THEME_ACTION_MAP
} from "./state.js";
import { RetroSounds } from "./sounds.js";
import {
  openWindow, closeWindow, closeFocusedWindow, closeAllWindows,
  openAllWindows, cascadeWindows, saveDesktopState, updateClock,
  updateMobileNav, bindIconFallbackHandlers, initDragHandlers,
  loadResumeTextFile, loadCaseStudy, restoreDesktopState, restoreThemePreference,
  applyTheme, setRestartWinampFlutter, setStopWinampPlayback
} from "./window-manager.js";
import {
  renderProjects, bindDynamicContentEvents, ALLOWED_URLS,
  ALLOWED_NORMALIZED_URLS, normalizeBrowserUrl
} from "./browser.js";
import { bindWinampControls, restartWinampFlutter, stopWinampPlayback } from "./winamp.js";
import { bindTerminal } from "./terminal.js";
import {
  runBootSequence, bindScreensaver, triggerBsod,
  bindContextMenu, loadStickyNotes, createStickyNote
} from "./extras.js";

// Wire up late-bound dependency (breaks circular dep between winamp↔window-manager)
setRestartWinampFlutter(restartWinampFlutter);
setStopWinampPlayback(stopWinampPlayback);

// ── Menu system ──────────────────────────────────────────────

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
  S.activeMenuButton = button;
  if (focusFirstItem) getMenuItems(targetMenu)[0]?.focus();
}

function closeMenus({ returnFocus = false } = {}) {
  menuDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
  menuButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
  if (returnFocus && S.activeMenuButton) {
    S.activeMenuButton.focus();
  }
  S.activeMenuButton = null;
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

function runMenuAction(action) {
  RetroSounds.click();
  if (action === "open-about") openWindow("about-window");
  if (action === "open-projects") openWindow("projects-window");
  if (action === "open-browser") openWindow("browser-window");
  if (action === "open-news") openWindow("news-window");
  if (action === "open-resume") openWindow("resume-window");
  if (action === "open-timeline") openWindow("timeline-window");
  if (action === "open-contact") openWindow("contact-window");
  if (action === "open-dashboard") openWindow("dashboard-window");
  if (action === "open-winamp") openWindow("winamp-window");
  if (action === "open-doom") openWindow("doom-window");
  if (action === "open-terminal") openWindow("terminal-window");
  if (action === "open-case-studies") openWindow("case-studies-window");
  if (action === "close-focused") closeFocusedWindow();
  if (action === "close-all") closeAllWindows();
  if (action === "open-all") openAllWindows();
  if (action === "cascade") cascadeWindows();
  if (THEME_ACTION_MAP[action]) applyTheme(THEME_ACTION_MAP[action]);
  if (action === "toggle-sounds") RetroSounds.toggle();
  if (action === "new-sticky") createStickyNote();
  closeMenus();
}

function rebalanceDesktopIconColumns() {
  if (mobileLayoutQuery.matches || !desktop || openers.length === 0) return;

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const firstX = Number.parseFloat(openers[0].style.getPropertyValue("--x")) || 3;
  const firstY = Number.parseFloat(openers[0].style.getPropertyValue("--y")) || 4.5;
  const secondY = Number.parseFloat(openers[1]?.style.getPropertyValue("--y")) || firstY + 8;
  const rowStepRem = Math.max(1, secondY - firstY);
  const colStepRem = 8;
  const iconHeightPx = openers[0].offsetHeight || rowStepRem * rootFontSize;
  const availableHeightPx = desktop.clientHeight;
  const firstYpx = firstY * rootFontSize;
  const rowsPerColumn = Math.max(
    1,
    Math.floor((availableHeightPx - firstYpx - iconHeightPx) / (rowStepRem * rootFontSize)) + 1
  );

  openers.forEach((icon, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    icon.style.setProperty("--x", `${firstX + column * colStepRem}rem`);
    icon.style.setProperty("--y", `${firstY + row * rowStepRem}rem`);
  });
}

// ── Event binding ────────────────────────────────────────────

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
    if (S.activeWindowId) closeWindow(S.activeWindowId);
  });
}

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
    if (S.activeMenuButton) {
      closeMenus({ returnFocus: true });
      return;
    }
    closeMenus();
  }
});

window.addEventListener("resize", rebalanceDesktopIconColumns);

mobileLayoutQuery.addEventListener("change", () => {
  rebalanceDesktopIconColumns();
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

// ── Clock ────────────────────────────────────────────────────

setInterval(updateClock, 1000 * 15);
updateClock();

// ── GitHub repo integration (called from apps/github-repos.js) ─

window.addGithubRepos = function (repos) {
  const existingIds = new Set(S.portfolioApps.map((a) => a.id));
  const newRepos = repos.filter((r) => !existingIds.has(r.id));
  if (newRepos.length === 0) return;
  S.portfolioApps = [...S.portfolioApps, ...newRepos].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );
  newRepos.forEach((r) => {
    if (!r.url) return;
    ALLOWED_URLS.add(r.url);
    const normalizedUrl = normalizeBrowserUrl(r.url);
    if (normalizedUrl && normalizedUrl !== BROWSER_HOME_URL) {
      ALLOWED_NORMALIZED_URLS.add(normalizedUrl);
    }
  });
  renderProjects();
};

// ── Desktop init ─────────────────────────────────────────────

async function initDesktop() {
  runBootSequence();
  restoreThemePreference();
  syncDynamicElements();
  bindIconFallbackHandlers();
  initDragHandlers();
  bindDynamicContentEvents();
  try {
    bindWinampControls();
  } catch (error) {
    console.error("Winamp initialization failed:", error);
  }
  bindTerminal();
  bindContextMenu(runMenuAction);
  bindScreensaver();
  loadStickyNotes();
  RetroSounds.syncLabel();
  renderProjects();
  rebalanceDesktopIconColumns();
  // Case study tab switching
  const caseStudiesWindow = document.getElementById("case-studies-window");
  if (caseStudiesWindow) {
    caseStudiesWindow.addEventListener("click", (event) => {
      const tab = event.target.closest(".case-study-tab[data-case]");
      if (!tab) return;
      caseStudiesWindow.querySelectorAll(".case-study-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      loadCaseStudy(tab.dataset.case);
    });
  }

  // Contact form — AJAX submit via Web3Forms (document-level delegation)
  document.addEventListener("submit", async (event) => {
    if (!event.target.matches("#contact-form")) return;
    event.preventDefault();
    const form = event.target;
    const submitBtn = document.getElementById("contact-submit");
    const statusEl = document.getElementById("contact-status");
    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) {
      statusEl.textContent = "Sending…";
      statusEl.className = "contact-status";
    }
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (data.success) {
        // Replace form with a retro success panel
        const shell = form.closest(".contact-shell");
        if (shell) {
          shell.innerHTML = `
            <div class="contact-success">
              <p class="contact-success-icon">▣</p>
              <p><strong>TRANSMISSION SENT</strong></p>
              <p>Message received. I'll be in touch.</p>
            </div>`;
        }
      } else {
        if (statusEl) {
          statusEl.textContent = data.message || "Something went wrong. Try emailing directly.";
          statusEl.className = "contact-status err";
        }
        if (submitBtn) submitBtn.disabled = false;
      }
    } catch {
      if (statusEl) {
        statusEl.textContent = "Network error. Try emailing directly.";
        statusEl.className = "contact-status err";
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  await loadResumeTextFile();
  await loadCaseStudy("erasteel");
  if (!restoreDesktopState()) openWindow("about-window");
}

initDesktop();
