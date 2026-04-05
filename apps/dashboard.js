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

  function bootDashboard() {
    const dashboardWindow = document.getElementById("dashboard-window");
    if (!dashboardWindow) return;

    dashboardWindow.querySelectorAll("[data-kpi-value]").forEach((node) => animateKpiValue(node));
    dashboardWindow.querySelectorAll(".kpi-chart").forEach((canvas) => animateChart(canvas));
  }

  window.initializeDashboard = function initializeDashboard() {
    if (dashboardBootstrapped) return;
    dashboardBootstrapped = true;
    bootDashboard();
  };
})();
