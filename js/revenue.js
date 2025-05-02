firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const db = firebase.firestore();
  const form = document.getElementById("revenue-form");
  const status = document.getElementById("revenue-status");

  const categorySelect = document.getElementById("category");
  const customCategory = document.getElementById("customCategory");

  const paymentSelect = document.getElementById("paymentMethod");
  const customPayment = document.getElementById("customPayment");

  const recurringToggle = document.getElementById("recurring-revenue");
  const recurringSection = document.getElementById("recurring-section");

  // Autofill dates
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("date").value = today;
  document.getElementById("endDate").value = today;

  // Recurring and custom option toggles
  recurringToggle.addEventListener("change", () => {
    recurringSection.classList.toggle("hidden", !recurringToggle.checked);
  });
  categorySelect.addEventListener("change", () => {
    customCategory.classList.toggle("hidden", categorySelect.value !== "Other");
  });
  paymentSelect.addEventListener("change", () => {
    customPayment.classList.toggle("hidden", paymentSelect.value !== "Other");
  });

  // Form submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const source = form.source.value;
    const amount = parseFloat(form.amount.value);
    const category = categorySelect.value === "Other" ? customCategory.value.trim() : categorySelect.value;
    const paymentMethod = paymentSelect.value === "Other" ? customPayment.value.trim() : paymentSelect.value;
    const notes = document.getElementById("notes").value.trim();
    const date = document.getElementById("date").value;
    const isRecurring = recurringToggle.checked;

    const entryData = {
      uid: user.uid,
      source,
      amount,
      category,
      paymentMethod,
      notes,
      date: new Date(date + "T00:00:00"),
      isRecurring,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isRecurring) {
      entryData.frequency = document.getElementById("frequency").value;
    }

    try {
      await db.collection("revenue").add(entryData);

      if (isRecurring) {
        await db.collection("recurring").add({
          uid: user.uid,
          type: "revenue",
          source,
          amount,
          category,
          paymentMethod,
          notes,
          frequency: document.getElementById("frequency").value,
          endDate: new Date(document.getElementById("endDate").value),
          label: document.getElementById("recurringLabel").value.trim(),
          startDate: new Date(date + "T00:00:00"),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      status.textContent = "✅ Revenue saved!";
      status.style.color = "green";
      form.reset();
      recurringSection.classList.add("hidden");
      customCategory.classList.add("hidden");
      customPayment.classList.add("hidden");

      loadRevenueEntries();
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.style.color = "red";
    }
  });

  // Load and render spreadsheet
  function loadRevenueEntries() {
    const tableBody = document.getElementById("revenue-table-body");
    const showAllBtn = document.getElementById("toggle-revenue-table");
    const filterToggleBtn = document.getElementById("toggle-filters");
    const filtersWrapper = document.getElementById("revenue-filters");

    const filterCategory = document.getElementById("filter-category");
    const filterPayment = document.getElementById("filter-payment");
    const filterStart = document.getElementById("filter-start-date");
    const filterEnd = document.getElementById("filter-end-date");
    const filterSearch = document.getElementById("filter-search");
    const filterRecurring = document.getElementById("filter-recurring");

    let allEntries = [];
    let showingAll = false;

    const summaryRange = document.getElementById("summary-range");
const summaryStart = document.getElementById("summary-start");
const summaryEnd = document.getElementById("summary-end");

summaryRange.addEventListener("change", () => {
  const showCustom = summaryRange.value === "custom";
  summaryStart.classList.toggle("hidden", !showCustom);
  summaryEnd.classList.toggle("hidden", !showCustom);
  updateSummary(allEntries);
});
summaryStart.addEventListener("input", () => updateSummary(allEntries));
summaryEnd.addEventListener("input", () => updateSummary(allEntries));

    // Toggle filter UI
    filterToggleBtn.addEventListener("click", () => {
      filtersWrapper.classList.toggle("hidden");
      filterToggleBtn.textContent = filtersWrapper.classList.contains("hidden") ? "Show Filters" : "Hide Filters";
    });

    // Sortable fields (optional)
    let currentSort = { field: "date", asc: false };

    function applyFiltersAndRender() {
      let filtered = [...allEntries];

      if (filterCategory.value) filtered = filtered.filter(e => e.category === filterCategory.value);
      if (filterPayment.value) filtered = filtered.filter(e => e.paymentMethod === filterPayment.value);

      const start = filterStart.value ? new Date(filterStart.value) : null;
      const end = filterEnd.value ? new Date(filterEnd.value) : null;
      if (start) filtered = filtered.filter(e => new Date(e.date) >= start);
      if (end) filtered = filtered.filter(e => new Date(e.date) <= end);

      const search = filterSearch.value.toLowerCase();
      if (search) {
        filtered = filtered.filter(e =>
          e.source.toLowerCase().includes(search) ||
          e.notes.toLowerCase().includes(search)
        );
      }
     
      if (filterRecurring.checked) {
  filtered = filtered.filter(e => e.isRecurring === true || e.frequency);
}

      filtered.sort((a, b) => {
        const valA = a[currentSort.field];
        const valB = b[currentSort.field];
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
      });

      updateSummary(allEntries);

      renderTable(filtered);
    
      document.querySelectorAll(".delete-btn").forEach(button => {
  button.addEventListener("click", async () => {
    const id = button.getAttribute("data-id");
    try {
      await db.collection("revenue").doc(id).delete();
      loadRevenueEntries(); // Refresh table
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  });
});

      // Reattach dropdown sort listeners after table is rendered
document.querySelectorAll(".sort-option").forEach(btn => {
  btn.addEventListener("click", () => {
    const field = btn.dataset.sort;
    const dir = btn.dataset.dir;
    currentSort = { field, asc: dir === "asc" };
    applyFiltersAndRender();
  });
});
    }

    function renderTable(data) {
      const rows = showingAll ? data : data.slice(0, 5);

     tableBody.innerHTML = rows.map(entry => `
  <tr class="border-t dark:border-gray-700 group">
    <td class="px-4 py-2">${new Date(entry.date).toLocaleDateString()}</td>
    <td class="px-4 py-2">${entry.source}</td>
    <td class="px-4 py-2">$${entry.amount.toFixed(2)}</td>
    <td class="px-4 py-2">${entry.category}</td>
    <td class="px-4 py-2">${entry.paymentMethod}</td>
   <td class="px-4 py-2 relative">
  <div class="max-w-[200px] overflow-hidden whitespace-nowrap text-ellipsis">
    ${entry.notes.length > 30 ? entry.notes.slice(0, 30) + "..." : entry.notes}
  </div>
  ${entry.notes.length > 30 ? `
    <div class="absolute z-20 mt-2 hidden group-hover:flex flex-col bg-white dark:bg-black border dark:border-gray-700 shadow p-2 rounded text-sm w-64 group transition-all">
      <span class="font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Note</span>
      <span class="text-black dark:text-white">${entry.notes}</span>
    </div>
  ` : ""}
</td>

    <td class="px-4 py-2 text-center">${entry.frequency || "—"}</td>
  <td class="px-4 py-2 text-right">
  <button
    class="delete-btn text-gray-400 hover:text-red-600 transition"
    data-id="${entry.id}"
    title="Delete"
  >
    ✖
  </button>
</td>
  </tr>
`).join("");


      showAllBtn.textContent = showingAll ? "Collapse" : "Show All";
    }

    // Firestore fetch
    db.collection("revenue")
      .where("uid", "==", user.uid)
      .orderBy("timestamp", "desc")
      .get()
      .then(snapshot => {
     allEntries = snapshot.docs.map(doc => {
  const d = doc.data();
  return {
    ...d,
    id: doc.id, // 👈 Required for delete to work
    date: d.date?.toDate?.() || new Date(0),
    amount: parseFloat(d.amount),
    notes: d.notes || "",
    frequency: d.frequency || ""
  };
});

        const cats = [...new Set(allEntries.map(e => e.category))];
        const pays = [...new Set(allEntries.map(e => e.paymentMethod))];
        filterCategory.innerHTML += cats.map(c => `<option value="${c}">${c}</option>`).join("");
        filterPayment.innerHTML += pays.map(p => `<option value="${p}">${p}</option>`).join("");

        applyFiltersAndRender();
      });

    // Bind filter + show all toggle
    [filterCategory, filterPayment, filterStart, filterEnd, filterSearch].forEach(el =>
      el.addEventListener("input", applyFiltersAndRender)
    );
    filterRecurring.addEventListener("input", applyFiltersAndRender);

    showAllBtn.addEventListener("click", () => {
      showingAll = !showingAll;
      applyFiltersAndRender();
    });
  }
function updateSummary(entries) {
  const totalElement = document.getElementById("summary-total");
  const range = document.getElementById("summary-range").value;
  const startInput = document.getElementById("summary-start");
  const endInput = document.getElementById("summary-end");

  let filtered = [...entries];

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  let start, end;

  switch (range) {
    case "today":
      start = startOfDay;
      break;
    case "week":
      start = startOfWeek;
      break;
    case "month":
      start = startOfMonth;
      break;
    case "year":
      start = startOfYear;
      break;
    case "custom":
      start = new Date(startInput.value);
      end = new Date(endInput.value);
      break;
    default:
      start = null;
  }

  if (start) {
    filtered = filtered.filter(e => new Date(e.date) >= start);
  }
  if (end) {
    filtered = filtered.filter(e => new Date(e.date) <= end);
  }

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  totalElement.textContent = `$${total.toFixed(2)}`;
}

  loadRevenueEntries();
});
