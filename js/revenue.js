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

  let allEntries = [];
  let showingAll = false;
  let currentSort = { field: "date", asc: false };

  const filterCategory = document.getElementById("filter-category");
  const filterPayment = document.getElementById("filter-payment");
  const filterStart = document.getElementById("filter-start-date");
  const filterEnd = document.getElementById("filter-end-date");
  const filterSearch = document.getElementById("filter-search");

  function applyFiltersAndRender() {
    let filtered = [...allEntries];

    // Apply category
    const catVal = filterCategory.value.trim();
    if (catVal) filtered = filtered.filter(e => e.category === catVal);

    // Apply payment
    const payVal = filterPayment.value.trim();
    if (payVal) filtered = filtered.filter(e => e.paymentMethod === payVal);

    // Apply date range
    const start = filterStart.value ? new Date(filterStart.value) : null;
    const end = filterEnd.value ? new Date(filterEnd.value) : null;
    if (start) filtered = filtered.filter(e => new Date(e.date) >= start);
    if (end) filtered = filtered.filter(e => new Date(e.date) <= end);

    // Apply search
    const searchVal = filterSearch.value.toLowerCase();
    if (searchVal) {
      filtered = filtered.filter(e =>
        e.source.toLowerCase().includes(searchVal) ||
        e.notes.toLowerCase().includes(searchVal)
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
        <td class="px-4 py-2 text-center">${entry.recurring ? "✅" : ""}</td>
      </tr>
    `).join("");

    showAllBtn.textContent = showingAll ? "Collapse" : "Show All";
  }

  // Fetch entries
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
          recurring: !!d.frequency // optional fallback
        };
      });

      // Populate dropdown filters
      const categories = [...new Set(allEntries.map(e => e.category))];
      const payments = [...new Set(allEntries.map(e => e.paymentMethod))];
      filterCategory.innerHTML += categories.map(c => `<option value="${c}">${c}</option>`).join("");
      filterPayment.innerHTML += payments.map(p => `<option value="${p}">${p}</option>`).join("");

      applyFiltersAndRender();
    });

  // Events
  [filterCategory, filterPayment, filterStart, filterEnd, filterSearch].forEach(el => {
    el.addEventListener("input", applyFiltersAndRender);
  });

  showAllBtn.addEventListener("click", () => {
    showingAll = !showingAll;
    applyFiltersAndRender();
  });

  // Sortable headers
  document.querySelectorAll("[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-sort");
      if (currentSort.field === field) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort = { field, asc: true };
      }
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
