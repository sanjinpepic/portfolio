(function () {
  let dashboardBootstrapped = false;
  let cachedFact = null;
  let cachedFactAt = 0;
  let factProviderIndex = Math.floor(Math.random() * 5);
  let pizzaRefreshTimer = null;
  let volcanoRefreshTimer = null;
  let mouseKpiTimer = null;
  let mouseListenerAttached = false;
  const FACT_CACHE_MS = 90 * 1000;

  const mouseStats = {
    lastX: null,
    lastY: null,
    lastAt: null,
    totalDistanceM: 0,
    totalActiveSeconds: 0,
    peakSpeed: 0,
    liveSpeed: 0,
    recentSamples: []
  };

  function normalizeFact(text) {
    if (typeof text !== "string") return "";
    return text.replace(/\s+/g, " ").trim();
  }

  async function fetchJsonWithFallback(urls, timeoutMs = 1800) {
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
        const data = await fetchJsonWithFallback(["https://api.wheretheiss.at/v1/satellites/25544"]);
        if (typeof data?.latitude !== "number" || typeof data?.longitude !== "number") return "";
        return `The ISS is currently near latitude ${data.latitude.toFixed(2)}, longitude ${data.longitude.toFixed(2)}.`;
      }
    },
    {
      source: "Astronaut Roll Call",
      load: async () => {
        const data = await fetchJsonWithFallback(["https://api.allorigins.win/raw?url=http://api.open-notify.org/astros.json"]);

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

  function buildTechDebtSeries(points = 14) {
    const labels = [];
    const debtAdded = [];
    const debtPaidDown = [];
    const netDebt = [];
    const start = new Date();
    let runningDebt = 72;

    for (let index = points - 1; index >= 0; index -= 1) {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - index * 7));
      labels.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }

    labels.forEach((_, idx) => {
      const wave = 1 + Math.sin((idx + 1) * 0.62) * 0.22;
      const afterHoursSpike = idx % 5 === 4 ? 1.18 : 1;
      const added = Math.max(7, Math.round((17 + idx * 0.7) * wave * afterHoursSpike));
      const paid = Math.max(5, Math.round((12 + idx * 0.55) * (1 + Math.cos(idx * 0.48) * 0.18)));
      runningDebt = Math.max(0, runningDebt + added - paid);

      debtAdded.push(added);
      debtPaidDown.push(paid);
      netDebt.push(runningDebt);
    });

    return { labels, debtAdded, debtPaidDown, netDebt };
  }

  function resolveVolcanoRisk(score) {
    if (score >= 185) return { label: "Catastrophic", badgeClass: "volcano-risk-catastrophic" };
    if (score >= 145) return { label: "Spicy", badgeClass: "volcano-risk-spicy" };
    if (score >= 105) return { label: "Medium", badgeClass: "volcano-risk-medium" };
    return { label: "Low", badgeClass: "volcano-risk-low" };
  }

  function drawTechDebtVolcano(canvas, dashboardWindow) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { labels, debtAdded, debtPaidDown, netDebt } = buildTechDebtSeries();
    const width = canvas.width;
    const height = canvas.height;
    const paddingLeft = 45;
    const paddingRight = 16;
    const paddingTop = 12;
    const paddingBottom = 32;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const combined = debtAdded.concat(debtPaidDown);
    const maxFlow = Math.max(...combined) * 1.1;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#edf2ff";
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row <= 4; row += 1) {
      const y = paddingTop + (plotHeight / 4) * row;
      ctx.strokeStyle = "#a5b6de";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillStyle = "#2c3f74";
      ctx.font = "14px VT323";
      const axisValue = Math.round(maxFlow - (maxFlow / 4) * row);
      ctx.fillText(String(axisValue), 10, y + 4);
    }

    function pointAt(index, value) {
      const x = paddingLeft + (index / (labels.length - 1)) * plotWidth;
      const y = paddingTop + plotHeight - (value / maxFlow) * plotHeight;
      return { x, y };
    }

    function drawArea(values, fillStyle, strokeStyle) {
      ctx.beginPath();
      const first = pointAt(0, values[0]);
      ctx.moveTo(first.x, paddingTop + plotHeight);
      ctx.lineTo(first.x, first.y);

      values.forEach((value, index) => {
        const { x, y } = pointAt(index, value);
        ctx.lineTo(x, y);
      });

      const last = pointAt(values.length - 1, values[values.length - 1]);
      ctx.lineTo(last.x, paddingTop + plotHeight);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();

      ctx.beginPath();
      values.forEach((value, index) => {
        const { x, y } = pointAt(index, value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawArea(debtAdded, "rgba(220, 96, 34, 0.45)", "#b9491a");
    drawArea(debtPaidDown, "rgba(48, 142, 89, 0.35)", "#2c8e58");

    const netMin = Math.min(...netDebt);
    const netMax = Math.max(...netDebt);
    const netRange = Math.max(1, netMax - netMin);
    ctx.beginPath();

    netDebt.forEach((value, index) => {
      const x = paddingLeft + (index / (netDebt.length - 1)) * plotWidth;
      const y = paddingTop + plotHeight - ((value - netMin) / netRange) * plotHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = "#40286d";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    labels.forEach((label, index) => {
      if (index % 3 !== 0 && index !== labels.length - 1) return;
      const x = paddingLeft + (index / (labels.length - 1)) * plotWidth;
      ctx.fillStyle = "#243a73";
      ctx.font = "13px VT323";
      ctx.fillText(label, x - 14, height - 8);
    });

    const latestDebt = netDebt[netDebt.length - 1];
    const latestCooling = debtPaidDown[debtPaidDown.length - 1];
    const risk = resolveVolcanoRisk(latestDebt);

    const magmaLevelNode = dashboardWindow.querySelector("#volcano-magma-level");
    if (magmaLevelNode) magmaLevelNode.textContent = `${latestDebt} pts`;

    const eruptionRiskNode = dashboardWindow.querySelector("#volcano-eruption-risk");
    if (eruptionRiskNode) eruptionRiskNode.textContent = risk.label;

    const lavaCooledNode = dashboardWindow.querySelector("#volcano-lava-cooled");
    if (lavaCooledNode) lavaCooledNode.textContent = `${latestCooling} pts/wk`;

    const riskBadge = dashboardWindow.querySelector("#volcano-risk-badge");
    if (riskBadge) {
      riskBadge.textContent = `${risk.label} risk`;
      riskBadge.className = `volcano-risk-badge ${risk.badgeClass}`;
    }
  }

  function describeMouseMode(speed) {
    if (speed > 1.2) return "Mouse warp drive 🚀";
    if (speed > 0.6) return "Tactical frenzy ⚡";
    if (speed > 0.2) return "Focused builder 🛠️";
    return "Meditation mode 🧘";
  }

  function recordMouseMotion(event) {
    const now = performance.now();

    if (mouseStats.lastAt === null) {
      mouseStats.lastX = event.clientX;
      mouseStats.lastY = event.clientY;
      mouseStats.lastAt = now;
      return;
    }

    const dtMs = now - mouseStats.lastAt;
    if (dtMs <= 0) return;

    const dx = event.clientX - mouseStats.lastX;
    const dy = event.clientY - mouseStats.lastY;
    const distancePx = Math.sqrt(dx * dx + dy * dy);
    const dpi = (window.devicePixelRatio || 1) * 96;
    const distanceMeters = (distancePx / dpi) * 0.0254;
    const dtSeconds = dtMs / 1000;
    const speed = distanceMeters / dtSeconds;

    mouseStats.lastX = event.clientX;
    mouseStats.lastY = event.clientY;
    mouseStats.lastAt = now;
    mouseStats.liveSpeed = speed;
    mouseStats.peakSpeed = Math.max(mouseStats.peakSpeed, speed);

    if (distancePx > 1) {
      mouseStats.totalDistanceM += distanceMeters;
      mouseStats.totalActiveSeconds += dtSeconds;
    }

    mouseStats.recentSamples.push({ at: now, speed });
    const cutoff = now - 10000;
    mouseStats.recentSamples = mouseStats.recentSamples.filter((sample) => sample.at >= cutoff);
  }

  function renderMouseSpeedKpi(dashboardWindow) {
    const liveNode = dashboardWindow.querySelector("#mouse-live-speed");
    const peakNode = dashboardWindow.querySelector("#mouse-peak-speed");
    const averageNode = dashboardWindow.querySelector("#mouse-average-speed");
    const zoomiesNode = dashboardWindow.querySelector("#mouse-zoomies-index");
    const modeNode = dashboardWindow.querySelector("#mouse-speed-mode");

    const live = mouseStats.liveSpeed;
    const peak = mouseStats.peakSpeed;
    const average = mouseStats.totalActiveSeconds > 0 ? mouseStats.totalDistanceM / mouseStats.totalActiveSeconds : 0;

    const recentAverage =
      mouseStats.recentSamples.length > 0
        ? mouseStats.recentSamples.reduce((sum, sample) => sum + sample.speed, 0) / mouseStats.recentSamples.length
        : 0;

    const zoomies = Math.max(0, Math.min(100, Math.round((recentAverage / 1.6) * 100)));

    if (liveNode) liveNode.textContent = `${live.toFixed(2)} m/s`;
    if (peakNode) peakNode.textContent = `${peak.toFixed(2)} m/s`;
    if (averageNode) averageNode.textContent = `${average.toFixed(2)} m/s`;
    if (zoomiesNode) zoomiesNode.textContent = `${zoomies} / 100`;
    if (modeNode) modeNode.textContent = describeMouseMode(live);
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

    const volcanoCanvas = dashboardWindow.querySelector("#tech-debt-volcano-chart");
    if (volcanoCanvas) {
      drawTechDebtVolcano(volcanoCanvas, dashboardWindow);
      volcanoRefreshTimer = window.setInterval(() => drawTechDebtVolcano(volcanoCanvas, dashboardWindow), 30 * 1000);
    }

    renderMouseSpeedKpi(dashboardWindow);
    mouseKpiTimer = window.setInterval(() => renderMouseSpeedKpi(dashboardWindow), 400);

    if (!mouseListenerAttached) {
      window.addEventListener("pointermove", recordMouseMotion, { passive: true });
      mouseListenerAttached = true;
    }
  }

  window.initializeDashboard = function initializeDashboard() {
    if (dashboardBootstrapped) return;
    dashboardBootstrapped = true;
    bootDashboard();
  };

  window.addEventListener("beforeunload", () => {
    if (pizzaRefreshTimer) window.clearInterval(pizzaRefreshTimer);
    if (volcanoRefreshTimer) window.clearInterval(volcanoRefreshTimer);
    if (mouseKpiTimer) window.clearInterval(mouseKpiTimer);
    if (mouseListenerAttached) window.removeEventListener("pointermove", recordMouseMotion);
  });
})();
