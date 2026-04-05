// js/browser.js — Browser window functionality

import { S, BROWSER_HOME_URL, windows, mobileLayoutQuery } from "./state.js";
import { escapeHtml } from "./utils.js";
import { openWindow } from "./window-manager.js";

// Threat model: treat browser-window navigation as untrusted input.
// Only explicitly allowlisted project URLs (plus local home/about pages) can load,
// so typo-squats, user-pasted phishing links, and open-redirect chains are blocked.
export const ALLOWED_URLS = new Set(["about:blank"]);
S.portfolioApps.forEach((app) => { if (app.url) ALLOWED_URLS.add(app.url); });

export function normalizeBrowserUrl(rawUrl) {
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

export const ALLOWED_NORMALIZED_URLS = new Set(
  [...ALLOWED_URLS]
    .map((url) => normalizeBrowserUrl(url))
    .filter((url) => Boolean(url) && url !== BROWSER_HOME_URL)
);

export function renderProjects() {
  if (!S.projectList) return;
  const items = S.portfolioApps.map((app, index) => {
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
  S.projectList.innerHTML = items.join("\n");
}

export function buildBrowserHomeMarkup() {
  const items = S.portfolioApps.map((app, index) => {
    const orderLabel = String(app.order || index + 1).padStart(2, "0");
    const title = escapeHtml(app.title || `Product ${orderLabel}`);
    const description = escapeHtml(app.description || "My project previews");
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
        <h1>Welcome to my Product Showcase</h1>
        <p>Animated previews, neon palette, and old-school web energy.</p>
        <div class="marquee"><span>Now Loading: Strategy • Analytics • Vibes • Banger Tunes •</span></div>
      </section>
      <section class="products" aria-label="Product grid">
        ${items.join("\n        ")}
      </section>
    </main>
  </body>
</html>`;
}

export function isAllowedUrl(url) {
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

export function openInRetroBrowser(url, title) {
  const normalizedUrl = normalizeBrowserUrl(url);
  if (!normalizedUrl || !isAllowedUrl(normalizedUrl)) return; // silently ignore; called only from project links
  if (normalizedUrl === BROWSER_HOME_URL) {
    loadBrowserHomePage();
    openWindow("browser-window");
    return;
  }
  if (S.browserFrame) S.browserFrame.removeAttribute("srcdoc");
  if (S.browserFrame) S.browserFrame.src = normalizedUrl;
  if (S.browserAddress) S.browserAddress.value = normalizedUrl;
  if (S.browserStatus) S.browserStatus.textContent = `Loading ${normalizedUrl}...`;
  if (S.browserTitle) S.browserTitle.textContent = `Netscape Navigator — ${title}`;
  if (S.browserThrobber) S.browserThrobber.classList.add("loading");
  openWindow("browser-window");
}

export function loadBrowserHomePage() {
  const homeMarkup = buildBrowserHomeMarkup();
  if (S.browserFrame) S.browserFrame.srcdoc = homeMarkup;
  if (S.browserAddress) S.browserAddress.value = BROWSER_HOME_URL;
  if (S.browserStatus) S.browserStatus.textContent = "Document: Done";
  if (S.browserTitle) S.browserTitle.textContent = "Netscape Navigator — Projects Home";
  if (S.browserThrobber) S.browserThrobber.classList.remove("loading");
}

export function navigateBrowserTo(url) {
  const normalizedUrl = normalizeBrowserUrl(url);
  if (!normalizedUrl) return;

  if (normalizedUrl === BROWSER_HOME_URL) {
    loadBrowserHomePage();
    return;
  }

  if (S.browserFrame) S.browserFrame.removeAttribute("srcdoc");
  if (S.browserAddress) S.browserAddress.value = normalizedUrl;
  if (S.browserFrame) S.browserFrame.src = normalizedUrl;
  if (S.browserStatus) S.browserStatus.textContent = `Loading ${normalizedUrl}...`;
  if (S.browserTitle) S.browserTitle.textContent = "Netscape Navigator";
  if (S.browserThrobber) S.browserThrobber.classList.add("loading");
}

export function setActiveTimelineNode(nodeId) {
  if (!S.timelineWindowContent || !nodeId) return;
  const timelineNodes = [...S.timelineWindowContent.querySelectorAll("[data-timeline-node]")];
  const timelineCards = [...S.timelineWindowContent.querySelectorAll("[data-timeline-card]")];
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

export function bindDynamicContentEvents() {
  if (S.timelineWindowContent && !S.timelineWindowContent.dataset.bound) {
    const timelineTrack = S.timelineWindowContent.querySelector(".timeline-track");
    S.timelineWindowContent.addEventListener("click", (event) => {
      const clickedNode = event.target.closest("[data-timeline-node]");
      if (!clickedNode || !S.timelineWindowContent.contains(clickedNode)) return;
      setActiveTimelineNode(clickedNode.dataset.timelineNode);
    });
    if (timelineTrack) {
      timelineTrack.addEventListener(
        "wheel",
        (event) => {
          if (mobileLayoutQuery.matches) return;
          const canScrollHorizontally = timelineTrack.scrollWidth > timelineTrack.clientWidth;
          if (!canScrollHorizontally) return;
          const horizontalDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
          if (!horizontalDelta) return;
          const previousScrollLeft = timelineTrack.scrollLeft;
          timelineTrack.scrollLeft += horizontalDelta;
          if (timelineTrack.scrollLeft !== previousScrollLeft) event.preventDefault();
        },
        { passive: false }
      );
    }
    S.timelineWindowContent.dataset.bound = "true";
  }

  if (S.projectList) {
    S.projectList.addEventListener("click", (event) => {
      const projectLink = event.target.closest(".project-link[data-browser-url]");
      if (!projectLink) return;
      openInRetroBrowser(projectLink.dataset.browserUrl, projectLink.dataset.browserTitle || "Project");
    });
  }
  if (S.browserHome) {
    S.browserHome.addEventListener("click", () => loadBrowserHomePage());
  }
  if (S.browserBack) {
    S.browserBack.addEventListener("click", () => {
      try {
        const frameWindow = S.browserFrame?.contentWindow;
        frameWindow?.history.back();
      } catch {
        if (S.browserStatus) S.browserStatus.textContent = "Back unavailable for cross-origin embedded pages.";
      }
    });
  }
  if (S.browserForward) {
    S.browserForward.addEventListener("click", () => {
      try {
        const frameWindow = S.browserFrame?.contentWindow;
        frameWindow?.history.forward();
      } catch {
        if (S.browserStatus) S.browserStatus.textContent = "Forward unavailable for cross-origin embedded pages.";
      }
    });
  }
  if (S.browserReload) {
    S.browserReload.addEventListener("click", () => {
      if (S.browserFrame) {
        S.browserFrame.src = S.browserFrame.src;
        if (S.browserThrobber) S.browserThrobber.classList.add("loading");
        if (S.browserStatus) S.browserStatus.textContent = "Reloading...";
      }
    });
  }
  if (S.browserStop) {
    S.browserStop.addEventListener("click", () => {
      if (S.browserThrobber) S.browserThrobber.classList.remove("loading");
      if (S.browserStatus) S.browserStatus.textContent = "Transfer interrupted.";
    });
  }

  if (S.browserGo) {
    S.browserGo.addEventListener("click", () => {
      if (!S.browserAddress) return;
      navigateBrowserTo(S.browserAddress.value);
    });
  }

  if (S.browserAddress) {
    S.browserAddress.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      navigateBrowserTo(S.browserAddress.value);
    });
  }

  if (S.browserFrame) {
    S.browserFrame.addEventListener("load", () => {
      if (S.browserStatus) S.browserStatus.textContent = "Document: Done";
      if (S.browserThrobber) S.browserThrobber.classList.remove("loading");
    });
  }
}
