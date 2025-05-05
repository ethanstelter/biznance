firebase.auth().onAuthStateChanged(async user => {
  if (!user) return (window.location.href = "/login.html");

  const db = firebase.firestore();

  const profitTotal = document.getElementById("profit-total");
  const revenueTotal = document.getElementById("revenue-total");
  const expensesTotal = document.getElementById("expenses-total");

  const profitCtx = document.getElementById("profit-mini-chart").getContext("2d");
  const revenueCtx = document.getElementById("revenue-mini-chart").getContext("2d");
  const expensesCtx = document.getElementById("expenses-mini-chart").getContext("2d");

  let profitChart, revenueChart, expensesChart;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all data
  const [revSnap, expSnap] = await Promise.all([
    db.collection("revenue").where("uid", "==", user.uid).get(),
    db.collection("expenses").where("uid", "==", user.uid).get()
  ]);

  const revEntries = revSnap.docs.map(doc => {
    const d = doc.data();
    return {
      date: d.date?.toDate?.() || new Date(),
      amount: parseFloat(d.amount)
    };
  });

  const expEntries = expSnap.docs.map(doc => {
    const d = doc.data();
    return {
      date: d.date?.toDate?.() || new Date(),
      amount: parseFloat(d.amount)
    };
  });

  // Filter current month
  const filteredRevenue = revEntries.filter(e => e.date >= startOfMonth);
  const filteredExpenses = expEntries.filter(e => e.date >= startOfMonth);

  const totalRevenue = filteredRevenue.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalProfit = totalRevenue - totalExpenses;

  revenueTotal.textContent = `$${totalRevenue.toFixed(2)}`;
  expensesTotal.textContent = `$${totalExpenses.toFixed(2)}`;
  profitTotal.textContent = `$${totalProfit.toFixed(2)}`;

  // Group by day
  function groupByDay(entries) {
    const grouped = {};
    entries.forEach(e => {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}-${String(e.date.getDate()).padStart(2, "0")}`;
      grouped[key] = (grouped[key] || 0) + e.amount;
    });
    return grouped;
  }

  const revenueByDay = groupByDay(filteredRevenue);
  const expensesByDay = groupByDay(filteredExpenses);

  const allKeys = Array.from(new Set([...Object.keys(revenueByDay), ...Object.keys(expensesByDay)])).sort();

  const labels = allKeys;
  const revenueData = labels.map(k => revenueByDay[k] || 0);
  const expensesData = labels.map(k => expensesByDay[k] || 0);
  const profitData = labels.map((_, i) => revenueData[i] - expensesData[i]);

  function createChart(ctx, label, data, color) {
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
        plugins: {
          legend: { display: false },
          tooltip: { mode: "index", intersect: false }
        },
        responsive: true,
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
  }

  revenueChart = createChart(revenueCtx, "Revenue", revenueData, "#22DD86");
  expensesChart = createChart(expensesCtx, "Expenses", expensesData, "#3B82F6");
  profitChart = createChart(profitCtx, "Profit", profitData, "#1E1E1E");
});
