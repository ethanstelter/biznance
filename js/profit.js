firebase.auth().onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "/login.html");

  const db = firebase.firestore();

  const tableBody = document.getElementById("profile-table-body");
  const summaryProfit = document.getElementById("summary-profit");
  const summaryRevenue = document.getElementById("summary-revenue");
  const summaryExpenses = document.getElementById("summary-expenses");
  const chartCanvas = document.getElementById("profitChart").getContext("2d");

  const rangeSelect = document.getElementById("summary-range");
  const startInput = document.getElementById("summary-start");
  const endInput = document.getElementById("summary-end");
  const chartRange = document.getElementById("chart-range");
  const chartStart = document.getElementById("chart-start-date");
  const chartEnd = document.getElementById("chart-end-date");

  const filterSearch = document.getElementById("filter-search");
  const filterRecurring = document.getElementById("filter-recurring");
  const toggleFilters = document.getElementById("toggle-filters");
  const filterSection = document.getElementById("spreadsheet-filters");
  const toggleTable = document.getElementById("toggle-table");

  let allEntries = [];
  let showAll = false;
  let chart;

  toggleFilters.addEventListener("click", () => {
    filterSection.classList.toggle("hidden");
    toggleFilters.textContent = filterSection.classList.contains("hidden") ? "Show Filters" : "Hide Filters";
  });

  toggleTable.addEventListener("click", () => {
    showAll = !showAll;
    renderTable();
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
        return [new Date(startInput.value), new Date(endInput.value)];
      default: return [null, null];
    }
  }

  async function loadEntries() {
    const [revSnap, expSnap] = await Promise.all([
      db.collection("revenue").where("uid", "==", user.uid).get(),
      db.collection("expenses").where("uid", "==", user.uid).get()
    ]);

    const revEntries = revSnap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        type: "revenue",
        date: data.date?.toDate() || new Date(),
        amount: parseFloat(data.amount),
        notes: data.notes || "",
        source: data.source || "—"
      };
    });

    const expEntries = expSnap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        type: "expense",
        date: data.date?.toDate() || new Date(),
        amount: parseFloat(data.amount),
        notes: data.notes || "",
        source: data.source || "—"
      };
    });

    allEntries = [...revEntries, ...expEntries].sort((a, b) => b.date - a.date);
    updateSummary();
    renderChart();
    renderTable();
  }

  function updateSummary() {
    const [start, end] = getDateRange(rangeSelect.value);
    let totalRevenue = 0, totalExpenses = 0;

    allEntries.forEach(entry => {
      if (start && new Date(entry.date) < start) return;
      if (end && new Date(entry.date) > end) return;
      if (entry.type === "revenue") totalRevenue += entry.amount;
      else if (entry.type === "expense") totalExpenses += entry.amount;
    });

    summaryRevenue.textContent = `$${totalRevenue.toFixed(2)}`;
    summaryExpenses.textContent = `$${totalExpenses.toFixed(2)}`;
    summaryProfit.textContent = `$${(totalRevenue - totalExpenses).toFixed(2)}`;
  }

  function renderChart() {
    const range = chartRange.value;
    const [start, end] = getDateRange(range);
    const useDay = ["today", "week", "month"].includes(range);

    const dataMap = {};

    allEntries.forEach(entry => {
      const d = new Date(entry.date);
      if (start && d < start) return;
      if (end && d > end) return;

      const key = useDay
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

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
          { label: "Profit", data: profit, borderColor: "#000", backgroundColor: "rgba(0,0,0,0.2)", fill: true },
          { label: "Revenue", data: revenue, borderColor: "#22DD86", backgroundColor: "rgba(34,221,134,0.2)", fill: true },
          { label: "Expenses", data: expenses, borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.2)", fill: true }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true }, tooltip: { mode: "index", intersect: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "$" } },
          x: { title: { display: true, text: useDay ? "Day" : "Month" } }
        }
      }
    });
  }

  function renderTable() {
    let filtered = [...allEntries];

    const search = filterSearch.value.toLowerCase();
    if (search) {
      filtered = filtered.filter(e =>
        e.source.toLowerCase().includes(search) || e.notes.toLowerCase().includes(search)
      );
    }

    if (filterRecurring.checked) {
      filtered = filtered.filter(e => e.isRecurring || e.frequency);
    }

    const rows = showAll ? filtered : filtered.slice(0, 5);
    tableBody.innerHTML = rows.map(entry => `
      <tr class="border-t dark:border-gray-700 ${entry.type === "revenue" ? 'bg-green/10' : 'bg-blue/10'}">
        <td class="px-4 py-2">${new Date(entry.date).toLocaleDateString()}</td>
        <td class="px-4 py-2">${entry.source}</td>
        <td class="px-4 py-2">$${entry.amount.toFixed(2)}</td>
        <td class="px-4 py-2">${entry.category || "—"}</td>
        <td class="px-4 py-2">${entry.paymentMethod || "—"}</td>
        <td class="px-4 py-2">${entry.notes.length > 30 ? entry.notes.slice(0, 30) + "..." : entry.notes}</td>
        <td class="px-4 py-2 text-center">${entry.frequency || "—"}</td>
      </tr>
    `).join("");

    toggleTable.textContent = showAll ? "Collapse" : "Show All";
  }

  // Listeners
  rangeSelect.addEventListener("change", () => {
    const isCustom = rangeSelect.value === "custom";
    startInput.classList.toggle("hidden", !isCustom);
    endInput.classList.toggle("hidden", !isCustom);
    updateSummary();
  });

  [startInput, endInput].forEach(el => el.addEventListener("input", updateSummary));

  chartRange.addEventListener("change", () => {
    document.getElementById("custom-date-range").classList.toggle("hidden", chartRange.value !== "custom");
    renderChart();
  });

  [chartStart, chartEnd].forEach(el => el.addEventListener("input", renderChart));
  [filterSearch, filterRecurring].forEach(el => el.addEventListener("input", renderTable));

  // Load everything
  loadEntries();
});
