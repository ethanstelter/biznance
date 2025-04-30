const db = firebase.firestore();

async function fetchData(collection) {
  const snapshot = await db.collection(collection)
    .where("uid", "==", firebase.auth().currentUser.uid)
    .orderBy("timestamp")
    .get();

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

async function loadAllCharts() {
  const revenueData = await fetchData("revenue");
  const expenseData = await fetchData("expenses");

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
      }, 100);
    }
  });
});
