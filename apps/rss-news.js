(function () {
  const FEEDS = [
    {
      name: "BBC",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml"
    },
    {
      name: "CNN",
      url: "http://rss.cnn.com/rss/edition_world.rss"
    },
    {
      name: "The Guardian",
      url: "https://www.theguardian.com/world/rss"
    },
    {
      name: "HISTORY",
      url: "https://www.history.com/.rss/full/this-day-in-history"
    }
  ];

  const CACHE_MS = 4 * 60 * 1000;
  const MAX_ITEMS = 16;
  let initialized = false;
  let cachedItems = [];
  let cachedAt = 0;

  function formatPublishedDate(rawDate) {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return "Unknown date";
    return parsed.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function setMetaText(text) {
    const meta = document.getElementById("news-meta");
    if (meta) meta.textContent = text;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderItems(items) {
    const list = document.getElementById("news-list");
    if (!list) return;

    if (!items.length) {
      list.innerHTML = '<li class="news-item">Could not load feeds right now. Try refresh.</li>';
      return;
    }

    list.innerHTML = items.map((item) => {
      const safeSource = escapeHtml(item.source);
      const safeDate = escapeHtml(formatPublishedDate(item.pubDate));
      const safeTitle = escapeHtml(item.title);
      const safeDescription = escapeHtml(item.description);
      const safeLink = escapeHtml(item.link);
      const description = safeDescription ? `<p>${safeDescription}</p>` : "";
      return `
        <li class="news-item">
          <div class="news-item-topline">
            <span class="news-source">${safeSource}</span>
            <span class="news-date">${safeDate}</span>
          </div>
          <a class="news-link" href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>
          ${description}
        </li>
      `;
    }).join("");
  }

  function textOrEmpty(node, selector) {
    const value = node.querySelector(selector)?.textContent || "";
    return value.replace(/\s+/g, " ").trim();
  }

  async function fetchFeed(feed) {
    const targetUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(targetUrl, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return [];

      const xmlText = await response.text();
      const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
      const items = [...xmlDoc.querySelectorAll("item")].slice(0, 8).map((itemNode) => ({
        source: feed.name,
        title: textOrEmpty(itemNode, "title") || "Untitled headline",
        link: textOrEmpty(itemNode, "link"),
        description: textOrEmpty(itemNode, "description").slice(0, 240),
        pubDate: textOrEmpty(itemNode, "pubDate")
      })).filter((item) => item.link);

      return items;
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function loadNews({ forceRefresh = false } = {}) {
    const refreshBtn = document.getElementById("news-refresh-btn");
    const now = Date.now();
    const useCache = !forceRefresh && cachedItems.length > 0 && now - cachedAt < CACHE_MS;

    if (refreshBtn) refreshBtn.disabled = true;

    if (useCache) {
      renderItems(cachedItems);
      setMetaText(`Updated ${new Date(cachedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${cachedItems.length} headlines`);
      if (refreshBtn) refreshBtn.disabled = false;
      return;
    }

    setMetaText("Refreshing headlines from all sources…");
    const grouped = await Promise.all(FEEDS.map((feed) => fetchFeed(feed)));
    const merged = grouped.flat();

    merged.sort((a, b) => {
      const timeA = new Date(a.pubDate).getTime() || 0;
      const timeB = new Date(b.pubDate).getTime() || 0;
      return timeB - timeA;
    });

    cachedItems = merged.slice(0, MAX_ITEMS);
    cachedAt = Date.now();

    renderItems(cachedItems);

    if (cachedItems.length) {
      setMetaText(`Updated ${new Date(cachedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${cachedItems.length} headlines`);
    } else {
      setMetaText("Feeds unavailable right now. Please try again in a minute.");
    }

    if (refreshBtn) refreshBtn.disabled = false;
  }

  window.initializeNewsFeed = function initializeNewsFeed() {
    if (!initialized) {
      initialized = true;
      const refreshBtn = document.getElementById("news-refresh-btn");
      refreshBtn?.addEventListener("click", () => loadNews({ forceRefresh: true }));
    }

    loadNews();
  };
})();
