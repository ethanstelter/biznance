firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "/login.html";
  } else {
    const db = firebase.firestore();
    const form = document.getElementById("revenue-form");
    const status = document.getElementById("revenue-status");

    const categorySelect = document.getElementById("category");
    const customCategory = document.getElementById("customCategory");

    const paymentSelect = document.getElementById("paymentMethod");
    const customPayment = document.getElementById("customPayment");

    const recurringToggle = document.getElementById("recurring-revenue");
    const recurringSection = document.getElementById("recurring-section");

    // Show/hide recurring section
    recurringToggle.addEventListener("change", () => {
      recurringSection.classList.toggle("hidden", !recurringToggle.checked);
    });

    // Show/hide custom category input
    categorySelect.addEventListener("change", () => {
      customCategory.classList.toggle("hidden", categorySelect.value !== "Other");
    });

    // Show/hide custom payment method input
    paymentSelect.addEventListener("change", () => {
      customPayment.classList.toggle("hidden", paymentSelect.value !== "Other");
    });

    // Load entries
function loadRevenueEntries() {
  const tableBody = document.getElementById("revenue-table-body");
  const showAllBtn = document.getElementById("toggle-revenue-table");
  const filterToggleBtn = document.getElementById("toggle-filters");
  const filtersWrapper = document.getElementById("revenue-filters");

  let allEntries = [];
  let showingAll = false;
  let currentSort = { field: "date", asc: false };

  const filterCategory = document.getElementById("filter-category");
  const filterPayment = document.getElementById("filter-payment");
  const filterStart = document.getElementById("filter-start-date");
  const filterEnd = document.getElementById("filter-end-date");
  const filterSearch = document.getElementById("filter-search");

  // Toggle filters
  filterToggleBtn.addEventListener("click", () => {
    filtersWrapper.classList.toggle("hidden");
    filterToggleBtn.textContent = filtersWrapper.classList.contains("hidden") ? "Show Filters" : "Hide Filters";
  });

  function applyFiltersAndRender() {
    let filtered = [...allEntries];

    // Apply filters
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

    // Sort
    filtered.sort((a, b) => {
      const valA = a[currentSort.field];
      const valB = b[currentSort.field];
      if (valA < valB) return currentSort.asc ? -1 : 1;
      if (valA > valB) return currentSort.asc ? 1 : -1;
      return 0;
    });

    renderTable(filtered);
  }

  function renderTable(data) {
    const rows = showingAll ? data : data.slice(0, 5);

    tableBody.innerHTML = rows.map(entry => `
      <tr class="border-t dark:border-gray-700">
        <td class="px-4 py-2">${new Date(entry.date).toLocaleDateString()}</td>
        <td class="px-4 py-2">${entry.source}</td>
        <td class="px-4 py-2">$${entry.amount.toFixed(2)}</td>
        <td class="px-4 py-2">${entry.category}</td>
        <td class="px-4 py-2">${entry.paymentMethod}</td>
        <td class="px-4 py-2">${entry.notes || ""}</td>
        <td class="px-4 py-2 text-center">${entry.isRecurring ? "✅" : "—"}</td>
      </tr>
    `).join("");

    showAllBtn.textContent = showingAll ? "Collapse" : "Show All";
  }

  // Pull from Firestore
  db.collection("revenue")
    .where("uid", "==", user.uid)
    .orderBy("timestamp", "desc")
    .get()
    .then(snapshot => {
      allEntries = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          date: d.date?.toDate?.() || new Date(0),
          amount: parseFloat(d.amount),
          notes: d.notes || "",
          isRecurring: !!d.isRecurring
        };
      });

      const cats = [...new Set(allEntries.map(e => e.category))];
      const pays = [...new Set(allEntries.map(e => e.paymentMethod))];
      filterCategory.innerHTML += cats.map(c => `<option value="${c}">${c}</option>`).join("");
      filterPayment.innerHTML += pays.map(p => `<option value="${p}">${p}</option>`).join("");

      applyFiltersAndRender();
    });

  // Listeners
  [filterCategory, filterPayment, filterStart, filterEnd, filterSearch].forEach(el =>
    el.addEventListener("input", applyFiltersAndRender)
  );

  showAllBtn.addEventListener("click", () => {
    showingAll = !showingAll;
    applyFiltersAndRender();
  });

  document.querySelectorAll(".sort-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.sort;
      const dir = btn.dataset.dir;
      currentSort = { field, asc: dir === "asc" };
      applyFiltersAndRender();
    });
  });
}

    // Submit form
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

      try {
        await db.collection("revenue").add(entryData);

        // Handle recurring
        if (isRecurring) {
          const frequency = document.getElementById("frequency").value;
          const endDate = document.getElementById("endDate").value;
          const recurringLabel = document.getElementById("recurringLabel").value.trim();

          await db.collection("recurring").add({
            uid: user.uid,
            type: "revenue",
            source,
            amount,
            category,
            paymentMethod,
            notes,
            frequency,
            endDate: new Date(endDate),
            label: recurringLabel,
            startDate: new Date(date),
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

    loadRevenueEntries();
    const today = new Date().toISOString().split("T")[0];
document.getElementById("date").value = today;
document.getElementById("endDate").value = today;
  }
});
