(function () {
  let dashboardBootstrapped = false;
  let cachedFact = null;
  let cachedFactAt = 0;
  let factProviderIndex = Math.floor(Math.random() * 5);
  let pizzaRefreshTimer = null;
  const FACT_CACHE_MS = 45 * 1000;

  function normalizeFact(text) {
    if (typeof text !== "string") return "";
    return text.replace(/\s+/g, " ").trim();
  }

  async function fetchJsonWithFallback(urls, timeoutMs = 3000) {
    for (const url of urls) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) continue;
        return await response.json();
      } catch {
        // try next url
      } finally {
        clearTimeout(timeout);
      }
    }

    return null;
  }

  const FACT_PROVIDERS = [
    {
      source: "Useless Fact",
      load: async () => {
        const data = await fetchJsonWithFallback(["https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"]);
        return normalizeFact(data?.text);
      }
    },
    {
      source: "Numbers API",
      load: async () => {
        const data = await fetchJsonWithFallback(["https://numbersapi.com/random/year?json"]);
        return normalizeFact(data?.text);
      }
    },
    {
      source: "Cat Fact",
      load: async () => {
        const data = await fetchJsonWithFallback(["https://catfact.ninja/fact"]);
        return normalizeFact(data?.fact);
      }
    },
    {
      source: "ISS Now",
      load: async () => {
        const data = await fetchJsonWithFallback([
          "https://api.allorigins.win/raw?url=http://api.open-notify.org/iss-now.json",
          "http://api.open-notify.org/iss-now.json"
        ]);

        if (!data?.iss_position?.latitude || !data?.iss_position?.longitude) return "";
        return `The ISS is currently near latitude ${data.iss_position.latitude}, longitude ${data.iss_position.longitude}.`;
      }
    },
    {
      source: "Astronaut Roll Call",
      load: async () => {
        const data = await fetchJsonWithFallback([
          "https://api.allorigins.win/raw?url=http://api.open-notify.org/astros.json",
          "http://api.open-notify.org/astros.json"
        ]);

        if (!data?.number || !Array.isArray(data.people) || !data.people.length) return "";
        const names = data.people.slice(0, 4).map((person) => person.name).join(", ");
        const plusMore = data.people.length > 4 ? " and others" : "";
        return `${data.number} humans are currently in space, including ${names}${plusMore}.`;
      }
    }
  ];

  async function fetchFactFromMixedApis() {
    for (let attempt = 0; attempt < FACT_PROVIDERS.length; attempt += 1) {
      const provider = FACT_PROVIDERS[(factProviderIndex + attempt) % FACT_PROVIDERS.length];
      const text = normalizeFact(await provider.load());
      if (text) {
        factProviderIndex = (factProviderIndex + attempt + 1) % FACT_PROVIDERS.length;
        return { source: provider.source, text };
      }
    }

    factProviderIndex = (factProviderIndex + 1) % FACT_PROVIDERS.length;
    return null;
  }

  function renderFactList(factListNode, fact) {
    if (!factListNode) return;

    if (!fact) {
      factListNode.innerHTML = '<li class="fact-item">Could not load a fresh fact right now. Try refresh.</li>';
      return;
    }

    factListNode.innerHTML = `<li class="fact-item"><span class="fact-source">${fact.source}</span><p>${fact.text}</p></li>`;
  }

  async function loadFacts(dashboardWindow, forceRefresh = false) {
    const factListNode = dashboardWindow.querySelector("#dashboard-fact-list");
    if (!factListNode) return;

    const cacheIsFresh = cachedFact && Date.now() - cachedFactAt < FACT_CACHE_MS;
    if (!forceRefresh && cacheIsFresh) {
      renderFactList(factListNode, cachedFact);
      return;
    }

    if (!cachedFact) {
      factListNode.innerHTML = '<li class="fact-item fact-item--loading">Loading latest fact...</li>';
    } else {
      renderFactList(factListNode, cachedFact);
    }

    const freshFact = await fetchFactFromMixedApis();
    if (freshFact) {
      cachedFact = freshFact;
      cachedFactAt = Date.now();
    }

    renderFactList(factListNode, cachedFact);
  }

  function buildPizzaForecastSeries() {
    const now = new Date();
    const monthLabels = [];
    const monthlyValues = [];
    const baseMonthly = 5000000000 / 12;
    const monthlyTrend = 0.012;
    const monthProgress = now.getUTCDate() / new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

    for (let index = 0; index < 12; index += 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index, 1));
      const monthLabel = date.toLocaleDateString("en-US", { month: "short" });
      monthLabels.push(index === 0 ? `${monthLabel} (now)` : monthLabel);

      const trendValue = baseMonthly * Math.pow(1 + monthlyTrend, index);
      const seasonalPulse = 1 + Math.sin((index + monthProgress) * 1.15) * 0.04;
      const shortWave = 1 + Math.cos((index + monthProgress) * 2.25) * 0.015;
      const currentMonthLiveAdjustment = index === 0 ? 1 + (monthProgress - 0.5) * 0.03 : 1;
      monthlyValues.push(trendValue * seasonalPulse * shortWave * currentMonthLiveAdjustment);
    }

    return { monthLabels, monthlyValues };
  }

  function formatBillions(value) {
    return `${(value / 1000000000).toFixed(2)}B`;
  }

  function drawPizzaForecast(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { monthLabels, monthlyValues } = buildPizzaForecastSeries();
    const width = canvas.width;
    const height = canvas.height;
    const paddingLeft = 50;
    const paddingRight = 14;
    const paddingTop = 12;
    const paddingBottom = 30;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const minValue = Math.min(...monthlyValues);
    const maxValue = Math.max(...monthlyValues);
    const valueRange = Math.max(1, maxValue - minValue);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#edf2ff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#9db0de";
    ctx.lineWidth = 1;
    for (let row = 0; row <= 4; row += 1) {
      const y = paddingTop + (plotHeight / 4) * row;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      const labelValue = maxValue - (valueRange / 4) * row;
      ctx.fillStyle = "#2c3f74";
      ctx.font = "14px VT323";
      ctx.fillText(formatBillions(labelValue), 6, y + 4);
    }

    ctx.strokeStyle = "#1746c9";
    ctx.lineWidth = 2;
    ctx.beginPath();

    monthlyValues.forEach((value, index) => {
      const x = paddingLeft + (index / (monthlyValues.length - 1)) * plotWidth;
      const normalized = (value - minValue) / valueRange;
      const y = paddingTop + plotHeight - normalized * plotHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    monthlyValues.forEach((value, index) => {
      const x = paddingLeft + (index / (monthlyValues.length - 1)) * plotWidth;
      const normalized = (value - minValue) / valueRange;
      const y = paddingTop + plotHeight - normalized * plotHeight;

      ctx.fillStyle = index === 0 ? "#c65a1f" : "#102f80";
      ctx.beginPath();
      ctx.arc(x, y, index === 0 ? 3.4 : 2.8, 0, Math.PI * 2);
      ctx.fill();

      if (index % 2 === 0 || index === monthlyValues.length - 1 || index === 0) {
        ctx.fillStyle = "#233a75";
        ctx.font = "14px VT323";
        ctx.fillText(monthLabels[index], x - 18, height - 8);
      }
    });
  }

  function bootDashboard() {
    const dashboardWindow = document.getElementById("dashboard-window");
    if (!dashboardWindow) return;

    loadFacts(dashboardWindow);

    const refreshFactsButton = dashboardWindow.querySelector("#dashboard-refresh-facts");
    if (refreshFactsButton) {
      refreshFactsButton.addEventListener("click", () => {
        loadFacts(dashboardWindow, true);
      });
    }

    const pizzaForecastCanvas = dashboardWindow.querySelector("#pizza-forecast-chart");
    if (pizzaForecastCanvas) {
      drawPizzaForecast(pizzaForecastCanvas);
      pizzaRefreshTimer = window.setInterval(() => drawPizzaForecast(pizzaForecastCanvas), 60 * 60 * 1000);
    }
  }

  window.initializeDashboard = function initializeDashboard() {
    if (dashboardBootstrapped) return;
    dashboardBootstrapped = true;
    bootDashboard();
  };

  window.addEventListener("beforeunload", () => {
    if (pizzaRefreshTimer) window.clearInterval(pizzaRefreshTimer);
  });
})();
