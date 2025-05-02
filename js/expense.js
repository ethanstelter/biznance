firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const db = firebase.firestore();
  const form = document.getElementById("expense-form");
  const status = document.getElementById("expense-status");

  const categorySelect = document.getElementById("category");
  const customCategory = document.getElementById("customCategory");

  const paymentSelect = document.getElementById("paymentMethod");
  const customPayment = document.getElementById("customPayment");

  const recurringToggle = document.getElementById("recurring-expense");
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
      date: new Date(date),
      isRecurring,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isRecurring) {
      entryData.frequency = document.getElementById("frequency").value;
    }

    try {
      await db.collection("expenses").add(entryData);

      if (isRecurring) {
        await db.collection("recurring").add({
          uid: user.uid,
          type: "expense",
          source,
          amount,
          category,
          paymentMethod,
          notes,
          frequency: document.getElementById("frequency").value,
          endDate: new Date(document.getElementById("endDate").value),
          label: document.getElementById("recurringLabel").value.trim(),
          startDate: new Date(date),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      status.textContent = "✅ expense saved!";
      status.style.color = "green";
      form.reset();
      recurringSection.classList.add("hidden");
      customCategory.classList.add("hidden");
      customPayment.classList.add("hidden");
      loadExpenseEntries();
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.style.color = "red";
    }
  });

  // Load and render spreadsheet
  function loadexpenseEntries() {
    const tableBody = document.getElementById("expense-table-body");
    const showAllBtn = document.getElementById("toggle-expense-table");
    const filterToggleBtn = document.getElementById("toggle-filters");
    const filtersWrapper = document.getElementById("expense-filters");

    const filterCategory = document.getElementById("filter-category");
    const filterPayment = document.getElementById("filter-payment");
    const filterStart = document.getElementById("filter-start-date");
    const filterEnd = document.getElementById("filter-end-date");
    const filterSearch = document.getElementById("filter-search");
    const filterRecurring = document.getElementById("filter-recurring");

    let allEntries = [];
    let showingAll = false;

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

      renderTable(filtered);
    
      document.querySelectorAll(".delete-btn").forEach(button => {
  button.addEventListener("click", async () => {
    const id = button.getAttribute("data-id");
    try {
      await db.collection("expenses").doc(id).delete();
      loadExpenseEntries(); // Refresh table
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
    db.collection("expenses")
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

  loadexpenseEntries();
});
