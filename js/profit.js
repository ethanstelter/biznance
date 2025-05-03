// ✅ COMPLETE OVERHAUL FOR profit.js
// Matches Revenue/Expense layout (filters, sort, recurring, show more, etc.)
// Connects perfectly with your provided profit.html

firebase.auth().onAuthStateChanged(user => {
  if (!user) return (window.location.href = "/login.html");
  const db = firebase.firestore();

  let allProfitEntries = [];
  let showingAll = false;
  let currentSort = { field: "date", asc: false };

  const tableBody = document.getElementById("profit-table-body");
  const toggleBtn = document.getElementById("toggle-profit-table");

  const filters = {
    category: document.getElementById("filter-category"),
    payment: document.getElementById("filter-payment"),
    start: document.getElementById("filter-start-date"),
    end: document.getElementById("filter-end-date"),
    search: document.getElementById("filter-search"),
    recurring: document.getElementById("filter-recurring")
  };

  const addSortListeners = () => {
    document.querySelectorAll(".sort-option").forEach(btn => {
      btn.addEventListener("click", () => {
        currentSort.field = btn.dataset.sort;
        currentSort.asc = btn.dataset.dir === "asc";
        applyFiltersAndRender();
      });
    });
  };

  const applyFiltersAndRender = () => {
    let filtered = [...allProfitEntries];
    const start = filters.start.value;
    const end = filters.end.value;
    const search = filters.search.value.toLowerCase();

    if (filters.category.value)
      filtered = filtered.filter(e => e.category === filters.category.value);
    if (filters.payment.value)
      filtered = filtered.filter(e => e.paymentMethod === filters.payment.value);
    if (start)
      filtered = filtered.filter(e => new Date(e.date) >= new Date(start));
    if (end)
      filtered = filtered.filter(e => new Date(e.date) <= new Date(end));
    if (filters.recurring.checked)
      filtered = filtered.filter(e => e.isRecurring || e.frequency);
    if (search)
      filtered = filtered.filter(e =>
        e.source.toLowerCase().includes(search) ||
        e.notes.toLowerCase().includes(search)
      );

    filtered.sort((a, b) => {
      const valA = a[currentSort.field];
      const valB = b[currentSort.field];
      if (valA < valB) return currentSort.asc ? -1 : 1;
      if (valA > valB) return currentSort.asc ? 1 : -1;
      return 0;
    });

    renderTable(filtered);
  };

  const renderTable = (entries) => {
    const rows = showingAll ? entries : entries.slice(0, 5);
    tableBody.innerHTML = rows.map(entry => `
      <tr class="border-t dark:border-gray-700 group">
        <td class="px-4 py-2">${new Date(entry.date).toLocaleDateString()}</td>
        <td class="px-4 py-2 font-semibold ${entry.type === 'revenue' ? 'text-green-500' : 'text-blue-500'}">
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
          ${entry.notes.length > 30 ? `<div class="absolute z-20 mt-2 hidden group-hover:flex flex-col bg-white dark:bg-black border dark:border-gray-700 shadow p-2 rounded text-sm w-64"><span class="font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Note</span><span class="text-black dark:text-white">${entry.notes}</span></div>` : ""}
        </td>
        <td class="px-4 py-2 text-center">${entry.frequency || "—"}</td>
      </tr>
    `).join("");
    toggleBtn.textContent = showingAll ? "Collapse" : "Show All";
  };

  toggleBtn.addEventListener("click", () => {
    showingAll = !showingAll;
    applyFiltersAndRender();
  });

  document.getElementById("toggle-filters").addEventListener("click", () => {
    const box = document.getElementById("profit-filters");
    box.classList.toggle("hidden");
    document.getElementById("toggle-filters").textContent = box.classList.contains("hidden") ? "Show Filters" : "Hide Filters";
  });

  Object.values(filters).forEach(el => {
    if (el) el.addEventListener("input", applyFiltersAndRender);
  });

  const fetchAndMerge = async () => {
    const [revenueSnap, expenseSnap] = await Promise.all([
      db.collection("revenue").where("uid", "==", user.uid).get(),
      db.collection("expenses").where("uid", "==", user.uid).get()
    ]);
    const revenue = revenueSnap.docs.map(doc => ({ ...doc.data(), type: "revenue" }));
    const expenses = expenseSnap.docs.map(doc => ({ ...doc.data(), type: "expense" }));
    const merged = [...revenue, ...expenses].map(e => ({
      ...e,
      date: e.date?.toDate?.() || new Date(0),
      amount: parseFloat(e.amount),
      notes: e.notes || "",
      frequency: e.frequency || "",
      category: e.category || "",
      paymentMethod: e.paymentMethod || "",
      source: e.source || ""
    }));
    allProfitEntries = merged;
    applyFiltersAndRender();
  };

  addSortListeners();
  fetchAndMerge();
});
