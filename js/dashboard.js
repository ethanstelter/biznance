const db = firebase.firestore();

async function fetchData(collection, dateRange) {
  let query = db.collection(collection)
    .where("uid", "==", firebase.auth().currentUser.uid);

  if (dateRange) {
    query = query.where("timestamp", ">=", dateRange.start)
                 .where("timestamp", "<=", dateRange.end);
  }

  query = query.orderBy("timestamp");

  const snapshot = await query.get();
  const dataByDate = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const ts = data.timestamp?.toDate();
    if (!ts) return;

    const dateStr = ts.toISOString().split("T")[0];
    dataByDate[dateStr] = (dataByDate[dateStr] || 0) + data.amount;
  });

  console.log("📊 Data for chart:", collection, dataByDate);
  return dataByDate;
}


function renderChart(id, label, data, color) {
  const canvas = document.getElementById(id);
  if (!canvas) {
    console.log(`❌ Canvas element with id "${id}" not found.`);
    return;
  }

  console.log("🎯 Checking canvas element:", id, canvas);
  const ctx = canvas.getContext("2d");
  console.log("🖌️ Canvas context for", id, ":", ctx);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: label,
        data: Object.values(data),
        borderColor: color,
        backgroundColor: color + "20",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}
function getDateRange(filter) {
  const today = new Date();
  const start = new Date();

  if (filter === "week") {
    start.setDate(today.getDate() - 7);
  } else if (filter === "month") {
    start.setMonth(today.getMonth() - 1);
  } else if (filter === "year") {
    start.setFullYear(today.getFullYear() - 1);
  } else if (filter === "custom") {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    if (!startDate || !endDate) return null;
    return {
      start: new Date(startDate + "T00:00:00"),
      end: new Date(endDate + "T23:59:59")
    };
  } else {
    return null; // all time
  }

  return {
    start: new Date(start.setHours(0, 0, 0, 0)),
    end: new Date(today.setHours(23, 59, 59, 999))
  };
}

async function loadAllCharts() {
  const selectedFilter = document.getElementById("timeFilter").value;
  const dateRange = getDateRange(selectedFilter);

  // 🔒 Prevent chart from running if custom range is missing
  if (selectedFilter === "custom" && !dateRange) {
    console.log("⛔ Waiting for full custom date range...");
    return;
  }

  const revenueData = await fetchData("revenue", dateRange);
  const expenseData = await fetchData("expenses", dateRange);

  const allDates = new Set([
    ...Object.keys(revenueData),
    ...Object.keys(expenseData)
  ]);

  const profitData = {};
  allDates.forEach(date => {
    const revenue = revenueData[date] || 0;
    const expense = expenseData[date] || 0;
    profitData[date] = revenue - expense;
  });

  renderChart("revenueChart", "Revenue ($)", revenueData, "#22DD86");
  renderChart("expenseChart", "Expenses ($)", expenseData, "#3B82F6");
  renderChart("profitChart", "Profit ($)", profitData, "#1E1E1E");
}

window.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "/login.html";
    } else {
      setTimeout(() => {
        loadAllCharts();

        // ✅ Filtering event listeners
        const timeFilter = document.getElementById("timeFilter");
        const startDate = document.getElementById("startDate");
        const endDate = document.getElementById("endDate");
        const customInputs = document.getElementById("customDateInputs");

        timeFilter.addEventListener("change", () => {
          const value = timeFilter.value;
          customInputs.classList.toggle("hidden", value !== "custom");

          if (value === "custom") {
            console.log("🕓 Waiting for custom date input...");
            return;
          }

          loadAllCharts();
        });

        startDate.addEventListener("change", loadAllCharts);
        endDate.addEventListener("change", loadAllCharts);
      }, 100); // ← closes setTimeout
    }
  });
}); // ← closes DOMContentLoaded

