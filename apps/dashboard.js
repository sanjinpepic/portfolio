(function () {
  let dashboardBootstrapped = false;

  function parseNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function animateKpiValue(node, duration = 1200) {
    const target = parseNumber(node.dataset.target);
    const prefix = node.dataset.prefix || "";
    const suffix = node.dataset.suffix || "";
    const start = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      node.textContent = `${prefix}${value}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  function drawChartFrame(ctx, points, type, progress) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const padding = 8;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = Math.max(1, max - min);
    const count = points.length;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(17, 34, 68, 0.16)";
    ctx.fillRect(0, 0, width, height);

    if (type === "bars") {
      const barGap = 6;
      const barWidth = (chartWidth - barGap * (count - 1)) / count;
      points.forEach((value, index) => {
        const normalized = (value - min) / range;
        const barHeight = Math.max(5, normalized * chartHeight * progress);
        const x = padding + index * (barWidth + barGap);
        const y = height - padding - barHeight;
        ctx.fillStyle = "#2b5dff";
        ctx.fillRect(x, y, barWidth, barHeight);
      });
      return;
    }

    ctx.strokeStyle = "#2b5dff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    points.forEach((value, index) => {
      const x = padding + (index / (count - 1)) * chartWidth;
      const normalized = (value - min) / range;
      const targetY = height - padding - normalized * chartHeight;
      const animatedY = height - padding - (height - padding - targetY) * progress;
      if (index === 0) {
        ctx.moveTo(x, animatedY);
      } else {
        ctx.lineTo(x, animatedY);
      }
    });

    ctx.stroke();

    if (progress > 0.96) {
      points.forEach((value, index) => {
        const x = padding + (index / (count - 1)) * chartWidth;
        const normalized = (value - min) / range;
        const y = height - padding - normalized * chartHeight;
        ctx.fillStyle = "#0b2159";
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function animateChart(canvas, duration = 1000) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const type = canvas.dataset.chart === "bars" ? "bars" : "line";
    const points = (canvas.dataset.points || "")
      .split(",")
      .map((part) => parseNumber(part.trim(), NaN))
      .filter((value) => Number.isFinite(value));

    if (points.length < 2) return;

    const start = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      drawChartFrame(ctx, points, type, progress);
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function normalizeFact(text) {
    if (typeof text !== "string") return "";
    return text.replace(/\s+/g, " ").trim();
  }

  async function fetchJsonWithFallback(urls) {
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        const data = await response.json();
        return data;
      } catch {
        // Try the next fallback URL.
      }
    }
    return null;
  }

  function renderFacts(factListNode, facts) {
    if (!factListNode) return;

    const uniqueFacts = facts
      .filter((item) => item && item.text)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.text === item.text) === index);

    const selectedFacts = uniqueFacts.sort(() => Math.random() - 0.5).slice(0, 3);

    if (!selectedFacts.length) {
      factListNode.innerHTML = '<li class="fact-item">Could not load fun facts right now. Try refreshing.</li>';
      return;
    }

    factListNode.innerHTML = selectedFacts
      .map(
        (fact) =>
          `<li class="fact-item"><span class="fact-source">${fact.source}</span><p>${fact.text}</p></li>`
      )
      .join("");
  }

  async function loadFacts(dashboardWindow) {
    const factListNode = dashboardWindow.querySelector("#dashboard-fact-list");
    if (!factListNode) return;

    factListNode.innerHTML = '<li class="fact-item fact-item--loading">Loading fresh facts...</li>';

    const [uselessFact, yearNumberFact, catFact, issNow, astros] = await Promise.all([
      fetchJsonWithFallback([
        "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
      ]),
      fetchJsonWithFallback([
        "https://numbersapi.com/random/year?json"
      ]),
      fetchJsonWithFallback([
        "https://catfact.ninja/fact"
      ]),
      fetchJsonWithFallback([
        "https://api.allorigins.win/raw?url=http://api.open-notify.org/iss-now.json",
        "http://api.open-notify.org/iss-now.json"
      ]),
      fetchJsonWithFallback([
        "https://api.allorigins.win/raw?url=http://api.open-notify.org/astros.json",
        "http://api.open-notify.org/astros.json"
      ])
    ]);

    const facts = [];

    if (normalizeFact(uselessFact?.text)) {
      facts.push({ source: "Useless Fact", text: normalizeFact(uselessFact.text) });
    }

    if (normalizeFact(yearNumberFact?.text)) {
      facts.push({
        source: "Numbers API",
        text: normalizeFact(yearNumberFact.text)
      });
    }

    if (normalizeFact(catFact?.fact)) {
      facts.push({ source: "Cat Fact", text: normalizeFact(catFact.fact) });
    }

    if (issNow?.iss_position?.latitude && issNow?.iss_position?.longitude) {
      facts.push({
        source: "ISS Now",
        text: `The ISS is currently near latitude ${issNow.iss_position.latitude}, longitude ${issNow.iss_position.longitude}.`
      });
    }

    if (astros?.number && Array.isArray(astros?.people) && astros.people.length) {
      const names = astros.people
        .slice(0, 4)
        .map((person) => person.name)
        .join(", ");
      const plusMore = astros.people.length > 4 ? " and others" : "";
      facts.push({
        source: "Astronaut Roll Call",
        text: `${astros.number} humans are currently in space, including ${names}${plusMore}.`
      });
    }

    renderFacts(factListNode, facts);
  }

  function buildPizzaForecastSeries() {
    const now = new Date();
    const monthLabels = [];
    const monthlyValues = [];
    const baseMonthly = 5000000000 / 12;
    const playfulMonthlyGrowth = 0.018;

    for (let index = 0; index < 12; index += 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index, 1));
      monthLabels.push(date.toLocaleDateString("en-US", { month: "short" }));
      monthlyValues.push(baseMonthly * Math.pow(1 + playfulMonthlyGrowth, index));
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

      ctx.fillStyle = "#102f80";
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();

      if (index % 2 === 0 || index === monthlyValues.length - 1) {
        ctx.fillStyle = "#233a75";
        ctx.font = "14px VT323";
        ctx.fillText(monthLabels[index], x - 10, height - 8);
      }
    });
  }

  function bootDashboard() {
    const dashboardWindow = document.getElementById("dashboard-window");
    if (!dashboardWindow) return;

    dashboardWindow.querySelectorAll("[data-kpi-value]").forEach((node) => animateKpiValue(node));
    dashboardWindow.querySelectorAll(".kpi-chart").forEach((canvas) => animateChart(canvas));

    loadFacts(dashboardWindow);

    const refreshFactsButton = dashboardWindow.querySelector("#dashboard-refresh-facts");
    if (refreshFactsButton) {
      refreshFactsButton.addEventListener("click", () => {
        loadFacts(dashboardWindow);
      });
    }

    const pizzaForecastCanvas = dashboardWindow.querySelector("#pizza-forecast-chart");
    if (pizzaForecastCanvas) {
      drawPizzaForecast(pizzaForecastCanvas);
    }
  }

  window.initializeDashboard = function initializeDashboard() {
    if (dashboardBootstrapped) return;
    dashboardBootstrapped = true;
    bootDashboard();
  };
})();
