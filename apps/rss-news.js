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
  const STALE_CACHE_MS = 30 * 60 * 1000;
  const MAX_ITEMS = 16;
  const FEED_TIMEOUT_MS = 7000;
  const MAX_PER_FEED = 8;
  const FEED_PROXY_BUILDERS = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`
  ];
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

  function parseItemsFromXml(feed, xmlText) {
    const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) return [];

    const rssItems = [...xmlDoc.querySelectorAll("item")];
    const atomEntries = [...xmlDoc.querySelectorAll("entry")];
    const nodes = rssItems.length ? rssItems : atomEntries;

    return nodes.slice(0, MAX_PER_FEED).map((itemNode) => {
      const title = textOrEmpty(itemNode, "title") || "Untitled headline";
      const linkNode = itemNode.querySelector("link");
      const linkAttr = linkNode?.getAttribute("href") || "";
      const linkText = textOrEmpty(itemNode, "link");
      const link = linkAttr || linkText;
      const description = textOrEmpty(itemNode, "description")
        || textOrEmpty(itemNode, "summary")
        || textOrEmpty(itemNode, "content");
      const pubDate = textOrEmpty(itemNode, "pubDate")
        || textOrEmpty(itemNode, "published")
        || textOrEmpty(itemNode, "updated");

      return {
        source: feed.name,
        title,
        link,
        description: description.slice(0, 240),
        pubDate
      };
    }).filter((item) => item.link);
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return "";
      return await response.text();
    } catch {
      return "";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchFeed(feed) {
    for (const buildProxyUrl of FEED_PROXY_BUILDERS) {
      const xmlText = await fetchWithTimeout(buildProxyUrl(feed.url), FEED_TIMEOUT_MS);
      if (!xmlText) continue;

      const parsedItems = parseItemsFromXml(feed, xmlText);
      if (parsedItems.length) return parsedItems;
    }

    return [];
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

    if (merged.length) {
      cachedItems = merged.slice(0, MAX_ITEMS);
      cachedAt = Date.now();
      renderItems(cachedItems);
      setMetaText(`Updated ${new Date(cachedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${cachedItems.length} headlines`);
    } else if (cachedItems.length && now - cachedAt < STALE_CACHE_MS) {
      renderItems(cachedItems);
      setMetaText(`Live refresh failed · showing cached headlines from ${new Date(cachedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } else {
      cachedItems = [];
      setMetaText("Feeds unavailable right now. Please try again in a minute.");
      renderItems(cachedItems);
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
