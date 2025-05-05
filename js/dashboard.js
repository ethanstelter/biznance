firebase.auth().onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "/login.html");

  const db = firebase.firestore();

  // DOM Elements
  const rangeSelect = document.getElementById("dashboard-range");
  const customStart = document.getElementById("dashboard-start-date");
  const customEnd = document.getElementById("dashboard-end-date");
  const customRangeWrapper = document.getElementById("dashboard-custom-range");

  const profitTotal = document.getElementById("profit-total");
  const revenueTotal = document.getElementById("revenue-total");
  const expensesTotal = document.getElementById("expenses-total");

  const profitCtx = document.getElementById("profit-mini-chart").getContext("2d");
  const revenueCtx = document.getElementById("revenue-mini-chart").getContext("2d");
  const expensesCtx = document.getElementById("expenses-mini-chart").getContext("2d");

  let profitChart, revenueChart, expensesChart;
  let revenueData = [], expenseData = [];

  const [revSnap, expSnap] = await Promise.all([
    db.collection("revenue").where("uid", "==", user.uid).get(),
    db.collection("expenses").where("uid", "==", user.uid).get()
  ]);

  revenueData = revSnap.docs.map(doc => {
    const d = doc.data();
    return { date: d.date?.toDate?.() || new Date(), amount: parseFloat(d.amount) };
  });

  expenseData = expSnap.docs.map(doc => {
    const d = doc.data();
    return { date: d.date?.toDate?.() || new Date(), amount: parseFloat(d.amount) };
  });

  function getDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week = new Date(today);
    week.setDate(today.getDate() - today.getDay());
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const year = new Date(now.getFullYear(), 0, 1);

    switch (range) {
      case "today": return [today, now];
      case "week": return [week, now];
      case "month": return [month, now];
      case "year": return [year, now];
      case "custom":
        const start = new Date(customStart.value);
        const end = new Date(customEnd.value);
        return [start, end];
      default: return [null, null];
    }
  }

  function groupByDay(entries, start, end) {
    const grouped = {};
    entries.forEach(e => {
      const date = new Date(e.date);
      if (start && date < start) return;
      if (end && date > end) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      grouped[key] = (grouped[key] || 0) + e.amount;
    });
    return grouped;
  }

  function renderAll() {
    const selected = rangeSelect.value;
    const [start, end] = getDateRange(selected);

    const revMap = groupByDay(revenueData, start, end);
    const expMap = groupByDay(expenseData, start, end);
    const allKeys = Array.from(new Set([...Object.keys(revMap), ...Object.keys(expMap)])).sort();

    const labels = allKeys;
    const revVals = labels.map(k => revMap[k] || 0);
    const expVals = labels.map(k => expMap[k] || 0);
    const profitVals = labels.map((_, i) => revVals[i] - expVals[i]);

    // Totals
    const totalRev = revVals.reduce((a, b) => a + b, 0);
    const totalExp = expVals.reduce((a, b) => a + b, 0);
    const totalProfit = totalRev - totalExp;

    revenueTotal.textContent = `$${totalRev.toFixed(2)}`;
    expensesTotal.textContent = `$${totalExp.toFixed(2)}`;
    profitTotal.textContent = `$${totalProfit.toFixed(2)}`;

    // Chart Drawing
    function drawChart(ctx, data, color, label, oldChart) {
      if (oldChart) oldChart.destroy();
      return new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label,
            data,
            borderColor: color,
            backgroundColor: `${color}33`,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }
      });
    }

    revenueChart = drawChart(revenueCtx, revVals, "#22DD86", "Revenue", revenueChart);
    expensesChart = drawChart(expensesCtx, expVals, "#3B82F6", "Expenses", expensesChart);
    profitChart = drawChart(profitCtx, profitVals, "#1E1E1E", "Profit", profitChart);
  }

  // Event Listeners
  rangeSelect.addEventListener("change", () => {
    const isCustom = rangeSelect.value === "custom";
    customRangeWrapper.classList.toggle("hidden", !isCustom);
    renderAll();
  });

  [customStart, customEnd].forEach(input => input.addEventListener("input", renderAll));

  renderAll(); // Initial load
});
