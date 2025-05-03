// profit.js

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const db = firebase.firestore();
  const chartCtx = document.getElementById("profitTrendChart").getContext("2d");
  let profitChart;
  let profitAllEntries = [];
  let profitShowingAll = false;
  let profitCurrentSort = { field: "date", asc: false };

  function fetchDataAndRender(range = 'all') {
    Promise.all([
      db.collection("revenue").where("uid", "==", user.uid).get(),
      db.collection("expenses").where("uid", "==", user.uid).get()
    ]).then(([revenueSnap, expenseSnap]) => {
      const revenueData = revenueSnap.docs.map(doc => ({ ...doc.data(), type: "revenue" }));
      const expenseData = expenseSnap.docs.map(doc => ({ ...doc.data(), type: "expense" }));

      const merged = [...revenueData, ...expenseData].map(e => ({
        ...e,
        date: e.date?.toDate?.() || new Date(0),
        amount: parseFloat(e.amount),
        notes: e.notes || "",
        frequency: e.frequency || "",
        category: e.category || "",
        paymentMethod: e.paymentMethod || "",
        source: e.source || ""
      }));

      profitAllEntries = merged;
      updateSummary(merged);
      renderChart(merged, range);
      applyProfitFiltersAndRender();
    });
  }

  function updateSummary(entries) {
    const range = document.getElementById('profitSummaryRange')?.value || 'all';
    const startInput = document.getElementById('profitSummaryStart');
    const endInput = document.getElementById('profitSummaryEnd');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let start = null;
    let end = null;

    switch (range) {
      case 'today': start = startOfDay; break;
      case 'week': start = startOfWeek; break;
      case 'month': start = startOfMonth; break;
      case 'year': start = startOfYear; break;
      case 'custom':
        start = startInput.value ? new Date(startInput.value) : null;
        end = endInput.value ? new Date(endInput.value) : null;
        break;
    }

    let filtered = [...entries];
    if (start) filtered = filtered.filter(e => new Date(e.date) >= start);
    if (end) filtered = filtered.filter(e => new Date(e.date) <= end);

    const revenueTotal = filtered.filter(e => e.type === "revenue").reduce((sum, e) => sum + e.amount, 0);
    const expenseTotal = filtered.filter(e => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenueTotal - expenseTotal;

    document.getElementById("profit-total-revenue").textContent = `$${revenueTotal.toFixed(2)}`;
    document.getElementById("profit-total-expenses").textContent = `$${expenseTotal.toFixed(2)}`;
    document.getElementById("profit-net").textContent = `$${netProfit.toFixed(2)}`;
  }

  function renderChart(entries, range, startDate = null, endDate = null) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let start = null;
    let end = null;

    switch (range) {
      case 'today': start = startOfDay; break;
      case 'week': start = startOfWeek; break;
      case 'month': start = startOfMonth; break;
      case 'year': start = startOfYear; break;
      case 'custom':
        start = startDate ? new Date(startDate) : null;
        end = endDate ? new Date(endDate) : null;
        break;
      default: start = null;
    }

    let filtered = [...entries];
    if (start) filtered = filtered.filter(e => new Date(e.date) >= start);
    if (end) filtered = filtered.filter(e => new Date(e.date) <= end);

    const groupBy = ['today', 'week', 'month'].includes(range) ? 'day' : 'month';
    const labels = {};

    filtered.forEach(e => {
      const d = new Date(e.date);
      const key = groupBy === 'day'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!labels[key]) labels[key] = { revenue: 0, expense: 0 };
      labels[key][e.type] += e.amount;
    });

    const sortedKeys = Object.keys(labels).sort();
    const labelList = sortedKeys;
    const revenueList = sortedKeys.map(k => labels[k].revenue);
    const expenseList = sortedKeys.map(k => labels[k].expense);

    if (profitChart) profitChart.destroy();

    profitChart = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: labelList,
        datasets: [
          {
            label: 'Revenue',
            data: revenueList,
            borderColor: '#22DD86',
            backgroundColor: 'rgba(34, 221, 134, 0.2)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Expenses',
            data: expenseList,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { beginAtZero: true },
          x: {
            title: {
              display: true,
              text: groupBy === 'day' ? 'Day' : 'Month'
            }
          }
        }
      }
    });
  }

  function renderProfitTable(data) {
    const tableBody = document.getElementById("profit-table-body");
    const rows = profitShowingAll ? data : data.slice(0, 5);

    tableBody.innerHTML = rows.map(entry => `
      <tr class="border-t dark:border-gray-700 group">
        <td class="px-4 py-2">${new Date(entry.date).toLocaleDateString()}</td>
        <td class="px-4 py-2 font-semibold ${entry.type === "revenue" ? "text-green-500" : "text-blue-500"}">
          ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
        </td>
        <td class="px-4 py-2">${entry.source}</td>
        <td class="px-4 py-2">$${entry.amount.toFixed(2)}</td>
        <td class="px-4 py-2">${entry.category}</td>
        <td class="px-4 py-2">${entry.paymentMethod}</td>
        <td class="px-4 py-2 relative">
          <div class="max-w-[200px] overflow-hidden whitespace-nowrap text-ellipsis">
            ${entry.notes.length > 30 ? entry.notes.slice(0, 30) + "..." : entry.notes}
          </div>
          ${entry.notes.length > 30 ? `
            <div class="absolute z-20 mt-2 hidden group-hover:flex flex-col bg-white dark:bg-black border dark:border-gray-700 shadow p-2 rounded text-sm w-64">
              <span class="font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Note</span>
              <span class="text-black dark:text-white">${entry.notes}</span>
            </div>
          ` : ""}
        </td>
        <td class="px-4 py-2 text-center">${entry.frequency || "—"}</td>
      </tr>
    `).join("");

    document.getElementById("toggle-profit-table").textContent = profitShowingAll ? "Collapse" : "Show All";
  }

  document.getElementById("toggle-profit-table").addEventListener("click", () => {
    profitShowingAll = !profitShowingAll;
    renderProfitTable(profitAllEntries);
  });

  ["filter-category", "filter-payment", "filter-start-date", "filter-end-date", "filter-search", "filter-recurring"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", applyProfitFiltersAndRender);
  });

  document.querySelectorAll(".sort-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.sort;
      const dir = btn.dataset.dir;
      profitCurrentSort = { field, asc: dir === "asc" };
      applyProfitFiltersAndRender();
    });
  });

  function applyProfitFiltersAndRender() {
    const category = document.getElementById("filter-category").value;
    const payment = document.getElementById("filter-payment").value;
    const start = document.getElementById("filter-start-date").value;
    const end = document.getElementById("filter-end-date").value;
    const search = document.getElementById("filter-search").value.toLowerCase();
    const recurring = document.getElementById("filter-recurring").checked;

    let filtered = [...profitAllEntries];

    if (category) filtered = filtered.filter(e => e.category === category);
    if (payment) filtered = filtered.filter(e => e.paymentMethod === payment);
    if (start) filtered = filtered.filter(e => new Date(e.date) >= new Date(start));
    if (end) filtered = filtered.filter(e => new Date(e.date) <= new Date(end));
    if (search) {
      filtered = filtered.filter(e =>
        e.source.toLowerCase().includes(search) ||
        e.notes.toLowerCase().includes(search)
      );
    }
    if (recurring) filtered = filtered.filter(e => e.isRecurring || e.frequency);

    filtered.sort((a, b) => {
      const valA = a[profitCurrentSort.field];
      const valB = b[profitCurrentSort.field];
      if (valA < valB) return profitCurrentSort.asc ? -1 : 1;
      if (valA > valB) return profitCurrentSort.asc ? 1 : -1;
      return 0;
    });

    document.querySelectorAll(".sort-option").forEach(btn => {
  btn.addEventListener("click", () => {
    const field = btn.dataset.sort;
    const dir = btn.dataset.dir;
    profitCurrentSort = { field, asc: dir === "asc" };
    applyProfitFiltersAndRender();
  });
});

    renderProfitTable(filtered);
  }

  document.getElementById("toggle-filters").addEventListener("click", () => {
  const wrapper = document.getElementById("profit-filters");
  wrapper.classList.toggle("hidden");
  document.getElementById("toggle-filters").textContent =
    wrapper.classList.contains("hidden") ? "Show Filters" : "Hide Filters";
});

  const chartRange = document.getElementById('profitChartRange');
  const chartStart = document.getElementById('profitChartStart');
  const chartEnd = document.getElementById('profitChartEnd');
  chartRange.addEventListener('change', () => {
    const isCustom = chartRange.value === 'custom';
    chartStart.classList.toggle('hidden', !isCustom);
    chartEnd.classList.toggle('hidden', !isCustom);
    renderChart(profitAllEntries, chartRange.value, chartStart.value, chartEnd.value);
  });
  chartStart.addEventListener('input', () => {
    if (chartRange.value === 'custom') {
      renderChart(profitAllEntries, chartRange.value, chartStart.value, chartEnd.value);
    }
  });
  chartEnd.addEventListener('input', () => {
    if (chartRange.value === 'custom') {
      renderChart(profitAllEntries, chartRange.value, chartStart.value, chartEnd.value);
    }
  });

  const summaryRange = document.getElementById('profitSummaryRange');
  const summaryStart = document.getElementById('profitSummaryStart');
  const summaryEnd = document.getElementById('profitSummaryEnd');
  summaryRange.addEventListener('change', () => {
    const isCustom = summaryRange.value === 'custom';
    summaryStart.classList.toggle('hidden', !isCustom);
    summaryEnd.classList.toggle('hidden', !isCustom);
    updateSummary(profitAllEntries);
  });
  summaryStart.addEventListener('input', () => updateSummary(profitAllEntries));
  summaryEnd.addEventListener('input', () => updateSummary(profitAllEntries));

  fetchDataAndRender();
});
