const currentBusinessId = localStorage.getItem("businessId") || "default";

// expense.js

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "/login.html";
  } else {
    const db = firebase.firestore();
    const form = document.getElementById("expense-form");
    const status = document.getElementById("expense-status");

    // Handle form submission
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const category = form.category.value;
      const amount = parseFloat(form.amount.value);
      const isRecurring = document.getElementById("recurring-expense").checked;

      try {
        await db.collection("expenses").add({
          uid: user.uid,
          category: category,
          amount: amount,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
if (isRecurring) {
  await db.collection("recurring").add({
    uid: user.uid,
    type: "expense",
    category: category,
    amount: amount,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

        status.textContent = "✅ Expense saved!";
        status.style.color = "green";
        form.reset();
        loadExpenses(); // refresh list
      } catch (err) {
        status.textContent = "❌ " + err.message;
        status.style.color = "red";
      }
    });

    // Load and display entries
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
              <p class="font-semibold text-black dark:text-white">${entry.category}</p>
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
              loadExpenses(); // refresh
            } catch (err) {
              alert("Error deleting: " + err.message);
            }
          });
        });

      } catch (err) {
        list.innerHTML = `<p class='text-red-500'>Error loading expenses: ${err.message}</p>`;
      }
    }

    loadExpenses(); // initial load
  }
});

