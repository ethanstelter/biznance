firebase.auth().onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "/login.html");

  const db = firebase.firestore();
  const summaryProfit = document.getElementById("summary-profit");
  const summaryRevenue = document.getElementById("summary-revenue");
  const summaryExpenses = document.getElementById("summary-expenses");

  const rangeSelect = document.getElementById("summary-range");
  const startInput = document.getElementById("summary-start");
  const endInput = document.getElementById("summary-end");

  const chartRange = document.getElementById("chart-range");
  const chartStart = document.getElementById("chart-start-date");
  const chartEnd = document.getElementById("chart-end-date");

  const chartCanvas = document.getElementById("dashboardChart").getContext("2d");

  let allEntries = [];
  let chart;

  function getDateRange(range, customStart, customEnd) {
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
        return [new Date(customStart), new Date(customEnd)];
      default: return [null, null];
    }
  }

  async function loadData() {
    const [revSnap, expSnap] = await Promise.all([
      db.collection("revenue").where("uid", "==", user.uid).get(),
      db.collection("expenses").where("uid", "==", user.uid).get()
    ]);

    const revEntries = revSnap.docs.map(doc => {
      const d = doc.data();
      return {
        ...d,
        type: "revenue",
        amount: parseFloat(d.amount),
        date: d.date?.toDate() || new Date()
      };
    });

    const expEntries = expSnap.docs.map(doc => {
      const d = doc.data();
      return {
        ...d,
        type: "expense",
        amount: parseFloat(d.amount),
        date: d.date?.toDate() || new Date()
      };
    });

    allEntries = [...revEntries, ...expEntries];
    updateSummary();
    renderChart();
  }

  function updateSummary() {
    const range = rangeSelect.value;
    const [start, end] = getDateRange(range, startInput.value, endInput.value);

    let totalRevenue = 0;
    let totalExpenses = 0;

    allEntries.forEach(entry => {
      const date = new Date(entry.date);
      if (start && date < start) return;
      if (end && date > end) return;

      if (entry.type === "revenue") totalRevenue += entry.amount;
      if (entry.type === "expense") totalExpenses += entry.amount;
    });

    summaryRevenue.textContent = `$${totalRevenue.toFixed(2)}`;
    summaryExpenses.textContent = `$${totalExpenses.toFixed(2)}`;
    summaryProfit.textContent = `$${(totalRevenue - totalExpenses).toFixed(2)}`;
  }

  function renderChart() {
    const range = chartRange.value;
    const [start, end] = getDateRange(range, chartStart.value, chartEnd.value);
    const useDay = ["today", "week", "month"].includes(range);

    const dataMap = {};

    allEntries.forEach(entry => {
      const date = new Date(entry.date);
      if (start && date < start) return;
      if (end && date > end) return;

      const key = useDay
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!dataMap[key]) dataMap[key] = { revenue: 0, expense: 0 };
      if (entry.type === "revenue") dataMap[key].revenue += entry.amount;
      if (entry.type === "expense") dataMap[key].expense += entry.amount;
    });

    const sortedKeys = Object.keys(dataMap).sort();
    const labels = sortedKeys;
    const revenue = sortedKeys.map(k => dataMap[k].revenue);
    const expenses = sortedKeys.map(k => dataMap[k].expense);
    const profit = sortedKeys.map(k => dataMap[k].revenue - dataMap[k].expense);

    if (chart) chart.destroy();

    chart = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Profit",
            data: profit,
            borderColor: "#1E1E1E",
            backgroundColor: "rgba(30,30,30,0.2)",
            fill: true
          },
          {
            label: "Revenue",
            data: revenue,
            borderColor: "#22DD86",
            backgroundColor: "rgba(34,221,134,0.2)",
            fill: true
          },
          {
            label: "Expenses",
            data: expenses,
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59,130,246,0.2)",
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "$" }
          },
          x: {
            title: { display: true, text: useDay ? "Day" : "Month" }
          }
        }
      }
    });
  }

  // Range selection listeners
  rangeSelect.addEventListener("change", () => {
    const isCustom = rangeSelect.value === "custom";
    startInput.classList.toggle("hidden", !isCustom);
    endInput.classList.toggle("hidden", !isCustom);
    updateSummary();
  });

  [startInput, endInput].forEach(el => el.addEventListener("input", updateSummary));

  chartRange.addEventListener("change", () => {
    const show = chartRange.value === "custom";
    document.getElementById("custom-date-range").classList.toggle("hidden", !show);
    renderChart();
  });

  [chartStart, chartEnd].forEach(el => el.addEventListener("input", renderChart));

  // Initial load
  loadData();
});
