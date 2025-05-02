firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "/login.html";
  } else {
    const db = firebase.firestore();
    const form = document.getElementById("expense-form");
    const status = document.getElementById("expense-status");

    const categorySelect = document.getElementById("category");
    const customCategory = document.getElementById("customCategory");

    const paymentSelect = document.getElementById("paymentMethod");
    const customPayment = document.getElementById("customPayment");

    const recurringToggle = document.getElementById("recurring-expense");
    const recurringSection = document.getElementById("recurring-section");

    // Toggle recurring section
    recurringToggle.addEventListener("change", () => {
      recurringSection.classList.toggle("hidden", !recurringToggle.checked);
    });

    // Show custom category input
    categorySelect.addEventListener("change", () => {
      customCategory.classList.toggle("hidden", categorySelect.value !== "Other");
    });

    // Show custom payment input
    paymentSelect.addEventListener("change", () => {
      customPayment.classList.toggle("hidden", paymentSelect.value !== "Other");
    });

    // Form submit
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
        await db.collection("expenses").add(entryData);

        // Save recurring if checked
        if (isRecurring) {
          const frequency = document.getElementById("frequency").value;
          const endDate = document.getElementById("endDate").value;
          const recurringLabel = document.getElementById("recurringLabel").value.trim();

          await db.collection("recurring").add({
            uid: user.uid,
            type: "expense",
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

        status.textContent = "✅ Expense saved!";
        status.style.color = "green";
        form.reset();
        recurringSection.classList.add("hidden");
        customCategory.classList.add("hidden");
        customPayment.classList.add("hidden");

        loadExpenses();
      } catch (err) {
        status.textContent = "❌ " + err.message;
        status.style.color = "red";
      }
    });

    // Load entries
    async function loadExpenses() {
      const list = document.getElementById("expense-list");
      list.innerHTML = "<p class='text-gray-500 text-center'>Loading...</p>";

      try {
        const snapshot = await db.collection("expenses")
          .where("uid", "==", user.uid)
          .orderBy("timestamp", "desc")
          .get();

        if (snapshot.empty) {
          list.innerHTML = "<p class='text-gray-500 text-center'>No expenses yet.</p>";
          return;
        }

        list.innerHTML = "";

        snapshot.forEach(doc => {
          const entry = doc.data();
          const id = doc.id;

          const item = document.createElement("div");
          item.className = "bg-white dark:bg-neutral-900 p-4 rounded shadow flex justify-between items-center";

          item.innerHTML = `
            <div>
              <p class="font-semibold text-black dark:text-white">${entry.source}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">$${entry.amount.toFixed(2)}</p>
            </div>
            <button data-id="${id}" class="text-red-500 hover:text-red-700 font-semibold delete-btn">Delete</button>
          `;

          list.appendChild(item);
        });

        document.querySelectorAll(".delete-btn").forEach(button => {
          button.addEventListener("click", async () => {
            const id = button.getAttribute("data-id");
            try {
              await db.collection("expenses").doc(id).delete();
              loadExpenses();
            } catch (err) {
              alert("Error deleting: " + err.message);
            }
          });
        });
      } catch (err) {
        list.innerHTML = `<p class='text-red-500'>Error loading expenses: ${err.message}</p>`;
      }
    }

    // Initial load
    loadExpenses();

    // Set default date fields to today
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("date").value = today;
    document.getElementById("endDate").value = today;
  }
});
